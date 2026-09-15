/**
 * Browser-side video assembly: turns the generated scene images and narration
 * into a single playable file using canvas capture + MediaRecorder.
 * Only ever called from a click handler, never during SSR.
 */

export type RenderScene = { imageUrl: string; audioUrl: string | null };

const WIDTH = 1280;
const HEIGHT = 720;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A scene image could not be loaded."));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  zoom: number,
): void {
  const scale = Math.max(WIDTH / img.width, HEIGHT / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
}

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export async function renderVideo(
  scenes: RenderScene[],
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't assemble the video. Try Chrome on desktop.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't assemble the video.");

  const audioCtx = new AudioContext();
  const destination = audioCtx.createMediaStreamDestination();

  // Decode narration up front so scene lengths are known.
  const buffers: Array<AudioBuffer | null> = [];
  for (const scene of scenes) {
    if (!scene.audioUrl) {
      buffers.push(null);
      continue;
    }
    try {
      const bytes = await (await fetch(scene.audioUrl)).arrayBuffer();
      buffers.push(await audioCtx.decodeAudioData(bytes));
    } catch {
      buffers.push(null);
    }
  }

  const images = await Promise.all(scenes.map((s) => loadImage(s.imageUrl)));

  const stream = canvas.captureStream(30);
  for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);

  const chunks: BlobPart[] = [];
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  await audioCtx.resume();
  recorder.start();

  const total = scenes.reduce((sum, _s, i) => sum + Math.max(buffers[i]?.duration ?? 4, 2.5), 0);
  let elapsed = 0;

  for (let i = 0; i < scenes.length; i += 1) {
    const buffer = buffers[i] ?? null;
    const duration = Math.max(buffer?.duration ?? 4, 2.5);

    if (buffer) {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.start();
    }

    const start = performance.now();
    const image = images[i]!;
    await new Promise<void>((resolve) => {
      const step = () => {
        const t = (performance.now() - start) / 1000;
        if (t >= duration) {
          resolve();
          return;
        }
        drawCover(ctx, image, 1 + (t / duration) * 0.08);
        onProgress?.(Math.min(0.99, (elapsed + t) / total));
        requestAnimationFrame(step);
      };
      step();
    });

    elapsed += duration;
  }

  recorder.stop();
  const blob = await finished;
  await audioCtx.close();
  onProgress?.(1);
  return blob;
}
