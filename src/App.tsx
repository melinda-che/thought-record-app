import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Trash2, BookOpen, Check, Heart, Mic } from 'lucide-react';

type FormState = {
  situation: string;
  feelings: string[];
  intensity: number;
  thought: string;
  distortions: string[];
  balanced: string;
  newIntensity: number;
  includeGratitude: boolean;
  gratitude: string;
};

type Entry = FormState & { id: string; date: number };

// Storage helper for localStorage
const storageHelper = {
  async list(prefix: string) {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return { keys };
  },

  async get(key: string) {
    const value = localStorage.getItem(key);
    return value ? { value } : null;
  },

  async set(key: string, value: string) {
    localStorage.setItem(key, value);
    return { key, value };
  },

  async delete(key: string) {
    localStorage.removeItem(key);
    return { key, deleted: true };
  }
};

const AFFIRMATIONS = [
  "Growth happens in the space between a difficult thought and a kinder response.",
  "You just practiced the art of stepping back. That's real strength.",
  "Every time you question a harsh thought, you're rewiring old patterns.",
  "This moment of pause—between reactive and responsive—is where wisdom grows.",
  "You're learning to be curious about your thoughts instead of controlled by them.",
  "The fact that you're here, doing this work, says everything about your resilience.",
  "Small shifts in perspective can create profound changes in how you feel.",
  "You just chose awareness over autopilot. That choice matters more than you know.",
  "Every thought record is practice for the next difficult moment life brings.",
  "You're not trying to think positive—you're learning to think more clearly.",
];

const DISTORTIONS = [
  { id: 'catastrophizing', name: 'Catastrophizing', desc: 'Imagining the worst possible outcome' },
  { id: 'all-or-nothing', name: 'All-or-nothing', desc: 'Seeing things in black and white, no middle ground' },
  { id: 'mind-reading', name: 'Mind reading', desc: 'Assuming you know what others are thinking' },
  { id: 'fortune-telling', name: 'Fortune telling', desc: 'Predicting the future negatively' },
  { id: 'personalization', name: 'Personalizing', desc: 'Taking responsibility for things outside your control' },
  { id: 'should', name: '"Should" statements', desc: 'Rigid rules about how things must be' },
  { id: 'emotional', name: 'Emotional reasoning', desc: 'Believing something is true because it feels true' },
  { id: 'filtering', name: 'Mental filter', desc: 'Focusing only on the negatives, ignoring positives' },
  { id: 'overgeneralizing', name: 'Overgeneralizing', desc: 'Seeing one event as a never-ending pattern' },
  { id: 'labeling', name: 'Labeling', desc: 'Defining yourself or others by one trait or event' },
];

const FEELINGS = ['Anxious', 'Sad', 'Angry', 'Ashamed', 'Frustrated', 'Overwhelmed', 'Guilty', 'Lonely', 'Scared', 'Hurt'];

function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<any>(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  const SR = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) t += e.results[i][0].transcript;
      }
      if (t.trim()) callbackRef.current(t.trim());
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
  }, [SR]);

  if (!SR) return null;

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
    } else {
      try { rec.start(); setIsListening(true); } catch { /* noop */ }
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      title={isListening ? 'Stop recording' : 'Speak to fill this field'}
      className="absolute bottom-3 right-3 p-2 rounded-full transition-all active:scale-95"
      style={{
        background: isListening ? '#5C7C6F' : 'rgba(255, 255, 255, 0.85)',
        color: isListening ? '#F5EFE6' : '#5C7C6F',
        border: `1px solid ${isListening ? '#5C7C6F' : 'rgba(139, 127, 110, 0.25)'}`,
        boxShadow: isListening ? '0 0 0 4px rgba(92, 124, 111, 0.2)' : 'none',
      }}
    >
      <Mic size={14} />
    </button>
  );
}

const initialForm: FormState = {
  situation: '',
  feelings: [],
  intensity: 5,
  thought: '',
  distortions: [],
  balanced: '',
  newIntensity: 5,
  includeGratitude: false,
  gratitude: '',
};

