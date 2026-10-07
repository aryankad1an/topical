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
import { Button, Surface, Chip, Grid, Text, Band, SectionHead, FeatureCard, Stack } from '@/components/ui';
import { SiteFooter } from '@/components/SiteFooter';

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
    <Stack className="min-h-dvh w-full">

      {/* ── Hero ──
          The decorative `green-orb glow-pulse` div that used to sit here
          referenced two classes that no longer exist, so it would have
          rendered as a bare 350px accent-tinted square in the top right. */}
      <Band spacing="hero">
          <SectionHead
            level={1}
            size="hero"
            eyebrow={<Chip size="md" caps tone="accent">About</Chip>}
            title="Structure first, then the words."
            subtitle={<>
              Topical turns any topic into a structured document you can edit and share.
              It plans the outline before it writes, so what you get is organised —
              not one long undifferentiated draft.
            </>}
          />

          <Grid gap={4} cols={{ md: 2 }}>
            <FeatureCard title="How it works">
                You type a topic. Topical generates a hierarchy of subtopics, then writes
                rich content for each one using the AI provider of your choice, grounded in
                real-time web crawling.
            </FeatureCard>
            <FeatureCard title="What you control">
                Nothing is inserted without you. Edit inline, drag generated sections exactly
                where you want them, rearrange topics, and publish the result — or keep it
                private.
            </FeatureCard>
          </Grid>
      </Band>

      {/* ── Features ── */}
      <Band>
          <SectionHead title="Core features" subtitle="Everything the editor gives you." />
          <Grid gap={4} cols={{ base: 1, sm: 2, lg: 3 }}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <FeatureCard key={title} icon={<Icon className="h-4 w-4" />} title={title}>{desc}</FeatureCard>
            ))}
          </Grid>
      </Band>

      {/* ── Stack ── */}
      <Band>
          <SectionHead title="Built with" subtitle="A React frontend and one FastAPI backend that owns auth, documents and generation." />
          <Grid gap={3} cols={{ base: 2, md: 4 }}>
            {STACK.map(({ name, desc }) => (
              <Surface key={name} size="sm" padding="none" className="px-4 py-3.5">
                <Text as="span" size="sm" weight="semibold" tone="ink" className="block">{name}</Text>
                <Text size="2xs" tone="faint" className="mt-0.5">{desc}</Text>
              </Surface>
            ))}
          </Grid>
      </Band>

      {/* ── CTA ── */}
      <Band spacing="tight">
          <div className="closing-cta">
            <SectionHead
              align="center"
              flush
              title={isAuthenticated ? 'Continue building' : 'Try it out'}
              subtitle={isAuthenticated
                ? 'Create another document or explore what the community has published.'
                : 'Sign up, add a provider key, and make your first document in a couple of minutes.'}
            />
            <Button asChild variant="primary" size="hero" className="mt-8">
            <Link to={isAuthenticated ? '/projects' : '/register'}>
              <span>{isAuthenticated ? 'Go to Projects' : 'Get started'}</span>
              <span className="cta-arrow cta-arrow-animated">
                <ArrowRight className="h-[18px] w-[18px]" />
              </span>
            </Link>
            </Button>
          </div>
      </Band>

      {/* ── Footer ── */}
      <SiteFooter links={[{ to: '/community', label: 'Community' }, { to: '/', label: 'Home' }]} />
    </Stack>
  );
}
