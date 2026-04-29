import { createFileRoute } from '@tanstack/react-router';
import {
  Search,
  PenLine,
  Share2,
  ArrowRight,
  Brain,
  Layers,
  Code,
  Zap,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  const { isAuthenticated, registerUrl, registerAction } = useAuth();

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div
          className="green-orb glow-pulse"
          style={{
            width: '350px', height: '350px',
            background: 'rgba(34, 197, 94, 0.05)',
            top: '0%', right: '10%',
          }}
        />
        <div className="container mx-auto max-w-4xl relative z-10 text-center">
          <h1
            className="font-brand text-4xl md:text-6xl tracking-tight mb-6"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #4ade80, #86efac, #22c55e)',
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'iridescent 8s ease-in-out infinite',
            }}
          >
            About Topical
          </h1>
          <p className="text-lg text-white/35 max-w-2xl mx-auto leading-relaxed">
            A tool for turning any topic into a structured, AI-generated lesson plan you can edit and share.
          </p>
        </div>
      </section>

      {/* What it does — concise */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-card p-8 md:p-10">
            <h2 className="text-xl font-bold mb-4 text-white/80">What it does</h2>
            <div className="space-y-3 text-white/40 text-sm leading-relaxed">
              <p>
                You type a topic. Topical generates a hierarchy of subtopics, then creates rich content for each one using Google Gemini and real-time web crawling.
              </p>
              <p>
                You can edit everything inline, refine sections with AI, rearrange topics with drag-and-drop, and publish the result for others to learn from.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core features — 3 cards */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-bold mb-8 text-white/80">Core features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Search, title: "Topic Discovery", desc: "Search any subject and get a structured breakdown." },
              { icon: Brain, title: "AI Generation", desc: "Content generated from web sources via Google Gemini." },
              { icon: PenLine, title: "Inline Editing", desc: "Select text, refine with AI, or edit manually." },
              { icon: Layers, title: "Drag & Drop", desc: "Reorder topics and subtopics by dragging." },
              { icon: FileText, title: "MDX Editor", desc: "Code, preview, and split-view editing modes." },
              { icon: Share2, title: "Share or Private", desc: "Publish publicly or keep your plans private." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card liquid-glow p-5 group">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center mb-3"
                  style={{
                    background: 'rgba(34, 197, 94, 0.06)',
                    border: '1px solid rgba(34, 197, 94, 0.1)',
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1 text-white/80">{title}</h3>
                <p className="text-white/30 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack — minimal */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-bold mb-8 text-white/80">Built with</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "React", desc: "Frontend" },
              { name: "Hono", desc: "Backend API" },
              { name: "FastAPI", desc: "AI Service" },
              { name: "Gemini", desc: "AI Model" },
              { name: "TanStack", desc: "Routing" },
              { name: "Drizzle", desc: "Database" },
              { name: "Zustand", desc: "State" },
              { name: "MDX", desc: "Content" },
            ].map(({ name, desc }) => (
              <div key={name} className="glass-card p-4 text-center">
                <h4 className="font-semibold text-sm text-white/70 mb-0.5">{name}</h4>
                <p className="text-[11px] text-white/25">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="glass-card liquid-glow p-10">
            <h2 className="text-2xl font-bold mb-4 gradient-text">
              {isAuthenticated ? "Continue building" : "Try it out"}
            </h2>
            <p className="text-sm text-white/30 mb-8 max-w-md mx-auto">
              {isAuthenticated
                ? "Create another lesson plan or explore community content."
                : "Sign up and make your first lesson plan in a couple of minutes."}
            </p>
            <a
              href={isAuthenticated ? "/lesson-plan" : registerUrl}
              onClick={isAuthenticated ? undefined : registerAction}
              className="cta-btn group"
            >
              <span>{isAuthenticated ? "New lesson plan" : "Get started"}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-5 w-5" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-3 md:mb-0">
              <p className="font-brand text-base gradient-text">Topical</p>
            </div>
            <div className="flex gap-6 items-center">
              <a href="/public-lessons" className="text-xs text-white/25 transition-colors">Explore</a>
              <div className="text-xs text-white/15">© {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}