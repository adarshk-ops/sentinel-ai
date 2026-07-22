import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mic, MapPin, BellRing, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentinel AI – Intelligent Emergency Voice Detection" },
      { name: "description", content: "Sentinel AI silently listens for distress keywords and panic sounds when Safety Mode is on, then sends an SOS with your location to trusted contacts." },
      { property: "og:title", content: "Sentinel AI – Intelligent Emergency Voice Detection" },
      { property: "og:description", content: "Sentinel AI silently listens for distress keywords and panic sounds when Safety Mode is on, then sends an SOS with your location to trusted contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold">Sentinel AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary pulse-ring" />
            AI-powered personal safety
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
            Your voice is the SOS<br />you can't unlock a phone for.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Sentinel AI listens for distress keywords and panic sounds — only when you enable Safety Mode — and alerts your trusted contacts with your live location.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90">
              Create account
            </Link>
            <Link to="/auth" className="rounded-md border border-border bg-card px-6 py-3 font-medium hover:bg-secondary">
              Sign in
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-20 md:grid-cols-3">
          {[
            { icon: Mic, title: "Voice + Sound AI", desc: "Detects distress keywords and screams, crashes, breaking glass." },
            { icon: BellRing, title: "10-second cancel", desc: "Emergency confirmed? You always have 10 seconds to cancel." },
            { icon: MapPin, title: "Live GPS SOS", desc: "Sends a Google Maps link of your location to trusted contacts." },
            { icon: Users, title: "Up to 5 contacts", desc: "Family and friends who get notified when it counts." },
            { icon: ShieldCheck, title: "Privacy-first", desc: "Microphone is off by default. Only listens when you enable Safety Mode." },
            { icon: Shield, title: "Event history", desc: "Every SOS event and detection is logged securely." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Sentinel AI · Prototype for demonstration purposes only
      </footer>
    </div>
  );
}
