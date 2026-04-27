import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowRight,
  Layers,
  Globe,
  PenLine,
} from 'lucide-react';

export const Route = createFileRoute('/')({
  beforeLoad: () => ({}),
  component: Home,
});

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Hero Section */}
      <section className="relative py-32 md:py-44 px-4 overflow-hidden">
        {/* Floating green orbs */}
        <div
          className="green-orb glow-pulse"
          style={{
            width: '400px', height: '400px',
            background: 'rgba(34, 197, 94, 0.06)',
            top: '10%', left: '-5%',
          }}
        />
        <div
          className="green-orb glow-pulse"
          style={{
            width: '300px', height: '300px',
            background: 'rgba(74, 222, 128, 0.04)',
            bottom: '10%', right: '-5%',
            animationDelay: '2s',
          }}
        />

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* Title */}
            <div className="animate-fade-in">
              <h1
                className="font-brand text-6xl md:text-8xl lg:text-9xl tracking-tight mb-4"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 40%, #86efac 70%, #22c55e 100%)',
                  backgroundSize: '300% 300%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'iridescent 8s ease-in-out infinite',
                }}
              >
                Topical
              </h1>
            </div>

            {/* Subtitle — concise, no buzzwords */}
            <p className="text-lg md:text-xl text-white/40 max-w-lg leading-relaxed animate-fade-in-delay-1">
              Build lesson plans with AI. Search a topic, generate content, share with anyone.
            </p>

            {/* CTA — "Create your first lesson plan" */}
            <div className="animate-fade-in-delay-2">
              <a
                href={isAuthenticated ? "/lesson-plan" : "/api/register"}
                className="cta-btn group"
                id="cta-create-lesson"
              >
                <span>{isAuthenticated ? "Create a lesson plan" : "Create your first lesson plan"}</span>
                <span className="cta-arrow cta-arrow-animated">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </a>
            </div>

            {/* Minimal sub-links */}
            {!isAuthenticated && (
              <div className="animate-fade-in-delay-3">
                <a
                  href="/public-lessons"
                  className="text-sm text-white/25 transition-colors duration-300"
                >
                  or explore public lessons →
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features — 3 concise cards */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Layers,
                title: "Structured",
                desc: "Auto-generated topic hierarchies you can drag, drop, and customize.",
              },
              {
                icon: PenLine,
                title: "AI-Written",
                desc: "Rich content generated from web sources and refined with inline AI.",
              },
              {
                icon: Globe,
                title: "Shareable",
                desc: "Publish lesson plans for others to learn from, or keep them private.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card liquid-glow p-6 group">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: 'rgba(34, 197, 94, 0.06)',
                    border: '1px solid rgba(34, 197, 94, 0.1)',
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-base font-semibold mb-1.5 text-white/85">{title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — stripped down */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold mb-10 text-center text-white/80">How it works</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {[
              { step: "1", label: "Search a topic" },
              { step: "2", label: "Generate content" },
              { step: "3", label: "Edit & share" },
            ].map(({ step, label }, i) => (
              <div key={step} className="flex items-center gap-4 flex-1">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 animate-float"
                  style={{
                    animationDelay: `${i * 0.5}s`,
                    background: 'rgba(34, 197, 94, 0.06)',
                    border: '1px solid rgba(34, 197, 94, 0.12)',
                  }}
                >
                  <span className="text-lg font-bold" style={{ color: '#22c55e' }}>{step}</span>
                </div>
                <span className="text-white/50 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="glass-card liquid-glow p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 gradient-text">
              {isAuthenticated ? "Keep building" : "Ready to start?"}
            </h2>
            <p className="text-sm text-white/30 mb-8 max-w-md mx-auto">
              {isAuthenticated
                ? "Create another lesson plan or browse what the community has shared."
                : "Sign up and create your first structured lesson plan in minutes."}
            </p>
            <a
              href={isAuthenticated ? "/lesson-plan" : "/api/register"}
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
              <a href="/about" className="text-xs text-white/25 transition-colors">About</a>
              <a href="/public-lessons" className="text-xs text-white/25 transition-colors">Explore</a>
              <div className="text-xs text-white/15">© {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
