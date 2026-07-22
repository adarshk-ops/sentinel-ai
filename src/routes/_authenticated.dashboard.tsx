import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmergencyContacts, type Contact } from "@/components/EmergencyContacts";
import { SosCountdown } from "@/components/SosCountdown";
import { useSafetyMode, type DetectionEvent, type SafetyModeFailureReason } from "@/hooks/useSafetyMode";
import { toast } from "sonner";
import { LogOut, Shield, Mic, MicOff, MapPin, History } from "lucide-react";
import { recordAudioClip, transcribeClip } from "@/lib/recordClip";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Sentinel AI" },
      { name: "description", content: "Manage Safety Mode, trusted contacts, and SOS history." },
      { property: "og:title", content: "Dashboard · Sentinel AI" },
      { property: "og:description", content: "Manage Sentinel AI Safety Mode, trusted contacts, and SOS history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type SosEvent = {
  id: string; latitude: number | null; longitude: number | null;
  confidence: number | null; status: string; created_at: string;
};

type PreparedSosDetails = {
  lat: number | null;
  lng: number | null;
  transcript: string;
};

const cleanSmsNumber = (value: string) => value.replace(/(?!^)\+/g, "").replace(/[^\d+]/g, "");

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const buildSmsHref = (scheme: "sms" | "smsto", numbers: string[], message: string, numberSeparator: "," | ";", bodySeparator: "?" | "&") =>
  `${scheme}:${numbers.join(numberSeparator)}${bodySeparator}body=${encodeURIComponent(message)}`;

const getSmsHrefs = (numbers: string[], message: string) => {
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const firstNumber = numbers.slice(0, 1);

  if (isAppleMobile) {
    return unique([
      buildSmsHref("sms", numbers, message, ",", "&"),
      buildSmsHref("sms", firstNumber, message, ",", "&"),
      buildSmsHref("sms", numbers, message, ",", "?"),
    ]);
  }

  return unique([
    buildSmsHref("sms", numbers, message, ";", "?"),
    buildSmsHref("smsto", numbers, message, ";", "?"),
    buildSmsHref("sms", firstNumber, message, ";", "?"),
    buildSmsHref("smsto", firstNumber, message, ";", "?"),
    buildSmsHref("sms", numbers, message, ",", "?"),
    buildSmsHref("smsto", numbers, message, ",", "?"),
  ]);
};

const openSmsDirectly = (hrefs: string[]) => {
  const open = (url: string) => {
    try {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.style.display = "none";
      document.body.appendChild(frame);
      window.setTimeout(() => frame.remove(), 1200);
    } catch {
      // Continue with top-window fallbacks below.
    }

    try {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_top";
      link.rel = "noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // Continue with location-based fallbacks below.
    }

    try {
      window.open(url, "_top");
    } catch {
      // Continue with location-based fallbacks below.
    }

    try {
      window.top?.location.assign(url);
    } catch {
      // Cross-origin preview frames can refuse top navigation.
    }

    try {
      window.location.assign(url);
    } catch {
      try {
        window.location.href = url;
      } catch {
        // Browser refused the custom protocol.
      }
    }
  };

  hrefs.forEach((href, index) => {
    window.setTimeout(() => {
      if (index === 0 || document.visibilityState === "visible") open(href);
    }, index * 650);
  });
};

const getCurrentPositionSafe = (opts: PositionOptions) =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      opts,
    );
  });

let lastKnownPosition: { lat: number; lng: number; t: number } | null = null;

const fetchBestLocation = async (): Promise<GeolocationPosition | null> => {
  const hi = await getCurrentPositionSafe({ timeout: 12000, enableHighAccuracy: true, maximumAge: 30000 });
  if (hi) return hi;
  return getCurrentPositionSafe({ timeout: 8000, enableHighAccuracy: false, maximumAge: 120000 });
};

