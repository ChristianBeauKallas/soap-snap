"use client";

import { useState, useRef, useEffect } from "react";

type RecognitionResultEvent = {
  resultIndex: number;
  results: { [index: number]: { 0: { transcript: string }; isFinal: boolean }; length: number };
};

export default function Home() {
  const [notes, setNotes] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

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

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

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
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate note.");
      }
      setSoapNote(data.soapNote);
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
    <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-6 sm:py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-teal-900">SOAP Snap</h1>
        <p className="text-sm text-stone-500 mt-1">
          Shorthand in. Professional SOAP note out.
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-5 flex flex-col gap-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. R axillary congestion, L SCM tight, post-op 3 weeks, full body MLD, hydration discussed, rebook 2 weeks"
          rows={5}
          className="w-full resize-none rounded-xl border border-stone-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-600 placeholder:text-stone-400"
        />

        <div className="flex items-center gap-3">
          {voiceSupported && (
            <button
              onClick={toggleListening}
              className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
                isListening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-teal-50 text-teal-700 border border-teal-200"
              }`}
              aria-label={isListening ? "Stop recording" : "Start recording"}
            >
              <MicIcon />
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !notes.trim()}
            className="flex-1 bg-teal-700 disabled:bg-stone-300 text-white font-medium rounded-xl py-3 px-4 transition-colors active:scale-[0.99]"
          >
            {loading ? "Generating..." : "Generate SOAP Note"}
          </button>
        </div>

        {isListening && (
          <p className="text-xs text-red-600 text-center">Listening... tap the mic to stop</p>
        )}
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
          {error}
        </div>
      )}

      {soapNote && (
        <div className="mt-5 bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-teal-900">SOAP Note</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="text-sm font-medium bg-teal-700 text-white rounded-lg px-3 py-1.5"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleReset}
                className="text-sm font-medium bg-stone-100 text-stone-600 rounded-lg px-3 py-1.5"
              >
                New
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-800 leading-relaxed">
            {soapNote}
          </pre>
        </div>
      )}

      <footer className="mt-auto pt-8 text-center text-xs text-stone-400">
        Notes are sent for formatting only — avoid entering client names or identifying details.
      </footer>
    </main>
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
