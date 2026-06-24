"use client";

import { useState, useRef, useEffect } from "react";

type RecognitionResultEvent = {
  resultIndex: number;
  results: { [index: number]: { 0: { transcript: string }; isFinal: boolean }; length: number };
};

const EXAMPLES = [
  "R axillary congestion, L SCM tight, post-op 3 weeks, full body MLD, hydration discussed, rebook 2 weeks",
  "Prenatal 32 wks, low back tension, side-lying, Swedish + myofascial L hip, client felt relief, suggested pillow support",
  "Lipedema stage 2, bilateral legs, MLD 60 min, bandaging discussed, compression recommended, follow up 1 week",
  "Deep tissue upper back, R trapezius trigger points, heat applied, ROM improved, client exercises given",
];

const STEPS = [
  {
    number: "1",
    title: "Jot your notes",
    description: "Type or dictate your shorthand right after the session — abbreviations, observations, techniques used.",
  },
  {
    number: "2",
    title: "Generate your SOAP note",
    description: "Claude AI expands your shorthand into a clean, professional clinical note in seconds.",
  },
  {
    number: "3",
    title: "Copy & chart",
    description: "Paste the formatted note directly into your client chart or EHR system.",
  },
];

export default function Home() {
  const [notes, setNotes] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: RecognitionResultEvent) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          }
        }
        if (finalTranscript) {
          setNotes((prev) => (prev ? prev.trim() + " " + finalTranscript : finalTranscript));
        }
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setSoapNote("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleGenerate = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    setError("");
    setSoapNote("");
    try {
      const res = await fetch("/api/generate-soap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate note.");
      setSoapNote(data.soapNote);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!soapNote) return;
    await navigator.clipboard.writeText(soapNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setNotes("");
    setSoapNote("");
    setError("");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf8f5" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#f0ede8", borderBottom: "1px solid #e2ddd6" }} className="px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div style={{ backgroundColor: "#7a9e87" }} className="w-9 h-9 rounded-xl flex items-center justify-center">
            <LeafIcon />
          </div>
          <div>
            <h1 style={{ color: "#2d4a38" }} className="text-lg font-semibold leading-none">SOAP Snap</h1>
            <p style={{ color: "#7a9e87" }} className="text-xs mt-0.5">For massage therapists</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-10">

        {/* Hero */}
        <section className="text-center space-y-3">
          <h2 style={{ color: "#2d4a38" }} className="text-3xl sm:text-4xl font-semibold leading-tight">
            Shorthand in.<br />Professional SOAP note out.
          </h2>
          <p style={{ color: "#7a7068" }} className="text-base sm:text-lg max-w-xl mx-auto">
            Dictate or type your post-session notes in plain language. SOAP Snap formats them into a clean, chart-ready clinical note instantly.
          </p>
        </section>

        {/* How it works */}
        <section>
          <h3 style={{ color: "#2d4a38" }} className="text-sm font-semibold uppercase tracking-widest mb-5 text-center">How it works</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((step) => (
              <div key={step.number} style={{ backgroundColor: "#f0ede8", border: "1px solid #e2ddd6" }} className="rounded-2xl p-5">
                <div style={{ backgroundColor: "#7a9e87", color: "#fff" }} className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mb-3">
                  {step.number}
                </div>
                <h4 style={{ color: "#2d4a38" }} className="font-semibold mb-1">{step.title}</h4>
                <p style={{ color: "#7a7068" }} className="text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you can include */}
        <section style={{ backgroundColor: "#eef4f0", border: "1px solid #c9ddd0" }} className="rounded-2xl p-5 sm:p-6">
          <h3 style={{ color: "#2d4a38" }} className="font-semibold mb-3">What you can include in your notes</h3>
          <ul style={{ color: "#4a6355" }} className="text-sm space-y-1.5">
            {[
              "Techniques used - MLD, Swedish, deep tissue, myofascial, prenatal, etc.",
              "Areas of focus or tension - e.g. R SCM tight, L hip restriction",
              "Client condition - post-op, lipedema, lymphedema, prenatal week",
              "Session outcomes - ROM improved, client reported relief, reduced congestion",
              "Home care or follow-up - hydration, compression, rebooking timeframe",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span style={{ color: "#7a9e87" }} className="mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Example chips */}
        <section>
          <h3 style={{ color: "#2d4a38" }} className="font-semibold mb-3">Try an example</h3>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => { setNotes(example); setSoapNote(""); setError(""); }}
                style={{ backgroundColor: "#fff", border: "1px solid #e2ddd6", color: "#4a6355", textAlign: "left" }}
                className="rounded-xl px-4 py-3 text-sm hover:border-green-400 transition-colors leading-relaxed"
              >
                "{example}"
              </button>
            ))}
          </div>
        </section>

        {/* Input card */}
        <section style={{ backgroundColor: "#fff", border: "1px solid #e2ddd6" }} className="rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 style={{ color: "#2d4a38" }} className="font-semibold mb-3">Your session notes</h3>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Type your shorthand notes here, or tap the mic to dictate..."
            rows={5}
            style={{ border: "1px solid #d5cfc7", color: "#2d2825" }}
            className="w-full resize-none rounded-xl p-3 text-base focus:outline-none focus:ring-2 placeholder:text-stone-400"
          />

          {isListening && (
            <p style={{ color: "#c0392b" }} className="text-xs text-center mt-2">Listening... tap the mic to stop</p>
          )}

          <div className="flex items-center gap-3 mt-3">
            {voiceSupported && (
              <button
                onClick={toggleListening}
                style={isListening
                  ? { backgroundColor: "#c0392b", color: "#fff" }
                  : { backgroundColor: "#eef4f0", color: "#7a9e87", border: "1px solid #c9ddd0" }
                }
                className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition-colors ${isListening ? "animate-pulse" : ""}`}
                aria-label={isListening ? "Stop recording" : "Start recording"}
              >
                <MicIcon />
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading || !notes.trim()}
              style={loading || !notes.trim()
                ? { backgroundColor: "#d5cfc7", color: "#a09890" }
                : { backgroundColor: "#2d4a38", color: "#fff" }
              }
              className="flex-1 font-medium rounded-xl py-3 px-4 transition-colors active:scale-[0.99]"
            >
              {loading ? "Generating your note..." : "Generate SOAP Note"}
            </button>
          </div>
        </section>

        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }} className="rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {soapNote && (
          <section ref={resultRef} style={{ backgroundColor: "#fff", border: "1px solid #c9ddd0" }} className="rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: "#2d4a38" }} className="font-semibold">Your SOAP Note</h3>
                <p style={{ color: "#7a9e87" }} className="text-xs mt-0.5">Ready to copy into your chart</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  style={{ backgroundColor: "#2d4a38", color: "#fff" }}
                  className="text-sm font-medium rounded-lg px-4 py-2"
                >
                  {copied ? "Copied!" : "Copy note"}
                </button>
                <button
                  onClick={handleReset}
                  style={{ backgroundColor: "#f0ede8", color: "#4a6355" }}
                  className="text-sm font-medium rounded-lg px-4 py-2"
                >
                  New note
                </button>
              </div>
            </div>
            <div style={{ backgroundColor: "#faf8f5", border: "1px solid #e2ddd6" }} className="rounded-xl p-4">
              <pre style={{ color: "#2d2825" }} className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {soapNote}
              </pre>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pb-6">
          <p style={{ color: "#b0a89e" }} className="text-xs">
            Notes are processed for formatting only — do not include client names or identifying information.
          </p>
        </footer>

      </main>
    </div>
  );
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
