import { useCallback, useEffect, useRef, useState } from "react";
import { scanForKeyword, combineConfidence } from "@/lib/detection";

export type DetectionEvent = {
  keyword: string | null;
  keywordConfidence: number;
  sound: string | null;
  soundConfidence: number;
  confidence: number;
};

type Options = {
  onEmergency: (evt: DetectionEvent) => void;
};

export type SafetyModeFailureReason =
  | "insecure-context"
  | "media-unavailable"
  | "permission-denied"
  | "microphone-busy"
  | "unknown";

export type SafetyModeStartResult =
  | { ok: true }
  | { ok: false; reason: SafetyModeFailureReason };

// Minimal typings for Web Speech API
type SR = {
  new (): SpeechRecognitionInstance;
};
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: ((e: unknown) => void) | null;
};

export function useSafetyMode({ onEmergency }: Options) {
  const [enabled, setEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0); // 0-1 audio level
  const [supported, setSupported] = useState(true);
  const [failureReason, setFailureReason] = useState<SafetyModeFailureReason | null>(null);
  const [lastDetection, setLastDetection] = useState<DetectionEvent | null>(null);
  const cooldownRef = useRef(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLevelUpdateRef = useRef(0);
  const lastScreamRef = useRef<{ conf: number; t: number }>({ conf: 0, t: 0 });
  const panicVoiceRef = useRef<{ startedAt: number; lastActiveAt: number; peak: number }>({ startedAt: 0, lastActiveAt: 0, peak: 0 });

  const trigger = useCallback((evt: DetectionEvent) => {
    const now = Date.now();
    if (now < cooldownRef.current) return;
    cooldownRef.current = now + 15000;
    setLastDetection(evt);
    onEmergency(evt);
  }, [onEmergency]);

  const stop = useCallback(() => {
    setEnabled(false);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    lastScreamRef.current = { conf: 0, t: 0 };
    panicVoiceRef.current = { startedAt: 0, lastActiveAt: 0, peak: 0 };
    setLevel(0);
    setTranscript("");
  }, []);

  const start = useCallback(async (): Promise<SafetyModeStartResult> => {
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const SRCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSupported(Boolean(SRCtor));
    setFailureReason(null);

    try {
      if (!window.isSecureContext) {
        setFailureReason("insecure-context");
        return { ok: false, reason: "insecure-context" };
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setFailureReason("media-unavailable");
        return { ok: false, reason: "media-unavailable" };
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        // overall loudness
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length / 255;
        const now = performance.now();
        if (now - lastLevelUpdateRef.current > 120) {
          lastLevelUpdateRef.current = now;
          setLevel(avg);
        }

        // Panic audio heuristics: mobile browsers can expose microphone audio but
        // fail to return Web Speech transcripts inside preview/webview shells.
        // Use sustained human-voice energy as a fallback, with the 10s cancel
        // countdown still preventing accidental SOS sends.
        const sampleRate = ctx.sampleRate;
        const binHz = sampleRate / 2 / buf.length;
        const averageBand = (fromHz: number, toHz: number) => {
          const lo = Math.max(0, Math.floor(fromHz / binHz));
          const hi = Math.min(buf.length, Math.ceil(toHz / binHz));
          let bandSum = 0, bandCount = 0;
          for (let i = lo; i < hi; i++) { bandSum += buf[i]; bandCount++; }
          return bandCount ? bandSum / bandCount / 255 : 0;
        };
        const voiceBandAvg = averageBand(250, 3400);
        const screamBandAvg = averageBand(1000, 4500);

        if (screamBandAvg > 0.3 && avg > 0.16) {
          const conf = Math.min(0.95, 0.58 + screamBandAvg * 0.75 + avg * 0.25);
          if (now - lastScreamRef.current.t < 400) {
            lastScreamRef.current = { conf: Math.max(lastScreamRef.current.conf, conf), t: now };
            if (lastScreamRef.current.conf > 0.76) {
              const kwConf = 0; // no keyword this cycle
              const combined = combineConfidence(kwConf, lastScreamRef.current.conf);
              trigger({
                keyword: null, keywordConfidence: 0,
                sound: "panic sound", soundConfidence: lastScreamRef.current.conf,
                confidence: Math.max(combined, lastScreamRef.current.conf),
              });
              lastScreamRef.current = { conf: 0, t: 0 };
            }
          } else {
            lastScreamRef.current = { conf, t: now };
          }
        }

        const panicVoiceActive = avg > 0.12 && voiceBandAvg > 0.18;
        if (panicVoiceActive) {
          const voiceConfidence = Math.min(0.9, 0.52 + avg * 0.7 + voiceBandAvg * 0.8);
          const previous = panicVoiceRef.current;
          const startedAt = previous.startedAt && now - previous.lastActiveAt < 280 ? previous.startedAt : now;
          panicVoiceRef.current = {
            startedAt,
            lastActiveAt: now,
            peak: Math.max(previous.peak, voiceConfidence),
          };

          if (now - startedAt > 850 && panicVoiceRef.current.peak >= 0.72) {
            trigger({
              keyword: null, keywordConfidence: 0,
              sound: "panic voice", soundConfidence: panicVoiceRef.current.peak,
              confidence: panicVoiceRef.current.peak,
            });
            panicVoiceRef.current = { startedAt: 0, lastActiveAt: 0, peak: 0 };
          }
        } else if (now - panicVoiceRef.current.lastActiveAt > 350) {
          panicVoiceRef.current = { startedAt: 0, lastActiveAt: 0, peak: 0 };
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      if (SRCtor) {
        const rec = new SRCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.maxAlternatives = 3;
        rec.onresult = (evt: unknown) => {
          const e = evt as { resultIndex: number; results: { [i: number]: { [j: number]: { transcript: string; confidence?: number }; isFinal?: boolean; length: number }; length: number } };
          let fullText = "";
          let recentText = "";
          for (let i = 0; i < e.results.length; i++) {
            const result = e.results[i];
            const bestChunk = result[0]?.transcript ?? "";
            fullText += bestChunk + " ";
            if (i >= (e.resultIndex ?? 0)) {
              for (let alt = 0; alt < Math.min(result.length ?? 1, 3); alt++) {
                recentText += (result[alt]?.transcript ?? "") + " ";
              }
            }
          }
          setTranscript(fullText.trim().slice(-200));
          const hit = scanForKeyword(recentText);
          if (hit) {
            const soundConf = Math.max(lastScreamRef.current.conf, panicVoiceRef.current.peak);
            const combined = combineConfidence(hit.confidence, soundConf);
            trigger({
              keyword: hit.keyword, keywordConfidence: hit.confidence,
              sound: soundConf > 0.5 ? "panic voice" : null, soundConfidence: soundConf,
              confidence: Math.max(combined, hit.confidence),
            });
          }
        };
        rec.onerror = () => { /* auto-restart via onend */ };
        rec.onend = () => {
          // auto-restart while enabled
          if (recognitionRef.current) {
            window.setTimeout(() => {
              if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch { /* noop */ }
              }
            }, 250);
          }
        };
        recognitionRef.current = rec;
        try { rec.start(); } catch { /* noop */ }
      }
      setEnabled(true);
      return { ok: true };
    } catch (err) {
      stop();
      const name = err instanceof DOMException ? err.name : "";
      const reason: SafetyModeFailureReason =
        name === "NotAllowedError" || name === "SecurityError"
          ? "permission-denied"
          : name === "NotReadableError" || name === "AbortError"
            ? "microphone-busy"
            : "unknown";
      setFailureReason(reason);
      return { ok: false, reason };
    }
  }, [stop, trigger]);

  useEffect(() => () => stop(), [stop]);

  return { enabled, start, stop, transcript, level, supported, failureReason, lastDetection };
}
