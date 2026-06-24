"use client";

import { useState, useRef, useEffect } from "react";

type RecognitionResultEvent = {
  resultIndex: number;
  results: { [index: number]: { 0: { transcript: string }; isFinal: boolean }; length: number };
};

type Mode = "guided" | "freeform" | "sessiontype";

const SESSION_TYPES = [
  { id: "mld", label: "MLD", description: "Manual Lymphatic Drainage" },
  { id: "therapeutic", label: "Therapeutic", description: "Swedish / Deep Tissue" },
  { id: "prenatal", label: "Prenatal", description: "Prenatal / Postpartum" },
  { id: "postop", label: "Post-Op", description: "Post-surgical recovery" },
];

const SESSION_PROMPTS: Record<string, string[]> = {
  mld: ["Fluid congestion noted?", "Node response?", "Fibrosis present?", "Compression recommended?", "Hydration discussed?", "Rebooking?"],
  therapeutic: ["Areas of tension?", "Pressure used?", "Techniques applied?", "ROM changes?", "Stretching done?", "Rebooking?"],
  prenatal: ["Gestational week?", "Positioning used?", "Areas of focus?", "Client comfort?", "Home care given?", "Rebooking?"],
  postop: ["Surgery type/date?", "Incision status?", "Swelling noted?", "Fibrosis present?", "PT/MD clearance?", "Rebooking?"],
  default: ["Fluid congestion?", "Areas of tension?", "Techniques used?", "Client response?", "Home care?", "Rebooking?"],
};

const SESSION_PLACEHOLDERS: Record<string, string> = {
  mld: "e.g. client post-op 3 weeks, L axillary congestion, full body MLD, fluid responded well, hydration card given, rebook next week...",
  therapeutic: "e.g. biweekly therapeutic, medium/firm pressure, full body, upper traps tight R side, client felt relief, rebook 2 weeks...",
  prenatal: "e.g. prenatal 28 wks, L side-lying, focus on low back and hips, hip flexors tight, client comfortable throughout, rebook 2 weeks...",
  postop: "e.g. post BBL 6 weeks, cleared by Dr. Harris, fibrosis bilateral thighs, cupping + MLD, tissue softening, rebook Friday...",
  default: "Dictate or type your session notes freely — include what you observed, what you did, and any follow-up plans...",
};