const prepareSosDetails = async (): Promise<PreparedSosDetails> => {
  const locationPromise = fetchBestLocation();

// Record while GPS is loading
const clip = await recordAudioClip(6000);

// Wait for GPS
const location = await locationPromise;

  let transcript = "";
  if (clip) {
    try {
      transcript = await transcribeClip(clip.blob, clip.mime);
    } catch (err) {
      console.error("Transcription failed", err);
    }
  }

  const lat = location?.coords.latitude ?? lastKnownPosition?.lat ?? null;
  const lng = location?.coords.longitude ?? lastKnownPosition?.lng ?? null;
  if (location) lastKnownPosition = { lat: location.coords.latitude, lng: location.coords.longitude, t: Date.now() };
  return { lat, lng, transcript };
};

const getMicrophoneFailureMessage = (reason: SafetyModeFailureReason) => {
  switch (reason) {
    case "insecure-context":
      return "Phone microphone is blocked because this page is opened with http://. Open the published HTTPS link, or use localhost on this same device.";
    case "permission-denied":
      return "Microphone permission is blocked. Open Chrome site settings for this page and allow Microphone, then reload.";
    case "media-unavailable":
      return "This browser cannot access the microphone here. Open the app directly in Chrome, not inside an in-app browser or preview frame.";
    case "microphone-busy":
      return "Another app is using the microphone. Close recorder/call apps, reload, and try again.";
    default:
      return "Microphone could not start on this phone. Open the HTTPS app link directly in Chrome and allow Microphone.";
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pendingDetection, setPendingDetection] = useState<DetectionEvent | null>(null);
  const [history, setHistory] = useState<SosEvent[]>([]);
  const [displayName, setDisplayName] = useState<string>("");
  const sosPrepRef = useRef<Promise<PreparedSosDetails> | null>(null);
  const sosReadyRef = useRef<PreparedSosDetails>({ lat: null, lng: null, transcript: "" });

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from("sos_events").select("*").order("created_at", { ascending: false }).limit(10);
    setHistory(data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n = (data.user?.user_metadata?.name as string) || data.user?.email || "";
      setDisplayName(n);
    });
    void loadHistory();
  }, [loadHistory]);

  const beginEmergency = useCallback((evt: DetectionEvent) => {
    if (!sosPrepRef.current) {
      toast.info("Preparing location and audio transcript for SOS…");
      sosReadyRef.current = { lat: null, lng: null, transcript: "" };
      const p = prepareSosDetails();

sosPrepRef.current = p;

p.then((result) => {
    sosReadyRef.current = result;
    console.log("SOS Ready:", result);
}).catch((err) => {
    console.error(err);
});
    setPendingDetection(evt); },[/*dependencies*/]);

  const { enabled, start, stop, transcript, level, supported, failureReason } = useSafetyMode({
    onEmergency: beginEmergency,
  });

  const cancelSos = () => {
    setPendingDetection(null);
    sosPrepRef.current = null;
    sosReadyRef.current = { lat: null, lng: null, transcript: "" };
    toast.info("SOS cancelled");
  };

  // IMPORTANT: This must run synchronously in the same tick as the user's tap
  // (or the timer's expiry) so mobile browsers accept the sms: navigation.
  const sendSos = async() => {
    const detection = pendingDetection;
    if (!detection) return;
    setPendingDetection(null);

    let details = sosReadyRef.current;

if (
    (details.lat === null || details.lng === null) &&
    sosPrepRef.current
) {
    try {
        details = await Promise.race([
            sosPrepRef.current,
            new Promise<PreparedSosDetails>((resolve) =>
                setTimeout(() => resolve(details), 4000)
            ),
        ]);
    } catch (err) {
        console.error(err);
    }
}

const {
    lat,
    lng,
    transcript: heard,
} = details;
    const mapsLink =
    lat !== null && lng !== null
        ? `https://maps.google.com/?q=${lat},${lng}`
        : lastKnownPosition
        ? `https://maps.google.com/?q=${lastKnownPosition.lat},${lastKnownPosition.lng}`
        : "Location unavailable";
    const heardLine = heard ? `\nHeard: "${heard.slice(0, 240)}"` : "";
    const msg = `EMERGENCY! ${displayName || "Someone"} may be in danger.\nLocation: ${mapsLink}\nTime: ${time}${heardLine}\n— Sent by Sentinel AI`;

    if (contacts.length > 0) {
      const numbers = contacts.map((c) => cleanSmsNumber(c.contact_number)).filter(Boolean);
      if (numbers.length > 0) {
        // Fire the SMS handoff IMMEDIATELY, still inside the click gesture.
        openSmsDirectly(getSmsHrefs(numbers, msg));
        toast.info("Opening Messages app…");
      } else {
        toast.warning("SOS logged, but the saved contact numbers are invalid.");
      }
    } else {
      toast.warning("SOS logged, but no trusted contacts to notify.");
    }

    // Everything below is background bookkeeping — no awaits before the sms: navigation.
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: event, error } = await supabase.from("sos_events").insert({
        user_id: userData.user.id,
        latitude: lat, longitude: lng,
        confidence: detection.confidence,
        status: "triggered",
      }).select().single();
      if (error || !event) { toast.error(error?.message ?? "SOS log failed"); return; }
      await supabase.from("audio_logs").insert({
        sos_event_id: event.id,
        keyword: detection.keyword,
        sound: detection.sound ?? (heard ? `heard: ${heard.slice(0, 180)}` : null),
        confidence: detection.confidence,
      });
      void loadHistory();
    })();

    sosPrepRef.current = null;
  };


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const toggleSafety = async () => {
    if (enabled) stop();
    else {
      const result = await start();
      if (!result.ok) toast.error(getMicrophoneFailureMessage(result.reason), { duration: 9000 });
      else {
        // Pre-warm GPS permission and cache a fix so SOS has a location ready.
        void fetchBestLocation().then((p) => {
          if (p) lastKnownPosition = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
          else toast.warning("Location unavailable. Enable Location for this site so SOS can include your map link.");
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold">Sentinel AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
            <button onClick={signOut} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {/* Safety Mode Card */}
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex flex-col items-center gap-4">
            <button
              onClick={toggleSafety}
              className={`flex h-32 w-32 items-center justify-center rounded-full transition-all ${
                enabled ? "bg-primary pulse-ring" : "bg-secondary hover:bg-secondary/80"
              }`}
              aria-label="Toggle Safety Mode"
            >
              {enabled ? <Mic className="h-12 w-12 text-primary-foreground" /> : <MicOff className="h-12 w-12 text-muted-foreground" />}
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">
                Safety Mode {enabled ? "ON" : "OFF"}
              </h1>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {enabled
                  ? "Listening for distress keywords and panic voice sounds. Microphone is active."
                  : "Microphone is off. Enable Safety Mode to start monitoring."}
              </p>
              {failureReason && !enabled && (
                <p className="mt-3 max-w-md rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {getMicrophoneFailureMessage(failureReason)}
                </p>
              )}
              {!supported && (
                <p className="mt-2 text-sm text-danger">Speech transcript is unavailable here, so Sentinel AI is using microphone sound detection.</p>
              )}
            </div>

            {enabled && (
              <div className="mt-2 w-full max-w-md rounded-lg border border-border bg-background p-4 text-left">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 items-end gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i}
                        className="w-1 rounded-t bg-primary listening-bar"
                        style={{ height: `${Math.max(15, level * 100)}%`, animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Audio level {(level * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Live transcript</div>
                <p className="mt-1 min-h-[1.5rem] text-sm">{transcript || "…"}</p>
              </div>
            )}

            {contacts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add at least one emergency contact so Sentinel AI can notify them.
              </p>
            )}
          </div>
        </section>

        <EmergencyContacts onChange={setContacts} />

        {/* History */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">SOS history</h2>
          </div>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No SOS events yet. When Sentinel AI detects an emergency, it appears here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {new Date(h.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Confidence {((h.confidence ?? 0) * 100).toFixed(0)}% · Status {h.status}
                    </div>
                  </div>
                  {h.latitude !== null && h.longitude !== null && (
                    <a
                      href={`https://maps.google.com/?q=${h.latitude},${h.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="h-4 w-4" /> Map
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {pendingDetection && (
        <SosCountdown
          detection={pendingDetection}
          onCancel={cancelSos}
          onConfirm={sendSos}
        />
      )}
    </div>
  );
}