export default function App() {
  const [view, setView] = useState('home');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const result = await storageHelper.list('entries:');
      if (!result || !result.keys) {
        setLoading(false);
        return;
      }
      const loaded = await Promise.all(
        result.keys.map(async (key) => {
          try {
            const r = await storageHelper.get(key);
            return r ? JSON.parse(r.value) : null;
          } catch {
            return null;
          }
        })
      );
      setEntries(loaded.filter(Boolean).sort((a, b) => b.date - a.date));
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    const entry = { ...form, id: `${Date.now()}`, date: Date.now() };
    try {
      await storageHelper.set(`entries:${entry.id}`, JSON.stringify(entry));
      setEntries([entry, ...entries]);
      setForm(initialForm);
      setStep(0);
      setView('done');
    } catch (e) {
      console.error('Save error:', e);
    }
  }

  async function deleteEntry(id: string) {
    try {
      await storageHelper.delete(`entries:${id}`);
      setEntries(entries.filter((e) => e.id !== id));
      setSelectedEntry(null);
      setView('history');
    } catch (e) {
      console.error('Delete error:', e);
    }
  }

  function toggleFeeling(f: string) {
    setForm({
      ...form,
      feelings: form.feelings.includes(f) ? form.feelings.filter((x) => x !== f) : [...form.feelings, f],
    });
  }

  function toggleDistortion(id: string) {
    setForm({
      ...form,
      distortions: form.distortions.includes(id) ? form.distortions.filter((x) => x !== id) : [...form.distortions, id],
    });
  }

  const canAdvance = () => {
    if (step === 0) return form.situation.trim().length > 0;
    if (step === 1) return form.feelings.length > 0;
    if (step === 2) return form.thought.trim().length > 0;
    if (step === 3) return true;
    if (step === 4) return form.balanced.trim().length > 0;
    return false;
  };

  return (
    <div className="min-h-screen w-full" style={{ background: '#F5EFE6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=DM+Sans:wght@400;500;600&display=swap');
        
        .serif { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .serif-italic { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-optical-sizing: auto; }
        
        .noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.1 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          background: #D4CBB8;
          border-radius: 2px;
        }
        input[type="range"]::-moz-range-track {
          height: 4px;
          background: #D4CBB8;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 24px;
          width: 24px;
          margin-top: -10px;
          border-radius: 50%;
          background: #5C7C6F;
          border: 3px solid #F5EFE6;
          box-shadow: 0 2px 6px rgba(44, 40, 37, 0.2);
        }
        input[type="range"]::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #5C7C6F;
          border: 3px solid #F5EFE6;
          box-shadow: 0 2px 6px rgba(44, 40, 37, 0.2);
        }

        textarea:focus, input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(92, 124, 111, 0.25);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>

      <div className="fixed inset-0 noise opacity-[0.35] pointer-events-none" />

      <div className="relative max-w-xl mx-auto px-5 py-8 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <button
            onClick={() => { setView('home'); setStep(0); setForm(initialForm); setSelectedEntry(null); }}
            className="text-left"
          >
            <div className="serif-italic text-xl" style={{ color: '#2C2825', letterSpacing: '-0.01em' }}>
              still waters
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] mt-0.5" style={{ color: '#8B7F6E' }}>
              a thought record
            </div>
          </button>
          {view === 'home' && entries.length > 0 && (
            <button
              onClick={() => setView('history')}
              className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] px-3 py-2 rounded-full"
              style={{ color: '#5C7C6F', background: 'rgba(92, 124, 111, 0.08)' }}
            >
              <BookOpen size={13} /> {entries.length}
            </button>
          )}
        </header>

        {/* HOME */}
        {view === 'home' && (
          <div className="fade-in">
            <h1 className="serif text-4xl leading-[1.1] mb-4" style={{ color: '#2C2825', letterSpacing: '-0.02em' }}>
              When a thought <span className="serif-italic">loops</span>,<br />slow it down.
            </h1>
            <p className="text-[15px] leading-relaxed mb-10" style={{ color: '#5C5248' }}>
              This is a quiet place to untangle what you're feeling. Walk through a thought, notice its shape, and find a steadier view. Your entries stay here for you to revisit.
            </p>

            <button
              onClick={() => setView('new')}
              className="w-full py-4 rounded-2xl text-[15px] font-medium transition-all active:scale-[0.98]"
              style={{ background: '#5C7C6F', color: '#F5EFE6', boxShadow: '0 8px 24px -8px rgba(92, 124, 111, 0.5)' }}
            >
              Begin a thought record
            </button>

            {entries.length > 0 && (
              <div className="mt-10">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Recent
                </div>
                <div className="space-y-2">
                  {entries.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => { setSelectedEntry(e); setView('entry'); }}
                      className="w-full text-left p-4 rounded-xl transition-all active:scale-[0.99]"
                      style={{ background: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(139, 127, 110, 0.15)' }}
                    >
                      <div className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: '#8B7F6E' }}>
                        {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-sm line-clamp-1" style={{ color: '#2C2825' }}>
                        {e.situation}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entries.length === 0 && !loading && (
              <div className="mt-12 p-5 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.4)' }}>
                <div className="serif-italic text-sm mb-2" style={{ color: '#5C7C6F' }}>a gentle note</div>
                <p className="text-[13px] leading-relaxed" style={{ color: '#5C5248' }}>
                  This tool is a companion, not a substitute for a therapist. If you're struggling heavily, reaching out to a professional is a kindness to yourself.
                </p>
              </div>
            )}
          </div>
        )}

        {/* NEW ENTRY FLOW */}
        {view === 'new' && (
          <div className="fade-in">
            {/* Progress */}
            <div className="flex gap-1.5 mb-8">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all duration-500"
                  style={{ background: i <= step ? '#5C7C6F' : 'rgba(139, 127, 110, 0.2)' }}
                />
              ))}
            </div>

            {/* Step 0: Situation */}
            {step === 0 && (
              <div className="fade-in">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Step 1 of 5
                </div>
                <h2 className="serif text-3xl leading-[1.15] mb-3" style={{ color: '#2C2825' }}>
                  What <span className="serif-italic">happened?</span>
                </h2>
                <p className="text-sm mb-6" style={{ color: '#5C5248' }}>
                  Describe the moment plainly. Just the facts of what you saw or heard.
                </p>
                <div className="relative">
                  <textarea
                    value={form.situation}
                    onChange={(e) => setForm({ ...form, situation: e.target.value })}
                    placeholder="My manager gave me quick feedback on my report and walked off without saying more..."
                    className="w-full p-4 pr-14 rounded-xl text-[15px] leading-relaxed resize-none"
                    style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(139, 127, 110, 0.2)', color: '#2C2825', minHeight: '140px' }}
                  />
                  <VoiceInputButton onTranscript={(t) => setForm((f) => ({ ...f, situation: f.situation + (f.situation ? ' ' : '') + t }))} />
                </div>
              </div>
            )}

            {/* Step 1: Feelings */}
            {step === 1 && (
              <div className="fade-in">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Step 2 of 5
                </div>
                <h2 className="serif text-3xl leading-[1.15] mb-3" style={{ color: '#2C2825' }}>
                  How are you <span className="serif-italic">feeling?</span>
                </h2>
                <p className="text-sm mb-6" style={{ color: '#5C5248' }}>
                  Pick whatever fits. More than one is fine.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {FEELINGS.map((f) => {
                    const active = form.feelings.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFeeling(f)}
                        className="px-4 py-2 rounded-full text-sm transition-all active:scale-95"
                        style={{
                          background: active ? '#5C7C6F' : 'rgba(255, 255, 255, 0.5)',
                          color: active ? '#F5EFE6' : '#2C2825',
                          border: `1px solid ${active ? '#5C7C6F' : 'rgba(139, 127, 110, 0.25)'}`,
                        }}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>

                <div className="p-5 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.5)' }}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[13px]" style={{ color: '#5C5248' }}>How strong is it?</span>
                    <span className="serif text-2xl" style={{ color: '#5C7C6F' }}>{form.intensity}<span className="text-sm" style={{ color: '#8B7F6E' }}>/10</span></span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={form.intensity}
                    onChange={(e) => setForm({ ...form, intensity: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[11px] mt-1" style={{ color: '#8B7F6E' }}>
                    <span>barely there</span>
                    <span>overwhelming</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Automatic thought */}
            {step === 2 && (
              <div className="fade-in">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Step 3 of 5
                </div>
                <h2 className="serif text-3xl leading-[1.15] mb-3" style={{ color: '#2C2825' }}>
                  What went <span className="serif-italic">through your mind?</span>
                </h2>
                <p className="text-sm mb-6" style={{ color: '#5C5248' }}>
                  The exact thought, in your own voice. The one running on loop.
                </p>
                <div className="relative">
                  <textarea
                    value={form.thought}
                    onChange={(e) => setForm({ ...form, thought: e.target.value })}
                    placeholder="They think my work isn't good enough. I'm going to get fired..."
                    className="w-full p-4 pr-14 rounded-xl text-[15px] leading-relaxed resize-none"
                    style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(139, 127, 110, 0.2)', color: '#2C2825', minHeight: '140px' }}
                  />
                  <VoiceInputButton onTranscript={(t) => setForm((f) => ({ ...f, thought: f.thought + (f.thought ? ' ' : '') + t }))} />
                </div>
              </div>
            )}

            {/* Step 3: Distortions */}
            {step === 3 && (
              <div className="fade-in">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Step 4 of 5
                </div>
                <h2 className="serif text-3xl leading-[1.15] mb-3" style={{ color: '#2C2825' }}>
                  Notice the <span className="serif-italic">pattern.</span>
                </h2>
                <p className="text-sm mb-6" style={{ color: '#5C5248' }}>
                  Thoughts often fall into predictable shapes. Do any of these fit? Optional — tap any that ring true.
                </p>
                <div className="space-y-2">
                  {DISTORTIONS.map((d) => {
                    const active = form.distortions.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => toggleDistortion(d.id)}
                        className="w-full p-4 rounded-xl text-left transition-all active:scale-[0.99]"
                        style={{
                          background: active ? 'rgba(92, 124, 111, 0.12)' : 'rgba(255, 255, 255, 0.5)',
                          border: `1px solid ${active ? '#5C7C6F' : 'rgba(139, 127, 110, 0.2)'}`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: active ? '#5C7C6F' : 'transparent', border: `1.5px solid ${active ? '#5C7C6F' : 'rgba(139, 127, 110, 0.4)'}` }}
                          >
                            {active && <Check size={12} color="#F5EFE6" strokeWidth={3} />}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium mb-0.5" style={{ color: '#2C2825' }}>{d.name}</div>
                            <div className="text-[12px]" style={{ color: '#8B7F6E' }}>{d.desc}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Balanced thought + optional gratitude */}
            {step === 4 && (
              <div className="fade-in">
                <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: '#8B7F6E' }}>
                  Step 5 of 5
                </div>
                <h2 className="serif text-3xl leading-[1.15] mb-3" style={{ color: '#2C2825' }}>
                  A <span className="serif-italic">steadier</span> view.
                </h2>
                <p className="text-sm mb-5" style={{ color: '#5C5248' }}>
                  Not forced positivity — just a more complete picture. What would you tell a friend thinking this?
                </p>

                <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.4)', border: '1px dashed rgba(139, 127, 110, 0.3)' }}>
                  <div className="text-[10px] uppercase tracking-[0.2em] mb-1.5" style={{ color: '#8B7F6E' }}>The original thought</div>
                  <div className="text-[13px] italic leading-relaxed" style={{ color: '#5C5248' }}>"{form.thought}"</div>
                </div>

                <div className="relative mb-6">
                  <textarea
                    value={form.balanced}
                    onChange={(e) => setForm({ ...form, balanced: e.target.value })}
                    placeholder="Quick feedback doesn't mean the work was bad. My manager is busy, and one interaction isn't the whole story..."
                    className="w-full p-4 pr-14 rounded-xl text-[15px] leading-relaxed resize-none"
                    style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(139, 127, 110, 0.2)', color: '#2C2825', minHeight: '120px' }}
                  />
                  <VoiceInputButton onTranscript={(t) => setForm((f) => ({ ...f, balanced: f.balanced + (f.balanced ? ' ' : '') + t }))} />
                </div>

                <div className="p-5 rounded-xl mb-8" style={{ background: 'rgba(255, 255, 255, 0.5)' }}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[13px]" style={{ color: '#5C5248' }}>How strong is the feeling now?</span>
                    <span className="serif text-2xl" style={{ color: '#5C7C6F' }}>{form.newIntensity}<span className="text-sm" style={{ color: '#8B7F6E' }}>/10</span></span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={form.newIntensity}
                    onChange={(e) => setForm({ ...form, newIntensity: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                {/* Gratitude toggle */}
                <button
                  onClick={() => setForm({ ...form, includeGratitude: !form.includeGratitude })}
                  className="w-full p-4 rounded-xl text-left mb-4 transition-all active:scale-[0.99]"
                  style={{ 
                    background: form.includeGratitude ? 'rgba(92, 124, 111, 0.1)' : 'rgba(255, 255, 255, 0.4)', 
                    border: `1px solid ${form.includeGratitude ? '#5C7C6F' : 'rgba(139, 127, 110, 0.2)'}` 
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: form.includeGratitude ? '#5C7C6F' : 'transparent', border: `1.5px solid ${form.includeGratitude ? '#5C7C6F' : 'rgba(139, 127, 110, 0.4)'}` }}
                    >
                      {form.includeGratitude && <Check size={12} color="#F5EFE6" strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#2C2825' }}>Add a moment of gratitude</div>
                      <div className="text-[12px]" style={{ color: '#8B7F6E' }}>Ground yourself in something good from today</div>
                    </div>
                  </div>
                </button>

                {/* Gratitude input when toggled */}
                {form.includeGratitude && (
                  <div className="fade-in">
                    <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>
                      Something you're grateful for today
                    </div>
                    <div className="relative">
                      <textarea
                        value={form.gratitude}
                        onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
                        placeholder="The way the morning light looked through my window, a kind text from my friend, making it through a difficult conversation..."
                        className="w-full p-4 pr-14 rounded-xl text-[15px] leading-relaxed resize-none"
                        style={{ background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(139, 127, 110, 0.2)', color: '#2C2825', minHeight: '80px' }}
                      />
                      <VoiceInputButton onTranscript={(t) => setForm((f) => ({ ...f, gratitude: f.gratitude + (f.gratitude ? ' ' : '') + t }))} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-10">
              <button
                onClick={() => step === 0 ? setView('home') : setStep(step - 1)}
                className="flex items-center justify-center gap-1 px-5 py-3.5 rounded-2xl text-sm"
                style={{ color: '#5C5248', background: 'rgba(255, 255, 255, 0.5)' }}
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => step === 4 ? saveEntry() : setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex-1 flex items-center justify-center gap-1 py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{
                  background: canAdvance() ? '#5C7C6F' : 'rgba(92, 124, 111, 0.3)',
                  color: '#F5EFE6',
                  cursor: canAdvance() ? 'pointer' : 'not-allowed',
                }}
              >
                {step === 4 ? 'Save' : 'Continue'} {step !== 4 && <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {view === 'done' && (
          <div className="fade-in text-center pt-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ background: 'rgba(92, 124, 111, 0.15)' }}>
              <Heart size={24} color="#5C7C6F" strokeWidth={1.5} />
            </div>
            <h2 className="serif text-3xl leading-[1.1] mb-3" style={{ color: '#2C2825' }}>
              <span className="serif-italic">Well done.</span>
            </h2>
            
            <div className="max-w-sm mx-auto mb-8 p-6 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.5)' }}>
              <p className="text-sm italic leading-relaxed" style={{ color: '#5C5248' }}>
                "{AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]}"
              </p>
            </div>
            
            <button
              onClick={() => setView('home')}
              className="px-8 py-3.5 rounded-2xl text-sm font-medium"
              style={{ background: '#5C7C6F', color: '#F5EFE6' }}
            >
              Return home
            </button>
          </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <div className="fade-in">
            <h2 className="serif text-3xl mb-2" style={{ color: '#2C2825' }}>
              Your <span className="serif-italic">entries</span>
            </h2>
            <p className="text-sm mb-8" style={{ color: '#5C5248' }}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} so far.
            </p>
            <div className="space-y-3">
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedEntry(e); setView('entry'); }}
                  className="w-full text-left p-5 rounded-xl transition-all active:scale-[0.99]"
                  style={{ background: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(139, 127, 110, 0.15)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: '#8B7F6E' }}>
                      {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#5C7C6F' }}>
                        <span>{e.intensity}</span>
                        <span>→</span>
                        <span className="font-semibold">{e.newIntensity}</span>
                      </div>
                      {e.gratitude && e.gratitude.trim() && (
                        <Heart size={12} color="#A67C6B" strokeWidth={1.5} fill="rgba(166, 124, 107, 0.2)" />
                      )}
                    </div>
                  </div>
                  <div className="text-sm line-clamp-2 mb-2" style={{ color: '#2C2825' }}>
                    {e.situation}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {e.feelings.slice(0, 3).map((f) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(139, 127, 110, 0.15)', color: '#5C5248' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ENTRY DETAIL */}
        {view === 'entry' && selectedEntry && (
          <div className="fade-in">
            <button
              onClick={() => setView(entries.length > 3 ? 'history' : 'home')}
              className="flex items-center gap-1 text-sm mb-6"
              style={{ color: '#5C5248' }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>
              {new Date(selectedEntry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <h2 className="serif text-2xl mb-8" style={{ color: '#2C2825' }}>
              {selectedEntry.situation}
            </h2>

            <div className="space-y-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>Felt</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedEntry.feelings.map((f) => (
                    <span key={f} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(139, 127, 110, 0.15)', color: '#2C2825' }}>
                      {f}
                    </span>
                  ))}
                </div>
                <div className="text-sm" style={{ color: '#5C5248' }}>
                  Intensity: <span style={{ color: '#2C2825' }}>{selectedEntry.intensity}/10</span>
                  <span className="mx-2">→</span>
                  After reframing: <span className="font-semibold" style={{ color: '#5C7C6F' }}>{selectedEntry.newIntensity}/10</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>The original thought</div>
                <div className="p-4 rounded-xl italic" style={{ background: 'rgba(255, 255, 255, 0.5)', color: '#2C2825' }}>
                  "{selectedEntry.thought}"
                </div>
              </div>

              {selectedEntry.distortions.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>Patterns noticed</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntry.distortions.map((id) => {
                      const d = DISTORTIONS.find((x) => x.id === id);
                      return d ? (
                        <span key={id} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(92, 124, 111, 0.15)', color: '#5C7C6F' }}>
                          {d.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>The steadier view</div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(92, 124, 111, 0.1)', color: '#2C2825' }}>
                  {selectedEntry.balanced}
                </div>
              </div>

              {selectedEntry.gratitude && selectedEntry.gratitude.trim() && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: '#8B7F6E' }}>Grateful for</div>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.5)', color: '#2C2825' }}>
                    {selectedEntry.gratitude}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { if (confirm('Delete this entry?')) deleteEntry(selectedEntry.id); }}
              className="mt-10 flex items-center gap-1.5 text-xs"
              style={{ color: '#A67C6B' }}
            >
              <Trash2 size={12} /> Delete entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}