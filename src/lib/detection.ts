// Distress detection utilities

export const DISTRESS_KEYWORDS = [
  "help", "help me", "save me", "save us",
  "fire", "accident", "emergency", "call police",
  "sos", "danger", "stop", "leave me alone",
  "somebody help", "someone help", "please help",
];

export function scanForKeyword(transcript: string): { keyword: string; confidence: number } | null {
  const text = transcript.toLowerCase();
  for (const kw of DISTRESS_KEYWORDS) {
    if (text.includes(kw)) {
      // simple confidence: longer keyword = higher confidence, base 0.75
      const conf = Math.min(0.98, 0.75 + kw.length * 0.015);
      return { keyword: kw, confidence: conf };
    }
  }
  return null;
}

// Combined confidence engine
export function combineConfidence(keywordConf: number, soundConf: number): number {
  // weighted average biased toward the stronger signal
  const max = Math.max(keywordConf, soundConf);
  const avg = (keywordConf + soundConf) / 2;
  return Math.min(0.99, max * 0.6 + avg * 0.4);
}

export const EMERGENCY_THRESHOLD = 0.7;
