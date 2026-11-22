export type Point = { x: number; y: number };
export type CaptureOptions = {
  mode: "screen" | "camera" | "both";
  microphone: boolean;
  microphoneId?: string;
  cameraId?: string;
  height: number;
};
export type Capture = {
  stream: MediaStream;
  sources: MediaStream[];
  paths: Point[][];
  blurs: { x: number; y: number; width: number; height: number }[];
  bubble: Point;
  pointer: Point | null;
  screenshot: () => Promise<Blob>;
  stop: () => void;
};

// All annotations are drawn into the actual captured frames, not only the preview.
export async function createCapture(options: CaptureOptions): Promise<Capture> {
  const sources: MediaStream[] = [];
  const elements: HTMLVideoElement[] = [];
  let audio: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const cleanup = () => {
    stopped = true;
    if (timer) clearInterval(timer);
    sources.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    elements.forEach((v) => {
      v.pause();
      v.srcObject = null;
    });
    void audio?.close().catch(() => {});
  };
  try {
    const display =
      options.mode !== "camera"
        ? await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true,
          })
        : null;
    if (display) sources.push(display);
    const camera =
      options.mode !== "screen"
        ? await navigator.mediaDevices.getUserMedia({
            video: {
              ...(options.cameraId
                ? { deviceId: { exact: options.cameraId } }
                : {}),
              height: { ideal: options.height },
            },
            audio: false,
          })
        : null;
    if (camera) sources.push(camera);
    const mic = options.microphone
      ? await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(options.microphoneId
              ? { deviceId: { exact: options.microphoneId } }
              : {}),
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
      : null;
    if (mic) sources.push(mic);
    async function playable(stream: MediaStream) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      elements.push(video);
      await video.play();
      return video;
    }
    const main = await playable(display || camera!);
    const face = camera && display ? await playable(camera) : null;
    const canvas = document.createElement("canvas");
    const nativeHeight = main.videoHeight || options.height;
    canvas.height = Math.round(Math.min(options.height, nativeHeight) / 2) * 2;
    canvas.width =
      Math.round(
        (((main.videoWidth || 1280) / nativeHeight) * canvas.height) / 2,
      ) * 2;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx)
      throw new Error("Your browser could not create the recording canvas.");
    const stream = canvas.captureStream(30);
    sources.push(stream);
    const audioSources = [display, mic].filter(
      (s): s is MediaStream => !!s?.getAudioTracks().length,
    );
    if (audioSources.length) {
      audio = new AudioContext();
      await audio.resume();
      const destination = audio.createMediaStreamDestination();
      for (const source of audioSources)
        audio
          .createMediaStreamSource(new MediaStream(source.getAudioTracks()))
          .connect(destination);
      destination.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const result: Capture = {
      stream,
      sources,
      paths: [],
      blurs: [],
      bubble: { x: 0.84, y: 0.78 },
      pointer: null,
      screenshot: () =>
        new Promise((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob ? resolve(blob) : reject(new Error("Screenshot failed.")),
            "image/png",
          ),
        ),
      stop: cleanup,
    };
    const draw = () => {
      if (stopped) return;
      const w = canvas.width,
        h = canvas.height;
      ctx.drawImage(main, 0, 0, w, h);
      for (const rect of result.blurs) {
        const x = rect.x * w,
          y = rect.y * h,
          rw = rect.width * w,
          rh = rect.height * h;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, rw, rh);
        ctx.clip();
        ctx.filter = "blur(22px)";
        ctx.drawImage(main, 0, 0, w, h);
        ctx.restore();
      }
      if (face) {
        const radius = h * 0.13,
          x = result.bubble.x * w,
          y = result.bubble.y * h;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();
        const size = Math.min(face.videoWidth, face.videoHeight);
        ctx.drawImage(
          face,
          (face.videoWidth - size) / 2,
          (face.videoHeight - size) / 2,
          size,
          size,
          x - radius,
          y - radius,
          radius * 2,
          radius * 2,
        );
        ctx.restore();
        ctx.strokeStyle = "#d9edbf";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "#b3f75b";
      ctx.lineWidth = Math.max(3, h / 180);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const path of result.paths) {
        ctx.beginPath();
        path.forEach((p, i) =>
          i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h),
        );
        ctx.stroke();
      }
      if (result.pointer) {
        ctx.fillStyle = "#d9edbf66";
        ctx.beginPath();
        ctx.arc(
          result.pointer.x * w,
          result.pointer.y * h,
          h * 0.025,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    };
    draw();
    if (main.requestVideoFrameCallback) {
      const frame = () => {
        if (!stopped) {
          draw();
          main.requestVideoFrameCallback(frame);
        }
      };
      main.requestVideoFrameCallback(frame);
    } else timer = setInterval(draw, 1000 / 30);
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
