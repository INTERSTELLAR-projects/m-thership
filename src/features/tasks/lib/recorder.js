// Records the mic until stop() is called (no silence cut-off) and reports a live input level 0..1.
const MAX_MS = 10 * 60 * 1000;

function pickMime() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

export const recorderSupported = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

export async function startRecorder({ onLevel, onAutoStop } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });

  const mime = pickMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  recorder.start(1000);

  let ctx = null;
  let raf = 0;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      if (onLevel) onLevel(Math.min(1, rms * 4.5));
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (error) {
    /* level meter is optional */
  }

  const timer = window.setTimeout(() => onAutoStop && onAutoStop(), MAX_MS);

  const cleanup = () => {
    window.clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    if (ctx) ctx.close().catch(() => {});
    stream.getTracks().forEach((track) => track.stop());
    if (onLevel) onLevel(0);
  };

  return {
    // Resolves with the full recording as one Blob.
    stop: () =>
      new Promise((resolve) => {
        if (recorder.state === "inactive") {
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" }));
          return;
        }
        recorder.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
    }
  };
}
