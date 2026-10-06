import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { Globe, PenLine, Layers, BookOpen, ListTree, MousePointerClick, CheckCheck } from 'lucide-react';
import { TopicHero } from '@/features/home/TopicHero';
import { Reveal } from '@/features/home/Reveal';
import { Chip, Row, Band, SectionHead, FeatureCard } from '@/components/ui';
import { SiteFooter } from '@/components/SiteFooter';

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
    <div className="flex flex-col min-h-dvh w-full overflow-x-hidden">
      <TopicHero startHref={startHref} startLabel={startLabel} />

      {/* ── The three beats ── */}
      <Band>
          <Reveal>
            <SectionHead title="One line in. A document out." subtitle="Three steps, and you are the one who approves every one of them." />
          </Reveal>

          <div className="step-row">
            {steps.map(({ n, icon: Icon, title, desc }, i) => (
              <Reveal key={n} delay={i * 70}>
                <FeatureCard step={n} icon={<Icon className="h-4 w-4" />} title={title}>{desc}</FeatureCard>
              </Reveal>
            ))}
          </div>
      </Band>

      {/* ── Features (bento) ── */}
      <Band spacing="tight">
          <Reveal>
            <SectionHead title="Built for deep knowledge work" subtitle="Everything between the topic and something worth publishing." />
          </Reveal>

          <div className="bento">
            {/* The differentiator gets the space. Research does the finding;
                this tile is the other half of the promise — nothing lands in
                the document until you put it there, whatever model found it. */}
            <Reveal className="bento-cell bento-cell--feature">
              <FeatureCard
                variant="feature"
                icon={<MousePointerClick className="h-4 w-4" />}
                title="You stay the editor"
                footer={
                  <Row align="center" gap={2} className="mt-4">
                    <Chip tone="accent">Gemini</Chip>
                    <Chip tone="accent">OpenAI</Chip>
                    <Chip tone="accent">Anthropic</Chip>
                  </Row>
                }
              >
                Research fills in what you ask for; nothing is written into the document
                without you placing it. Guide it, edit it, rearrange it — with whichever
                model you already pay for.
              </FeatureCard>
            </Reveal>

            {features.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 60} className="bento-cell">
                <FeatureCard variant="wide" icon={<Icon className="h-4 w-4" />} title={title}>{desc}</FeatureCard>
              </Reveal>
            ))}
          </div>
      </Band>

      {/* ── Footer ── */}
      <SiteFooter links={[{ to: '/community', label: 'Community' }, { to: '/about', label: 'About' }]} />
    </div>
  );
}
