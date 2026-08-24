import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { ArrowRight, Globe, PenLine, Layers, Zap, BookOpen, Brain, Search, Sparkles, KeyRound } from 'lucide-react';

export const Route = createFileRoute('/')({
  beforeLoad: () => ({}),
  component: Home,
});

/** A static mock of the editor, so the landing page shows the product. */
function ProductPreview() {
  return (
    <div className="preview-window animate-fade-in-delay-3" aria-hidden="true">
      <div className="preview-chrome">
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-title">Photosynthesis — lesson plan</span>
      </div>
      <div className="preview-body">
        <div className="preview-rail">
          <div className="preview-rail-label">Outline</div>
          <div className="preview-node">Light reactions</div>
          <div className="preview-node preview-node--sub">Photosystem II</div>
          <div className="preview-node preview-node--sub">Electron transport</div>
          <div className="preview-node preview-node--active">
            <Sparkles className="h-3 w-3" /> Calvin cycle
          </div>
          <div className="preview-node preview-node--sub">Carbon fixation</div>
          <div className="preview-node">Limiting factors</div>
        </div>
        {/* The right pane used to stop six lines in and leave the bottom
            two-thirds of the mock empty, which read as a half-loaded page
            rather than as a document. It now fills its own height. */}
        <div className="preview-pane">
          <div className="preview-line preview-line--head" />
          <div className="preview-line" style={{ width: '96%' }} />
          <div className="preview-line" style={{ width: '88%' }} />
          <div className="preview-line preview-line--accent" style={{ width: '70%' }} />
          <div className="preview-line" style={{ width: '92%' }} />
          <div className="preview-line" style={{ width: '60%' }} />
          <div className="preview-line preview-line--sub" />
          <div className="preview-line" style={{ width: '94%' }} />
          <div className="preview-line" style={{ width: '82%' }} />
          <div className="preview-line" style={{ width: '90%' }} />
          <div className="preview-line" style={{ width: '48%' }} />
        </div>
      </div>
    </div>
  );
}

const steps = [
  { n: '01', icon: Search, title: 'Name a topic', desc: 'Type any subject. Topical plans a full hierarchy of sections and subsections before writing a word.' },
  { n: '02', icon: Sparkles, title: 'Generate section by section', desc: 'Each section is written with the whole outline as context — grounded in live web sources, or your own URLs.' },
  { n: '03', icon: PenLine, title: 'Place and publish', desc: 'Drop sections exactly where your cursor is, edit freely, then publish to the community or keep it private.' },
];

const features = [
  { icon: Zap, title: 'Instant generation', desc: 'Search a topic, get a full content hierarchy, then generate individual sections in seconds.', wide: true },
  { icon: Layers, title: 'MDX & LaTeX', desc: 'Interactive MDX documents, or professional LaTeX for academia, engineering, and science.', wide: true },
  { icon: PenLine, title: 'Drop-in placement', desc: 'Drag any section straight into the document, exactly where your cursor is.' },
  { icon: Globe, title: 'Publish & share', desc: 'Make any project public so others can read and learn from it.' },
  { icon: BookOpen, title: 'Community library', desc: 'Browse lesson plans, research summaries, and technical docs from others.' },
];

function Home() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? '/projects' : '/register';
  const startLabel = isAuthenticated ? 'Go to Projects' : 'Start for free';

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">

      {/* ── Hero ──
          The gap between the mock and the section below it used to be the
          hero's own `pb-20` plus the next section's `pt-24` plus a `mb-16`
          on the button row: roughly 180px of nothing, in the one place a
          visitor is deciding whether to keep scrolling. The hero now owns
          its bottom spacing and the band below it starts flush. */}
      <section className="hero-band">
        <div className="hero-inner">
          <h1 className="hero-title animate-fade-in">Topical</h1>

          <p className="hero-lede animate-fade-in-delay-1">
            Where the <em>human brain</em> works with <em>artificial intelligence</em>
          </p>

          <p className="hero-sub animate-fade-in-delay-2">
            Turn any topic into a structured, publishable document — lesson plans,
            research papers, technical docs. You stay the editor.
          </p>

          <div className="hero-actions animate-fade-in-delay-2">
            <Link to={startHref} className="cta-btn group" id="cta-hero-start">
              <span>{startLabel}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-[18px] w-[18px]" />
              </span>
            </Link>
            <Link to="/community" className="glass-btn hero-secondary">
              <Globe className="h-4 w-4" />
              Explore community
            </Link>
          </div>

          <div className="hero-preview">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="band">
        <div className="band-inner">
          <div className="section-head">
            <h2 className="section-title">From a topic to a document</h2>
            <p className="section-sub">Three steps, and you approve every one of them.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="step-card">
                <span className="step-num">{n}</span>
                <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                <h3 className="card-title">{title}</h3>
                <p className="card-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (bento) ── */}
      <section className="band band--tight">
        <div className="band-inner">
          <div className="section-head">
            <h2 className="section-title">Built for deep knowledge work</h2>
            <p className="section-sub">Everything you need to go from idea to publishable document.</p>
          </div>

          <div className="bento">
            {/* The differentiator gets the space. */}
            <div className="bento-item bento-item--feature">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="bento-icon"><Brain className="h-4 w-4" /></div>
                  <h3 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Human + AI collaboration</h3>
                  <p className="card-body max-w-lg">
                    AI generates structured content from across the web. Nothing lands in your
                    document until you put it there — you guide, edit, and arrange with full
                    creative control.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="chip chip--accent">Gemini</span>
                  <span className="chip chip--accent">OpenAI</span>
                  <span className="chip chip--accent">Anthropic</span>
                </div>
              </div>
            </div>

            {features.map(({ icon: Icon, title, desc, wide }) => (
              <div key={title} className={`bento-item${wide ? ' bento-item--wide' : ''}`}>
                <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                <h3 className="card-title">{title}</h3>
                <p className="card-body">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="band band--tight">
        <div className="band-inner">
          <div className="closing-cta">
            <span className="eyebrow"><KeyRound className="h-3 w-3" /> Your key, your model</span>
            <h2 className="section-title" style={{ marginTop: '1.25rem' }}>
              Start with the model you already pay for
            </h2>
            <p className="section-sub" style={{ marginInline: 'auto', maxWidth: '30rem' }}>
              Add a provider key in your profile and start generating. Keys stay in your
              browser and are never stored on our servers.
            </p>
            <Link to={startHref} className="cta-btn group" style={{ marginTop: '2rem' }}>
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
          <div className="flex items-center gap-3">
            <span className="font-brand text-lg">Topical</span>
            <span className="text-[var(--ink-ghost)] text-xs">·</span>
            <span className="text-xs text-[var(--ink-faint)]">Where humans and AI create together</span>
          </div>
          <div className="flex gap-6 items-center">
            <Link to="/community" className="footer-link">Community</Link>
            <Link to="/about" className="footer-link">About</Link>
            <span className="text-xs text-[var(--ink-ghost)]">© {new Date().getFullYear()} Topical</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
