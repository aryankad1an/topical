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
    <div className="flex flex-col min-h-screen w-full">

      {/* ── Hero ──
          The decorative `green-orb glow-pulse` div that used to sit here
          referenced two classes that no longer exist, so it would have
          rendered as a bare 350px accent-tinted square in the top right. */}
      <section className="band" style={{ paddingTop: 'clamp(3.5rem, 8vw, 5.5rem)' }}>
        <div className="band-inner">
          <div className="section-head" style={{ maxWidth: '38rem' }}>
            <span className="eyebrow">About</span>
            <h1 className="section-title" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', marginTop: '1.1rem' }}>
              Structure first, then the words.
            </h1>
            <p className="section-sub">
              Topical turns any topic into a structured document you can edit and share.
              It plans the outline before it writes, so what you get is organised —
              not one long undifferentiated draft.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="step-card">
              <h3 className="card-title">How it works</h3>
              <p className="card-body">
                You type a topic. Topical generates a hierarchy of subtopics, then writes
                rich content for each one using the AI provider of your choice, grounded in
                real-time web crawling.
              </p>
            </div>
            <div className="step-card">
              <h3 className="card-title">What you control</h3>
              <p className="card-body">
                Nothing is inserted without you. Edit inline, drag generated sections exactly
                where you want them, rearrange topics, and publish the result — or keep it
                private.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="band">
        <div className="band-inner">
          <div className="section-head">
            <h2 className="section-title">Core features</h2>
            <p className="section-sub">Everything the editor gives you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="step-card">
                <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                <h3 className="card-title">{title}</h3>
                <p className="card-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ── */}
      <section className="band">
        <div className="band-inner">
          <div className="section-head">
            <h2 className="section-title">Built with</h2>
            <p className="section-sub">
              A React frontend and one FastAPI backend that owns auth, documents and generation.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STACK.map(({ name, desc }) => (
              <Surface key={name} size="sm" padding="none" className="px-4 py-3.5">
                <h4 className="font-semibold text-sm text-[var(--ink)]">{name}</h4>
                <p className="text-[11px] text-[var(--ink-faint)] mt-0.5">{desc}</p>
              </Surface>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="band band--tight">
        <div className="band-inner">
          <div className="closing-cta">
            <h2 className="section-title">
              {isAuthenticated ? 'Continue building' : 'Try it out'}
            </h2>
            <p className="section-sub" style={{ marginInline: 'auto', maxWidth: '28rem' }}>
              {isAuthenticated
                ? 'Create another document or explore what the community has published.'
                : 'Sign up, add a provider key, and make your first document in a couple of minutes.'}
            </p>
            <Link
              to={isAuthenticated ? '/projects' : '/register'}
              className="cta-btn group"
              style={{ marginTop: '2rem' }}
            >
              <span>{isAuthenticated ? 'Go to Projects' : 'Get started'}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-[18px] w-[18px]" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="band-inner site-footer-inner">
          <span className="font-brand text-base">Topical</span>
          <div className="flex gap-6 items-center">
            <Link to="/community" className="footer-link">Community</Link>
            <Link to="/" className="footer-link">Home</Link>
            <span className="text-xs text-[var(--ink-ghost)]">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
