import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Search,
  PenLine,
  Share2,
  ArrowRight,
  Brain,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Surface } from '@/components/ui/primitives';

export const Route = createFileRoute('/about')({
  component: About,
});

const FEATURES = [
  { icon: Search, title: 'Topic discovery', desc: 'Search any subject and get a structured breakdown before a word is written.' },
  { icon: Brain, title: 'AI generation', desc: 'Content generated from live web sources via the model you choose.' },
  { icon: PenLine, title: 'Inline editing', desc: 'Edit in code, preview, or split view as you write.' },
  { icon: Layers, title: 'Drag & drop', desc: 'Reorder topics, and drop generated sections exactly where you want them.' },
  { icon: FileText, title: 'MDX & LaTeX', desc: 'Interactive documents, or typeset LaTeX for academic work.' },
  { icon: Share2, title: 'Share or keep private', desc: 'Publish to the community library, or keep everything to yourself.' },
];

const STACK = [
  { name: 'React', desc: 'Frontend' },
  { name: 'FastAPI', desc: 'Backend' },
  { name: 'LiteLLM', desc: 'Multi-provider AI' },
  { name: 'TanStack', desc: 'Routing' },
  { name: 'SQLAlchemy', desc: 'Database' },
  { name: 'Postgres', desc: 'Storage' },
  { name: 'Yjs', desc: 'Collaboration' },
  { name: 'MDX', desc: 'Content' },
];

function About() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ paddingInline: 'var(--gutter)' }}>
      <div className="mx-auto w-full" style={{ maxWidth: '64rem' }}>

        {/* ── Hero ── */}
        <section className="relative pt-24 pb-14 overflow-hidden">
          <div
            className="green-orb glow-pulse"
            style={{ width: '350px', height: '350px', background: 'var(--accent-soft)', top: '-10%', right: '5%' }}
          />
          <div className="relative z-10 max-w-2xl">
            <span className="eyebrow mb-6 inline-flex">About</span>
            <h1 className="font-brand text-4xl md:text-5xl tracking-tight mb-4 text-[var(--ink)]">
              Structure first, then the words.
            </h1>
            <p className="text-base text-[var(--ink-faint)] leading-relaxed">
              Topical turns any topic into a structured document you can edit and share.
              It plans the outline before it writes, so what you get is organised —
              not one long undifferentiated draft.
            </p>
          </div>
        </section>

        {/* ── What it does ── */}
        <section className="pb-16">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="step-card">
              <span className="step-num">How it works</span>
              <p className="text-[var(--ink-faint)] text-sm leading-relaxed">
                You type a topic. Topical generates a hierarchy of subtopics, then writes
                rich content for each one using the AI provider of your choice, grounded in
                real-time web crawling.
              </p>
            </div>
            <div className="step-card">
              <span className="step-num">What you control</span>
              <p className="text-[var(--ink-faint)] text-sm leading-relaxed">
                Nothing is inserted without you. Edit inline, drag generated sections exactly
                where you want them, rearrange topics, and publish the result — or keep it
                private.
              </p>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="pb-16">
          <div className="mb-8 max-w-xl">
            <h2 className="section-title">Core features</h2>
            <p className="section-sub">Everything the editor gives you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="step-card">
                <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                <h3 className="text-sm font-semibold mb-1.5 text-[var(--ink-2)]">{title}</h3>
                <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stack ── */}
        <section className="pb-16">
          <div className="mb-8 max-w-xl">
            <h2 className="section-title">Built with</h2>
            <p className="section-sub">Three services: a React frontend, a Bun API, and a Python AI service.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STACK.map(({ name, desc }) => (
              <Surface key={name} size="sm" padding="none" className="px-4 py-3.5">
                <h4 className="font-semibold text-sm text-[var(--ink-2)]">{name}</h4>
                <p className="text-[11px] text-[var(--ink-ghost)] mt-0.5">{desc}</p>
              </Surface>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="pb-20">
          <div className="step-card text-center" style={{ padding: '2.75rem 2rem' }}>
            <h2 className="section-title mb-3">
              {isAuthenticated ? 'Continue building' : 'Try it out'}
            </h2>
            <p className="text-sm text-[var(--ink-faint)] mb-8 max-w-md mx-auto leading-relaxed">
              {isAuthenticated
                ? 'Create another document or explore what the community has published.'
                : 'Sign up, add a provider key, and make your first document in a couple of minutes.'}
            </p>
            <Link
              to={isAuthenticated ? '/projects' : '/register'}
              className="cta-btn group"
            >
              <span>{isAuthenticated ? 'Go to Projects' : 'Get started'}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-8" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="font-brand text-base gradient-text">Topical</p>
            <div className="flex gap-6 items-center">
              <Link to="/community" className="text-xs text-[var(--ink-ghost)] hover:text-[var(--ink-muted)] transition-colors">Community</Link>
              <Link to="/" className="text-xs text-[var(--ink-ghost)] hover:text-[var(--ink-muted)] transition-colors">Home</Link>
              <div className="text-xs text-[var(--ink-ghost)]">© {new Date().getFullYear()}</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
