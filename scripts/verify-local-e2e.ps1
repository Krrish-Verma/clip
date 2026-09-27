param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$Token = $env:CLIP_TEST_TOKEN
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
  docker compose run --rm --no-deps -v $mount --entrypoint ffmpeg worker -y -f lavfi -i "testsrc=size=640x360:rate=24" -f lavfi -i "sine=frequency=880" -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac /out/clip-fixture.mp4
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $fixture)) { throw "Could not generate the media fixture." }

  $size = (Get-Item -LiteralPath $fixture).Length
  $created = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos" -Headers $headers -ContentType "application/json" -Body (@{
    title = "Local end-to-end fixture"; mimeType = "video/mp4"; sizeBytes = $size
  } | ConvertTo-Json)
  $videoId = $created.videoId

  Invoke-WebRequest -Method Put -Uri $created.uploadUrl -ContentType "video/mp4" -InFile $fixture | Out-Null
  Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/complete" -Headers $headers | Out-Null

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 2
    $video = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId" -Headers $headers
    if ($video.status -eq "FAILED") { throw "FFmpeg processing failed." }
  } while ($video.status -ne "READY" -and (Get-Date) -lt $deadline)
  if ($video.status -ne "READY") { throw "Timed out waiting for processing." }

  $playback = Invoke-RestMethod -Uri "$ApiUrl/api/videos/$videoId/playback" -Headers $headers
  Invoke-WebRequest -Method Head -Uri $playback.playbackUrl | Out-Null
  $share = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/videos/$videoId/share" -Headers $headers
  $shared = Invoke-RestMethod -Uri ($share.shareUrl -replace '^http://127\.0\.0\.1:3000/s/', "$ApiUrl/api/shares/")
  if ($shared.id -ne $videoId) { throw "Share lookup returned the wrong video." }

  Invoke-RestMethod -Method Delete -Uri "$ApiUrl/api/videos/$videoId/share" -Headers $headers | Out-Null
  try {
    Invoke-RestMethod -Uri ($share.shareUrl -replace '^http://127\.0\.0\.1:3000/s/', "$ApiUrl/api/shares/") | Out-Null
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