// C: forest green palette
const C = {
  bg: "#faf8f5",
  card: "#ffffff",
  border: "#e2ddd6",
  muted: "#f0ede8",
  green: "#2d4a38",
  greenMid: "#4a7c5f",
  greenLight: "#7a9e87",
  greenPale: "#eef4f0",
  greenBorder: "#c9ddd0",
  text: "#2d2825",
  textMid: "#4a6355",
  textLight: "#7a7068",
  textFaint: "#b0a89e",
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("sessiontype");
  const [soapNote, setSoapNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Mode A — Guided fields
  const [sessionType, setSessionType] = useState("");
  const [clientReported, setClientReported] = useState("");
  const [observed, setObserved] = useState("");
  const [performed, setPerformed] = useState("");
  const [plan, setPlan] = useState("");

  // Mode B — Free-form
  const [freeNotes, setFreeNotes] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Mode C — Session type + free-form
  const [selectedType, setSelectedType] = useState("");
  const [typeNotes, setTypeNotes] = useState("");
  const [typeListening, setTypeListening] = useState(false);
  const typeRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setVoiceSupported(true);

    const makeRecognition = (setter: React.Dispatch<React.SetStateAction<string>>, setListening: (v: boolean) => void) => {
      const r = new SpeechRecognition();
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";
      r.onresult = (event: RecognitionResultEvent) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
        }
        if (final) setter((prev) => (prev ? prev.trim() + " " + final : final));
      };
      r.onerror = () => setListening(false);
      r.onend = () => setListening(false);
      return r;
    };

    recognitionRef.current = makeRecognition(setFreeNotes, setIsListening);
    typeRecognitionRef.current = makeRecognition(setTypeNotes, setTypeListening);
  }, []);

  const toggleVoice = (ref: React.MutableRefObject<any>, listening: boolean, setListening: (v: boolean) => void, clearOutput: () => void) => {
    if (!ref.current) return;
    if (listening) {
      ref.current.stop();
      setListening(false);
    } else {
      clearOutput();
      ref.current.start();
      setListening(true);
    }
  };

  const buildNotes = (): string => {
    if (mode === "guided") {
      const parts = [];
      if (sessionType) parts.push(`Session type: ${sessionType}`);
      if (clientReported.trim()) parts.push(`Client reported: ${clientReported}`);
      if (observed.trim()) parts.push(`Therapist observed/palpated: ${observed}`);
      if (performed.trim()) parts.push(`Techniques performed: ${performed}`);
      if (plan.trim()) parts.push(`Plan/rebooking: ${plan}`);
      return parts.join("\n");
    }
    if (mode === "freeform") return freeNotes;
    if (mode === "sessiontype") {
      const type = SESSION_TYPES.find((t) => t.id === selectedType);
      const prefix = type ? `Session type: ${type.label} (${type.description})\n` : "";
      return prefix + typeNotes;
    }
    return "";
  };

  const canGenerate = (): boolean => {
    if (mode === "guided") return !!(clientReported.trim() || observed.trim() || performed.trim());
    if (mode === "freeform") return !!freeNotes.trim();
    if (mode === "sessiontype") return !!typeNotes.trim();
    return false;
  };

  const handleGenerate = async () => {
    const notes = buildNotes();
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate note.");
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream.");
      let first = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setSoapNote((prev) => prev + text);
        if (first) {
          first = false;
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSoapNote("");
    setError("");
    setFreeNotes("");
    setTypeNotes("");
    setClientReported("");
    setObserved("");
    setPerformed("");
    setPlan("");
    setSessionType("");
    setSelectedType("");
  };

  const handleCopy = async () => {
    if (!soapNote) return;
    await navigator.clipboard.writeText(soapNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const appendPrompt = (prompt: string, setter: (v: string) => void, current: string) => {
    setter(current ? current.trim() + " " + prompt + " " : prompt + " ");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
      {/* Header */}
      <header style={{ backgroundColor: C.muted, borderBottom: `1px solid ${C.border}` }} className="px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div style={{ backgroundColor: C.greenLight }} className="w-9 h-9 rounded-xl flex items-center justify-center">
            <LeafIcon />
          </div>
          <div>
            <h1 style={{ color: C.green }} className="text-lg font-semibold leading-none">SOAP Snap</h1>
            <p style={{ color: C.greenLight }} className="text-xs mt-0.5">For massage therapists</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Mode switcher */}
        <div>
          <p style={{ color: C.textLight }} className="text-xs text-center mb-3 font-medium uppercase tracking-widest">Try all three input styles</p>
          <div style={{ backgroundColor: C.muted, border: `1px solid ${C.border}` }} className="rounded-2xl p-1 grid grid-cols-3 gap-1">
            {([
              { id: "sessiontype", label: "Session Type", sub: "Pick type, then dictate" },
              { id: "freeform", label: "Free-form", sub: "Type or dictate freely" },
              { id: "guided", label: "Guided Fields", sub: "Fill in each section" },
            ] as { id: Mode; label: string; sub: string }[]).map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setSoapNote(""); setError(""); }}
                style={mode === m.id
                  ? { backgroundColor: C.green, color: "#fff" }
                  : { color: C.textMid }}
                className="rounded-xl py-2.5 px-2 text-center transition-colors"
              >
                <div className="text-sm font-semibold leading-tight">{m.label}</div>
                <div className="text-xs opacity-70 mt-0.5 leading-tight">{m.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── MODE C: Session Type ── */}
        {mode === "sessiontype" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <p style={{ color: C.green }} className="text-sm font-semibold mb-2">What type of session?</p>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    style={selectedType === t.id
                      ? { backgroundColor: C.green, color: "#fff", border: `1px solid ${C.green}` }
                      : { backgroundColor: C.greenPale, color: C.textMid, border: `1px solid ${C.greenBorder}` }}
                    className="rounded-xl py-3 px-4 text-left transition-colors"
                  >
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ color: C.green }} className="text-sm font-semibold mb-2">Your session notes</p>
              <textarea
                value={typeNotes}
                onChange={(e) => setTypeNotes(e.target.value)}
                placeholder={SESSION_PLACEHOLDERS[selectedType] || SESSION_PLACEHOLDERS.default}
                rows={5}
                style={{ border: `1px solid ${C.border}`, color: C.text }}
                className="w-full resize-none rounded-xl p-3 text-base focus:outline-none focus:ring-2 placeholder:text-stone-400"
              />
              {typeListening && <p style={{ color: "#c0392b" }} className="text-xs text-center mt-1">Listening... tap mic to stop</p>}
            </div>

            {selectedType && (
              <div>
                <p style={{ color: C.textLight }} className="text-xs font-medium mb-2">Quick reminders — tap to add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(SESSION_PROMPTS[selectedType] || SESSION_PROMPTS.default).map((p) => (
                    <button
                      key={p}
                      onClick={() => appendPrompt(p, setTypeNotes, typeNotes)}
                      style={{ backgroundColor: C.greenPale, color: C.textMid, border: `1px solid ${C.greenBorder}` }}
                      className="text-xs rounded-full px-3 py-1 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <GenerateRow
              voiceSupported={voiceSupported}
              listening={typeListening}
              onToggleVoice={() => toggleVoice(typeRecognitionRef, typeListening, setTypeListening, () => setSoapNote(""))}
              onGenerate={handleGenerate}
              loading={loading}
              canGenerate={canGenerate()}
            />
          </div>
        )}

        {/* ── MODE B: Free-form ── */}
        {mode === "freeform" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <p style={{ color: C.green }} className="text-sm font-semibold mb-1">Brain dump your notes</p>
              <p style={{ color: C.textLight }} className="text-xs mb-3">Type or dictate freely — just like texting yourself. Claude handles the rest.</p>
              <textarea
                value={freeNotes}
                onChange={(e) => setFreeNotes(e.target.value)}
                placeholder="e.g. client post-op 3 wks L hip, lot of fluid in inguinal, full body MLD, responded well, gave hydration card, rebook friday..."
                rows={7}
                style={{ border: `1px solid ${C.border}`, color: C.text }}
                className="w-full resize-none rounded-xl p-3 text-base focus:outline-none focus:ring-2 placeholder:text-stone-400"
              />
              {isListening && <p style={{ color: "#c0392b" }} className="text-xs text-center mt-1">Listening... tap mic to stop</p>}
            </div>

            <div>
              <p style={{ color: C.textLight }} className="text-xs font-medium mb-2">Forgot something? Tap to add a reminder:</p>
              <div className="flex flex-wrap gap-1.5">
                {SESSION_PROMPTS.default.map((p) => (
                  <button
                    key={p}
                    onClick={() => appendPrompt(p, setFreeNotes, freeNotes)}
                    style={{ backgroundColor: C.greenPale, color: C.textMid, border: `1px solid ${C.greenBorder}` }}
                    className="text-xs rounded-full px-3 py-1"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <GenerateRow
              voiceSupported={voiceSupported}
              listening={isListening}
              onToggleVoice={() => toggleVoice(recognitionRef, isListening, setIsListening, () => setSoapNote(""))}
              onGenerate={handleGenerate}
              loading={loading}
              canGenerate={canGenerate()}
            />
          </div>
        )}

        {/* ── MODE A: Guided fields ── */}
        {mode === "guided" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }} className="rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <p style={{ color: C.green }} className="text-sm font-semibold mb-2">Session type <span style={{ color: C.textFaint }} className="font-normal">(optional)</span></p>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSessionType(sessionType === t.label ? "" : t.label)}
                    style={sessionType === t.label
                      ? { backgroundColor: C.green, color: "#fff", border: `1px solid ${C.green}` }
                      : { backgroundColor: C.greenPale, color: C.textMid, border: `1px solid ${C.greenBorder}` }}
                    className="rounded-xl py-2.5 px-3 text-left text-sm font-medium transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {[
              { label: "What did the client report?", sub: "Symptoms, goals, history, how they felt coming in", value: clientReported, set: setClientReported, placeholder: "e.g. rings feeling tight, joint stiffness, came in for post-op drainage, said last session helped..." },
              { label: "What did you observe or palpate?", sub: "Tissue findings, posture, edema, ROM, skin condition", value: observed, set: setObserved, placeholder: "e.g. fluid in L axillary nodes, fibrosis medial thigh, no redness at incision site, tissue responding..." },
              { label: "What did you perform?", sub: "Techniques, areas worked, tools used, client response", value: performed, set: setPerformed, placeholder: "e.g. full body MLD, cupping R thigh, abdominal drainage, client tolerated well, fluid began to move..." },
              { label: "Plan & rebooking", sub: "Follow-up, home care, next appointment", value: plan, set: setPlan, placeholder: "e.g. rebook in 1 week, hydration card given, continue compression, follow up with PT..." },
            ].map((field) => (
              <div key={field.label}>
                <label style={{ color: C.green }} className="text-sm font-semibold block mb-0.5">{field.label}</label>
                <p style={{ color: C.textLight }} className="text-xs mb-2">{field.sub}</p>
                <textarea
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  rows={2}
                  style={{ border: `1px solid ${C.border}`, color: C.text }}
                  className="w-full resize-none rounded-xl p-3 text-sm focus:outline-none focus:ring-2 placeholder:text-stone-400"
                />
              </div>
            ))}

            <GenerateRow
              voiceSupported={false}
              listening={false}
              onToggleVoice={() => {}}
              onGenerate={handleGenerate}
              loading={loading}
              canGenerate={canGenerate()}
            />
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }} className="rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {soapNote && (
          <div ref={resultRef} style={{ backgroundColor: C.card, border: `1px solid ${C.greenBorder}` }} className="rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 style={{ color: C.green }} className="font-semibold">Your SOAP Note</h3>
                <p style={{ color: C.greenLight }} className="text-xs mt-0.5">Ready to copy into your chart</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy} style={{ backgroundColor: C.green, color: "#fff" }} className="text-sm font-medium rounded-lg px-4 py-2">
                  {copied ? "Copied!" : "Copy note"}
                </button>
                <button onClick={handleReset} style={{ backgroundColor: C.muted, color: C.textMid }} className="text-sm font-medium rounded-lg px-4 py-2">
                  New note
                </button>
              </div>
            </div>
            <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }} className="rounded-xl p-4">
              <pre style={{ color: C.text }} className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {soapNote}
              </pre>
            </div>
          </div>
        )}

        <footer className="text-center pb-6">
          <p style={{ color: C.textFaint }} className="text-xs">
            Notes are processed for formatting only — do not include client names or identifying information.
          </p>
        </footer>
      </main>
    </div>
  );
}

function GenerateRow({ voiceSupported, listening, onToggleVoice, onGenerate, loading, canGenerate }: {
  voiceSupported: boolean;
  listening: boolean;
  onToggleVoice: () => void;
  onGenerate: () => void;
  loading: boolean;
  canGenerate: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {voiceSupported && (
        <button
          onClick={onToggleVoice}
          style={listening
            ? { backgroundColor: "#c0392b", color: "#fff" }
            : { backgroundColor: "#eef4f0", color: "#7a9e87", border: "1px solid #c9ddd0" }}
          className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition-colors ${listening ? "animate-pulse" : ""}`}
          aria-label={listening ? "Stop recording" : "Start recording"}
        >
          <MicIcon />
        </button>
      )}
      <button
        onClick={onGenerate}
        disabled={loading || !canGenerate}
        style={loading || !canGenerate
          ? { backgroundColor: "#d5cfc7", color: "#a09890" }
          : { backgroundColor: "#2d4a38", color: "#fff" }}
        className="flex-1 font-medium rounded-xl py-3 px-4 transition-colors active:scale-[0.99]"
      >
        {loading ? "Generating your note..." : "Generate SOAP Note"}
      </button>
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
