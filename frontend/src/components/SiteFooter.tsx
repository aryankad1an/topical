import { Link } from '@tanstack/react-router';
import { Row, Text, TextLink } from '@/components/ui';

/**
 * The marketing pages' footer. The landing and about pages each drew their own
 * and had drifted — a different wordmark size, the brand line on one only, a
 * copyright with and without the name. `links` is what differs on purpose:
 * each page points at the other.
 */
export function SiteFooter({ links }: { links: { to: '/' | '/about' | '/community'; label: string }[] }) {
  return (
    <footer className="site-footer">
      <div className="band-inner site-footer-inner">
        <Row align="center" gap={3}>
          <span className="font-brand text-lg">Topical</span>
          <Text tone="ghost" size="xs" as="span">·</Text>
          <Text size="xs" tone="faint" as="span">All you need is a topic</Text>
        </Row>
        <Row gap={6} align="center">
          {links.map(link => (
            <TextLink key={link.to} asChild size="xs"><Link to={link.to}>{link.label}</Link></TextLink>
          ))}
          <Text size="xs" tone="ghost" as="span">© {new Date().getFullYear()} Topical</Text>
        </Row>
      </div>
    </footer>
  );
}
