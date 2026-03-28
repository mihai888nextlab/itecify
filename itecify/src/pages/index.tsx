import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Terminal, Users, Cpu, Shield, Zap, Play, Bot, Clock, Database, Code2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { theme as C } from '@/styles/theme';

function LandingPageContent() {
  const router = useRouter();
  const { addToast } = useToast();
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const handleLaunch = () => {
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text }}>
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto" style={{ borderBottom: `1px solid ${C.border}20` }}>
        <div className="text-2xl font-black tracking-tighter" style={{ color: C.text }}>
          iTEC<span style={{ color: C.blue }}>ify</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium" style={{ color: C.muted }}>
          <a href="#features" className="hover:text-white transition">Funcționalități</a>
          <a href="#sandbox" className="hover:text-white transition">Sandbox</a>
          <a href="#security" className="hover:text-white transition">Securitate</a>
        </div>
        <Button onClick={handleLaunch} isLoading={isCreatingSession}>
          Lansează App <Play size={16} />
        </Button>
      </nav>

      <header className="pt-24 pb-16 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ border: `1px solid ${C.blue}50`, backgroundColor: `${C.blue}15`, color: C.blue }}>
          <Zap size={14} /> iTEC 2026: Viitorul este aici
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight" style={{ color: C.text }}>
          Codează la <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${C.blue}, ${C.purple})` }}>viteza gândului</span> AI.
        </h1>
        <p className="text-lg mb-10 leading-relaxed" style={{ color: C.muted }}>
          Imaginează-ți un editor unde tu, echipa ta și agenții AI lucrați în același fișier,
          fără conflicte de Git și fără &quot;stai să fac push&quot;. Un sandbox universal pentru era post-Copilot.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleLaunch} size="lg" isLoading={isCreatingSession}>
            Începe un Prototip
          </Button>
          <Button variant="secondary" size="lg" onClick={() => window.open('https://github.com', '_blank')}>
            <Globe size={18} /> Vezi pe GitHub
          </Button>
        </div>
      </header>

      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl transition group" style={{ backgroundColor: C.card, border: `1px solid ${C.border}10` }}>
            <Users style={{ color: C.blue }} size={32} className="mb-4" />
            <h3 className="text-xl font-bold mb-3" style={{ color: C.text }}>Colaborare Fluidă</h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>
              Multi-cursor pentru toți utilizatorii și agenții AI. Prezență vizuală în stil Figma aplicată direct pe codul tău.
            </p>
            <div className="flex items-center gap-2 text-xs" style={{ color: C.border }}>
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: C.blue, border: `2px solid ${C.bg}` }}>A</div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: C.green, border: `2px solid ${C.bg}` }}>B</div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: C.purple, border: `2px solid ${C.bg}` }}>🤖</div>
              </div>
              <span>3 online</span>
            </div>
          </div>

          <div className="p-8 rounded-2xl transition" style={{ backgroundColor: C.card, border: `1px solid ${C.border}10` }}>
            <Cpu style={{ color: C.purple }} size={32} className="mb-4" />
            <h3 className="text-xl font-bold mb-3" style={{ color: C.text }}>AI Block-Editor</h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>
              Delimităm clar codul uman de halucinațiile AI. Blocurile generate pot fi acceptate sau refuzate cu un singur click.
            </p>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${C.purple}15`, border: `1px solid ${C.purple}30` }}>
              <div className="flex items-center gap-2 text-xs mb-2" style={{ color: C.purple }}>
                <Bot size={12} />
                <span>Generated by CodeBot</span>
              </div>
              <code className="text-xs" style={{ color: C.text }}>function optimize() {'{'}...{'}'}</code>
            </div>
          </div>

          <div className="p-8 rounded-2xl transition" style={{ backgroundColor: C.card, border: `1px solid ${C.border}10` }}>
            <Shield style={{ color: C.green }} size={32} className="mb-4" />
            <h3 className="text-xl font-bold mb-3" style={{ color: C.text }}>Sandboxing Inteligent</h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: C.muted }}>
              Izolare Docker on-the-fly. Scanăm automat vulnerabilitățile înainte ca mediul tău de backend să pornească.
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1" style={{ color: C.green }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.green }} /> Node.js
              </span>
              <span className="flex items-center gap-1" style={{ color: C.yellow }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.yellow }} /> Python
              </span>
              <span className="flex items-center gap-1" style={{ color: '#f97316' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} /> Rust
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="sandbox" className="py-20 px-6" style={{ borderTop: `1px solid ${C.blue}20`, borderBottom: `1px solid ${C.blue}20`, backgroundColor: `${C.blue}05` }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-left">
            <h2 className="text-3xl font-bold mb-6" style={{ color: C.text }}>Terminalul nu mai este singuratic.</h2>
            <p className="mb-6 italic" style={{ color: C.muted }}>
              &quot;Când cineva rulează o comandă, toți ceilalți văd output-ul.&quot;
            </p>
            <ul className="space-y-4" style={{ color: C.text }}>
              <li className="flex gap-2 items-start">
                <Code2 size={18} style={{ color: C.blue }} className="mt-1" />
                <span>Suport pentru Node.js, Python, Rust și multe altele.</span>
              </li>
              <li className="flex gap-2 items-start">
                <Database size={18} style={{ color: C.blue }} className="mt-1" />
                <span>Limitări inteligente de CPU și memorie anti-buclă infinită.</span>
              </li>
              <li className="flex gap-2 items-start">
                <Clock size={18} style={{ color: C.blue }} className="mt-1" />
                <span>Time-Travel Debugging cu snapshot-uri la fiecare 30 de secunde.</span>
              </li>
            </ul>
          </div>
          <div className="flex-1 w-full rounded-xl overflow-hidden font-mono text-xs" style={{ backgroundColor: '#0d1117', border: `1px solid ${C.border}`, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="p-2 flex gap-1.5" style={{ backgroundColor: C.surface }}>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: C.red }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: C.yellow }}></div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: C.green }}></div>
            </div>
            <div className="p-4 space-y-2">
              <div style={{ color: C.blue }}># Ana scrie:</div>
              <div style={{ color: C.text }}>$ python3 backend_optimizer.py</div>
              <div style={{ color: C.purple }}>... [AI Agent] Generating routes in real-time ...</div>
              <div style={{ color: C.green }}>✓ Server started on port 3000 (Docker Isolated)</div>
              <div style={{ color: C.muted }}>Memory used: 45MB / 512MB</div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4" style={{ color: C.text }}>Securitate în primul rând</h2>
          <p className="max-w-2xl mx-auto" style={{ color: C.muted }}>
            Fiecare linie de cod este scanată înainte de execuție. Protejăm împotriva atacurilor prin
            izolare completă în containere Docker.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <Shield style={{ color: C.green }} size={24} className="mb-4" />
            <h3 className="text-lg font-bold mb-2" style={{ color: C.text }}>Scanare Automată</h3>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              Detectăm patterns periculoase: eval(), exec(), imports suspecte, bucle infinite.
            </p>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center gap-2" style={{ color: C.red }}>
                <span>✗</span>
                <span>eval(userInput)</span>
                <span style={{ color: C.muted }}>// blocked</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: C.green }}>
                <span>✓</span>
                <span>console.log(message)</span>
                <span style={{ color: C.muted }}>// allowed</span>
              </div>
            </div>
          </div>
          <div className="p-6 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <Terminal style={{ color: C.blue }} size={24} className="mb-4" />
            <h3 className="text-lg font-bold mb-2" style={{ color: C.text }}>Izolare Completă</h3>
            <p className="text-sm mb-4" style={{ color: C.muted }}>
              Containerele rulează fără acces la rețea și cu permisiuni minimale.
            </p>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span style={{ color: C.muted }}>Network:</span>
                <span style={{ color: C.red }}>disabled</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: C.muted }}>Memory:</span>
                <span style={{ color: C.yellow }}>512MB limit</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ color: C.muted }}>Timeout:</span>
                <span style={{ color: C.yellow }}>30s max</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-6" style={{ color: C.text }}>Pregătit pentru iTEC 2026?</h2>
        <Button onClick={handleLaunch} size="lg" isLoading={isCreatingSession}>
          <Play size={18} /> Începe Acum
        </Button>
      </section>

      <footer className="py-12 text-center text-sm" style={{ borderTop: `1px solid ${C.border}10`, color: C.muted }}>
        <p>© iTEC 2026. Construit pentru performanță absolută de Liga AC.</p>
        <p className="mt-2 text-xs" style={{ color: C.border }}>
          Next.js • CodeMirror 6 • Yjs • Docker • TypeScript
        </p>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <ToastProvider>
      <LandingPageContent />
    </ToastProvider>
  );
}
