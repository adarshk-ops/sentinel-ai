// Free automated emergency actions that don't need a paid backend.

let alarmCtx: AudioContext | null = null;
let alarmStop: (() => void) | null = null;

export function startAlarm(durationMs = 20000) {
  stopAlarm();
  try {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    alarmCtx = new Ctor();
    const ctx = alarmCtx;
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.connect(gain);
    osc.start();

    const start = ctx.currentTime;
    // Siren sweep 600 -> 1400 Hz, repeating.
    for (let t = 0; t < durationMs / 1000; t += 0.7) {
      osc.frequency.setValueAtTime(600, start + t);
      osc.frequency.linearRampToValueAtTime(1400, start + t + 0.35);
      osc.frequency.linearRampToValueAtTime(600, start + t + 0.7);
    }
    const timeout = window.setTimeout(() => stopAlarm(), durationMs);
    alarmStop = () => {
      window.clearTimeout(timeout);
      try { osc.stop(); } catch { /* noop */ }
      try { ctx.close(); } catch { /* noop */ }
    };
  } catch (err) {
    console.error("Alarm failed", err);
  }
}

export function stopAlarm() {
  if (alarmStop) { alarmStop(); alarmStop = null; }
  alarmCtx = null;
}

export function vibrateSOS() {
  try {
    // SOS in morse: ... --- ...
    navigator.vibrate?.([200, 100, 200, 100, 200, 300, 500, 100, 500, 100, 500, 300, 200, 100, 200, 100, 200]);
  } catch { /* noop */ }
}

export function speakAlert(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.volume = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

export function buildWhatsAppLink(phone: string, message: string) {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function buildMailtoLink(emails: string[], subject: string, body: string) {
  const to = emails.join(",");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function shareSOS(message: string) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: "EMERGENCY SOS", text: message });
    return true;
  } catch {
    return false;
  }
}
