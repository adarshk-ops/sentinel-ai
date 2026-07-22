// Record a short audio clip from the mic and return a Blob.
export async function recordAudioClip(ms = 6000): Promise<{ blob: Blob; mime: string } | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }
  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  const mimeType =
    (typeof MediaRecorder !== "undefined" &&
      preferred.find((t) => MediaRecorder.isTypeSupported?.(t))) ||
    "";
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  await new Promise((r) => setTimeout(r, ms));
  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  const type = recorder.mimeType || mimeType || "audio/webm";
  const blob = new Blob(chunks, { type });
  if (blob.size < 1024) return null;
  return { blob, mime: type };
}

export async function transcribeClip(blob: Blob, mime: string): Promise<string> {
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("file", new File([blob], `sos.${ext}`, { type: mime }));
  const resp = await fetch("/api/transcribe", { method: "POST", body: fd });
  if (!resp.ok) throw new Error(`Transcription failed (${resp.status})`);
  const data = (await resp.json()) as { text?: string };
  return (data.text ?? "").trim();
}
