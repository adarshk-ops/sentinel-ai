import { useEffect, useRef, useState } from "react";
import type { DetectionEvent } from "@/hooks/useSafetyMode";
import { AlertTriangle } from "lucide-react";

type Props = {
  detection: DetectionEvent;
  seconds?: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SosCountdown({ detection, seconds = 10, onCancel, onConfirm }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const onConfirmRef = useRef(onConfirm);
  const confirmedRef = useRef(false);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const confirmOnce = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirmRef.current();
  };

  useEffect(() => {
    if (remaining <= 0) { confirmOnce(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 pulse-ring">
          <AlertTriangle className="h-8 w-8 text-danger" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Emergency detected</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {detection.keyword ? <>Distress word: <b className="text-foreground">"{detection.keyword}"</b></> : "Panic sound detected"}
          {detection.sound && detection.keyword ? " + " : " "}
          {detection.sound && detection.keyword ? <b className="text-foreground">{detection.sound}</b> : null}
        </p>
        <div className="mt-2 text-xs text-muted-foreground">
          Confidence: {(detection.confidence * 100).toFixed(0)}%
        </div>

        <div className="mt-6 text-6xl font-bold tabular-nums text-danger">{remaining}</div>
        <p className="mt-1 text-sm text-muted-foreground">Sending SOS in {remaining}s…</p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border bg-secondary py-3 font-medium hover:bg-secondary/70"
          >
            Cancel — I'm safe
          </button>
          <button
            onClick={confirmOnce}
            className="flex-1 rounded-md bg-danger py-3 font-medium text-danger-foreground hover:opacity-90"
          >
            Send now
          </button>
        </div>
      </div>
    </div>
  );
}
