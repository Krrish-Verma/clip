param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$Token = $env:CLIP_TEST_TOKEN,
  [switch]$Studio,
  [switch]$Transcription
)

$ErrorActionPreference = "Stop"
if (-not $Token) { throw "Set CLIP_TEST_TOKEN to a current Clerk session token. This script never bypasses authentication." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker Desktop is required for this verification script." }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtime = Join-Path $repoRoot ".runtime"
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$fixture = Join-Path $runtime "clip-fixture.mp4"
$headers = @{ Authorization = "Bearer $Token" }
$videoId = $null

try {
  Push-Location $repoRoot
  Invoke-RestMethod -Uri "$ApiUrl/actuator/health" | Out-Null

  $mount = "${runtime}:/out"
  $ErrorActionPreference = "Continue" # Windows PowerShell treats native stderr progress as an error record.
  $audio = if ($Transcription) { "flite=text=Welcome to Clip. This is a recording test.:voice=slt" } else { "sine=frequency=880" }
  $workerImage = docker container inspect clip-worker-1 --format '{{.Image}}'
  if ($LASTEXITCODE -ne 0 -or -not $workerImage) { throw "Start the local Clip Compose worker before running the smoke test." }
  docker run --rm -v $mount --entrypoint ffmpeg $workerImage -y -f lavfi -i "testsrc=size=640x360:rate=24" -f lavfi -i $audio -t 5 -c:v libx264 -pix_fmt yuv420p -c:a aac /out/clip-fixture.mp4
  $ErrorActionPreference = "Stop"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $fixture)) { throw "Could not generate the media fixture." }

  $size = (Get-Item -LiteralPath $fixture).Length
  $created = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos" -Headers $headers -ContentType "application/json" -Body (@{
    title = "Local end-to-end fixture"; mimeType = "video/mp4"; sizeBytes = $size
  } | ConvertTo-Json)
  $videoId = $created.videoId

  $multipart = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/multipart" -Headers $headers
  if ($multipart.parts.Count -ne 1) { throw "The small fixture should require one multipart part." }
  Invoke-WebRequest -UseBasicParsing -Method Put -Uri $multipart.parts[0].url -ContentType "video/mp4" -InFile $fixture | Out-Null
  $resumed = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/multipart" -Headers $headers
  if (-not $resumed.parts[0].uploaded) { throw "Multipart resume did not recognize the uploaded part." }
  Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/multipart/complete" -Headers $headers | Out-Null

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 2
    $video = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId" -Headers $headers
    if ($video.status -eq "FAILED") { throw "FFmpeg processing failed." }
  } while ($video.status -ne "READY" -and (Get-Date) -lt $deadline)
  if ($video.status -ne "READY") { throw "Timed out waiting for processing." }

  $playback = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/playback" -Headers $headers
  Invoke-WebRequest -UseBasicParsing -Method Get -Uri $playback.playbackUrl | Out-Null
  $share = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/share" -Headers $headers -ContentType 'application/json' -Body '{}'
  $shareToken = ([uri]$share.shareUrl).Segments[-1]
  $shared = Invoke-RestMethod -Uri "$ApiUrl/api/shares/$shareToken"
  if ($shared.id -ne $videoId) { throw "Share lookup returned the wrong video." }

  if ($Transcription) {
    Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/studio/transcribe" -Headers $headers | Out-Null
    $deadline = (Get-Date).AddMinutes(5)
    do {
      Start-Sleep -Seconds 2
      $details = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/studio" -Headers $headers
      if ($details.transcriptStatus -eq "FAILED") { throw "Transcription failed: $($details.transcriptError)" }
    } while ($details.transcriptStatus -ne "READY" -and (Get-Date) -lt $deadline)
    if ($details.transcriptStatus -ne "READY") { throw "Timed out waiting for transcription." }
    $transcript = $details.transcriptJson | ConvertFrom-Json
    if (-not ($transcript.segments | Where-Object { $_.text -match '\S' })) { throw "Transcription returned no text for the speech fixture." }
    Write-Output "Speech fixture transcription passed."
  }

  if ($Studio) {
    $edit = @{
      segments = @(@{videoId=$videoId;start=0.2;end=1.2},@{videoId=$videoId;start=1.6;end=2.6})
      crop = @{x=0.05;y=0.05;width=0.9;height=0.9}
      blurs = @(@{x=0.1;y=0.1;width=0.2;height=0.2})
      boxes = @(@{x=0.5;y=0.5;width=0.25;height=0.25})
      overlayText = "Clip studio: a 'real' render, 100%"
      aspect = "portrait"; thumbnailAt=0.5
    }
    Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/studio/edits" -Headers $headers -ContentType "application/json" -Body ($edit | ConvertTo-Json -Depth 8) | Out-Null
    $deadline = (Get-Date).AddMinutes(3)
    do {
      Start-Sleep -Seconds 2
      $details = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/studio" -Headers $headers
      if ($details.jobStatus -eq "FAILED") { throw "Studio render failed: $($details.failure)" }
    } while ($details.jobStatus -ne "SUCCEEDED" -and (Get-Date) -lt $deadline)
    $edited = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId" -Headers $headers
    if ($edited.publishedRevision -ne 1 -or [Math]::Abs($edited.durationSeconds - 2) -gt 0.3) { throw "Studio did not publish the expected two-second revision." }
    $versions = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/studio/revisions" -Headers $headers
    if ($versions.Count -ne 2) { throw "The owner should retain both revisions." }
    $sharedAfter = Invoke-RestMethod -Uri "$ApiUrl/api/shares/$shareToken"
    if ($sharedAfter.publishedRevision -ne 1) { throw "The stable share link did not show the new revision." }
    $sharedVersions = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/studio/revisions?shareToken=$shareToken"
    if ($sharedVersions.Count -ne 1 -or $sharedVersions[0].revision -ne 1) { throw "Shared viewers must not receive previous media revisions." }
    $protected = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/share" -Headers $headers -ContentType 'application/json' -Body '{"password":"clip-smoke-only"}'
    $shareToken = ([uri]$protected.shareUrl).Segments[-1]
    try {
      Invoke-RestMethod -Uri "$ApiUrl/api/shares/$shareToken" | Out-Null
      throw "Password-protected link opened without a password."
    } catch { if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw } }
    $unlocked = Invoke-RestMethod -Uri "$ApiUrl/api/shares/$shareToken" -Headers @{'X-Clip-Share-Password'='clip-smoke-only'}
    if ($unlocked.id -ne $videoId) { throw "Password unlock failed." }
    Write-Output "Multipart resume, trim/stitch/crop/blur/overlay/thumbnail render, stable links, revision privacy, and password unlock passed."
  }

  Invoke-RestMethod -Method Delete -Uri "$ApiUrl/api/videos/$videoId/share" -Headers $headers | Out-Null
  try {
    Invoke-RestMethod -Uri "$ApiUrl/api/shares/$shareToken" | Out-Null
    throw "Revoked share link unexpectedly remained available."
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
  }
  Invoke-RestMethod -Method Delete -Uri "$ApiUrl/api/videos/$videoId" -Headers $headers | Out-Null
  $videoId = $null
  Write-Output "Clip local end-to-end workflow passed."
} finally {
  if ($videoId) {
    try { Invoke-RestMethod -Method Delete -Uri "$ApiUrl/api/videos/$videoId" -Headers $headers | Out-Null } catch {}
  }
  Pop-Location
}
