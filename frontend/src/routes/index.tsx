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
        <span className="ml-2 text-[11px] text-[var(--ink-ghost)]">Photosynthesis — lesson plan</span>
      </div>
      <div className="preview-body">
        <div className="preview-rail">
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-ghost)] mb-2.5 px-1">Hierarchy</div>
          <div className="preview-node">Light reactions</div>
          <div className="preview-node preview-node--sub">Photosystem II</div>
          <div className="preview-node preview-node--active">
            <Sparkles className="h-3 w-3" /> Calvin cycle
          </div>
          <div className="preview-node preview-node--sub">Carbon fixation</div>
          <div className="preview-node">Limiting factors</div>
        </div>
        <div className="preview-pane">
          <div className="preview-line preview-line--head" />
          <div className="preview-line" style={{ width: '96%' }} />
          <div className="preview-line" style={{ width: '88%' }} />
          <div className="preview-line preview-line--accent" style={{ width: '70%' }} />
          <div className="preview-line" style={{ width: '92%' }} />
          <div className="preview-line" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { isAuthenticated, registerUrl, registerAction } = useAuth();

  const steps = [
    { n: '01', icon: Search, title: 'Name a topic', desc: 'Type any subject. Topical plans a full hierarchy of sections and subsections before writing a word.' },
    { n: '02', icon: Sparkles, title: 'Generate section by section', desc: 'Each section is written with the whole outline as context — grounded in live web sources, or your own URLs.' },
    { n: '03', icon: PenLine, title: 'Place and publish', desc: 'Drop sections exactly where your cursor is, edit freely, then publish to the community or keep it private.' },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative px-4 pt-28 pb-16 md:pt-32 md:pb-20 text-center overflow-hidden">
        <div className="relative z-10 flex flex-col items-center max-w-5xl mx-auto">
          <h1 className="animate-fade-in font-brand leading-none mb-6 mt-4"
            style={{
              fontSize: 'clamp(3.5rem, 13vw, 9rem)',
              background: 'linear-gradient(135deg, var(--ink), var(--ink-2))',
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'titleShimmer 10s ease-in-out infinite',
            }}>
            Topical
          </h1>

          <p className="animate-fade-in-delay-1 text-lg md:text-2xl font-light text-[var(--ink-muted)] max-w-2xl leading-relaxed tracking-wide mb-4">
            Where the{' '}
            <span className="text-[var(--ink)] font-medium">human brain</span>
            {' '}works with{' '}
            <span className="text-[var(--ink)] font-medium">artificial intelligence</span>
          </p>

          <p className="animate-fade-in-delay-2 text-sm md:text-base text-[var(--ink-faint)] max-w-xl leading-relaxed mb-9">
            Turn any topic into a structured, publishable document — lesson plans,
            research papers, technical docs. You stay the editor.
          </p>

          <div className="animate-fade-in-delay-2 flex flex-col sm:flex-row items-center gap-3.5 mb-16">
            <a
              href={isAuthenticated ? '/projects' : registerUrl}
              onClick={isAuthenticated ? undefined : registerAction}
              className="cta-btn group"
              id="cta-hero-start"
            >
              <span>{isAuthenticated ? 'Go to Projects' : 'Start for free'}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-5 w-5" />
              </span>
            </a>
            <Link to="/community"
              className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-[var(--ink-faint)] hover:text-[var(--ink-2)] hover:border-[var(--line-strong)] transition-all duration-300"
              style={{ border: '1px solid var(--line-soft)' }}>
              <Globe className="h-4 w-4" />
              Explore community
            </Link>
          </div>

          <div className="w-full max-w-4xl px-1">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 md:py-24" style={{ paddingInline: 'var(--gutter)' }}>
        <div className="mx-auto" style={{ maxWidth: '64rem' }}>
          <div className="mb-12 max-w-xl">
            <h2 className="section-title">From a topic to a document</h2>
            <p className="section-sub">Three steps. You approve every one of them.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="step-card">
                <span className="step-num">{n}</span>
                <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">{title}</h3>
                <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (bento) ── */}
      <section className="pb-24" style={{ paddingInline: 'var(--gutter)' }}>
        <div className="mx-auto" style={{ maxWidth: '64rem' }}>
          <div className="mb-10 max-w-xl">
            <h2 className="section-title">Built for deep knowledge work</h2>
            <p className="section-sub">Everything you need to go from idea to publishable document.</p>
          </div>

          <div className="bento">
            {/* Feature row — the differentiator gets the space */}
            <div className="bento-item bento-item--feature">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="bento-icon"><Brain className="h-4 w-4" /></div>
                  <h3 className="text-base font-semibold text-[var(--ink)] mb-2">Human + AI collaboration</h3>
                  <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed max-w-lg">
                    AI generates structured content from across the web. Nothing lands in your
                    document until you put it there — you guide, edit, and arrange with full
                    creative control.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="accent-soft text-[11px] font-semibold px-2.5 py-1 rounded-md">Gemini</span>
                  <span className="accent-soft text-[11px] font-semibold px-2.5 py-1 rounded-md">OpenAI</span>
                  <span className="accent-soft text-[11px] font-semibold px-2.5 py-1 rounded-md">Anthropic</span>
                </div>
              </div>
            </div>

            <div className="bento-item bento-item--wide">
              <div className="bento-icon"><Zap className="h-4 w-4" /></div>
              <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">Instant generation</h3>
              <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">
                Search a topic, get a full content hierarchy, then generate individual sections in seconds.
              </p>
            </div>

            <div className="bento-item bento-item--wide">
              <div className="bento-icon"><Layers className="h-4 w-4" /></div>
              <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">MDX &amp; LaTeX</h3>
              <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">
                Interactive MDX documents, or professional LaTeX for academia, engineering, and science.
              </p>
            </div>

            <div className="bento-item">
              <div className="bento-icon"><PenLine className="h-4 w-4" /></div>
              <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">Drop-in placement</h3>
              <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">
                Drag any section straight into the document, exactly where your cursor is.
              </p>
            </div>

            <div className="bento-item">
              <div className="bento-icon"><Globe className="h-4 w-4" /></div>
              <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">Publish &amp; share</h3>
              <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">
                Make any project public so others can read and learn from it.
              </p>
            </div>

            <div className="bento-item">
              <div className="bento-icon"><BookOpen className="h-4 w-4" /></div>
              <h3 className="text-sm font-semibold text-[var(--ink-2)] mb-2">Community library</h3>
              <p className="text-[var(--ink-faint)] text-[13px] leading-relaxed">
                Browse lesson plans, research summaries, and technical docs from others.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="pb-24" style={{ paddingInline: 'var(--gutter)' }}>
        <div className="mx-auto text-center" style={{ maxWidth: '40rem' }}>
          <div className="step-card" style={{ padding: '2.75rem 2rem' }}>
            <div className="flex justify-center mb-5">
              <span className="eyebrow"><KeyRound className="h-3 w-3" /> Your key, your model</span>
            </div>
            <h2 className="section-title mb-3">Start with the model you already pay for</h2>
            <p className="text-[var(--ink-faint)] text-sm leading-relaxed mb-8 max-w-md mx-auto">
              Add a provider key in your profile and start generating. Keys stay in your
              browser and are never stored on our servers.
            </p>
            <a
              href={isAuthenticated ? '/projects' : registerUrl}
              onClick={isAuthenticated ? undefined : registerAction}
              className="cta-btn group"
            >
              <span>{isAuthenticated ? 'Go to Projects' : 'Get started'}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-5 w-5" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 mt-auto" style={{ borderTop: '1px solid var(--line-soft)', paddingInline: 'var(--gutter)' }}>
        <div className="mx-auto" style={{ maxWidth: '64rem' }}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="font-brand text-lg" style={{ background: 'linear-gradient(135deg, var(--ink), var(--ink-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Topical</span>
              <span className="text-[var(--ink-ghost)] text-xs">·</span>
              <span className="text-xs text-[var(--ink-ghost)]">Where humans and AI create together</span>
            </div>
            <div className="flex gap-6 items-center">
              <Link to="/community" className="text-xs text-[var(--ink-ghost)] hover:text-[var(--ink-muted)] transition-colors">Community</Link>
              <Link to="/about" className="text-xs text-[var(--ink-ghost)] hover:text-[var(--ink-muted)] transition-colors">About</Link>
              <div className="text-xs text-[var(--ink-ghost)]">© {new Date().getFullYear()} Topical</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
