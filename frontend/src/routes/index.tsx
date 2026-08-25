import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { Globe, PenLine, Layers, BookOpen, ListTree, MousePointerClick, CheckCheck } from 'lucide-react';
import { TopicHero } from '@/features/home/TopicHero';
import { Reveal } from '@/features/home/Reveal';

export const Route = createFileRoute('/')({
  beforeLoad: () => ({}),
  component: Home,
});

/* The three beats of the promise on the hero, in the order they happen. They
   used to describe *generation* — name a topic, get text back — which is what
   a prompt-to-blob tool does and is not what happens here: the outline is
   settled before a word is written, and research reads the document instead
   of starting cold. */
const steps = [
  {
    n: '01',
    icon: ListTree,
    title: 'You give it the topic',
    desc: 'One line is the whole input. Topical proposes the full hierarchy — sections and subsections — before it writes anything at all.',
  },
  {
    n: '02',
    icon: CheckCheck,
    title: 'You approve the outline',
    desc: 'Reorder it, rewrite it, cut half of it. The outline is the document’s spine, and nothing gets researched until it is the spine you wanted.',
  },
  {
    n: '03',
    icon: PenLine,
    title: 'You keep the document',
    desc: 'Each section is researched, cited, and dropped exactly where your cursor is. Publish it, keep it private, or export it as MDX or LaTeX.',
  },
];

/* Four tiles, each `span 3` in the six-column bento, so they lay out as a
   clean 2×2. The grid this replaced mixed one `span 3` with three `span 2` —
   9 columns for 4 items, which does not divide the row and left a dangling
   half-row gap. */
const features = [
  { icon: Layers, title: 'MDX & LaTeX', desc: 'Interactive MDX documents, or professional LaTeX for academia, engineering, and science.' },
  { icon: PenLine, title: 'Drop-in placement', desc: 'Drag any section straight into the document, exactly where your cursor is.' },
  { icon: Globe, title: 'Publish & share', desc: 'Make any project public so others can read and learn from it.' },
  { icon: BookOpen, title: 'Community library', desc: 'Browse research, lesson plans, and technical docs from others.' },
];

function Home() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? '/projects' : '/register';
  const startLabel = isAuthenticated ? 'Open Topical' : 'Start free';

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden">
      <TopicHero startHref={startHref} startLabel={startLabel} />

      {/* ── The three beats ── */}
      <section className="band">
        <div className="band-inner">
          <Reveal>
            <div className="section-head">
              <h2 className="section-title">One line in. A document out.</h2>
              <p className="section-sub">Three steps, and you are the one who approves every one of them.</p>
            </div>
          </Reveal>

          <div className="step-row">
            {steps.map(({ n, icon: Icon, title, desc }, i) => (
              <Reveal key={n} delay={i * 70}>
                <div className="step-card">
                  <span className="step-num">{n}</span>
                  <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                  <h3 className="card-title">{title}</h3>
                  <p className="card-body">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features (bento) ── */}
      <section className="band band--tight">
        <div className="band-inner">
          <Reveal>
            <div className="section-head">
              <h2 className="section-title">Built for deep knowledge work</h2>
              <p className="section-sub">Everything between the topic and something worth publishing.</p>
            </div>
          </Reveal>

          <div className="bento">
            {/* The differentiator gets the space. Research does the finding;
                this tile is the other half of the promise — nothing lands in
                the document until you put it there, whatever model found it. */}
            <Reveal className="bento-cell bento-cell--feature">
              <div className="bento-item bento-item--feature">
                <div className="bento-icon"><MousePointerClick className="h-4 w-4" /></div>
                <h3 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>You stay the editor</h3>
                <p className="card-body max-w-lg">
                  Research fills in what you ask for; nothing is written into the document
                  without you placing it. Guide it, edit it, rearrange it — with whichever
                  model you already pay for.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="chip chip--accent">Gemini</span>
                  <span className="chip chip--accent">OpenAI</span>
                  <span className="chip chip--accent">Anthropic</span>
                </div>
              </div>
            </Reveal>

            {features.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 60} className="bento-cell">
                <div className="bento-item bento-item--wide">
                  <div className="bento-icon"><Icon className="h-4 w-4" /></div>
                  <h3 className="card-title">{title}</h3>
                  <p className="card-body">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="band-inner site-footer-inner">
          <div className="flex items-center gap-3">
            <span className="font-brand text-lg">Topical</span>
            <span className="text-[var(--ink-ghost)] text-xs">·</span>
            <span className="text-xs text-[var(--ink-faint)]">All you need is a topic</span>
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
