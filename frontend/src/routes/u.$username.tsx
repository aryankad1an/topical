import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileType2, FileCode2, Calendar, UserX, Settings2 } from 'lucide-react';
import { fetchPersonProfile, personName, type PublishedDoc } from "@/lib/api";
import { formatOf } from "@/lib/types";
import { documentRoute } from "@/lib/documentUrl";
import { formatDate, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Button, EmptyState, PageHeader, IdentityBanner, DocTypeIcon, LoadingState, BackLink, Page, Row, Grid, Text } from '@/components/ui';

export const Route = createFileRoute("/u/$username")({
  component: PublicProfile,
});

function PublicProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => fetchPersonProfile(username),
    retry: false,
  });

  if (isLoading) {
    return (
      <LoadingState size="region" />
    );
  }

  if (isError || !data) {
    return (
      <Page width="narrow">
        <EmptyState
          icon={UserX}
          tone="muted"
          title="Profile not found"
          description={error instanceof Error ? error.message : `No member goes by @${username}.`}
          action={
            <Link to="/community" className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink-2)] transition-colors">
              ← Browse the community
            </Link>
          }
        />
      </Page>
    );
  }

  const { person, published } = data;
  const isSelf = user?.id === person.id;
  const name = personName(person);
  const joined = formatMonthYear(person.createdAt);

  /*
   * Someone else's published work, opened at its own address.
   *
   * This sent every document to the editor, including the ones belonging to
   * the person whose profile you were looking at — which is to say almost all
   * of them. The editor loads through the owner-or-co-author endpoint, so the
   * result was a "Failed to load project" toast over an empty writing surface.
   */
  const openDoc = (doc: PublishedDoc) => {
    navigate(documentRoute(doc.id, doc.mainTopic));
  };

  return (
    <Page>
      <BackLink><Link to="/community">Community</Link></BackLink>

      {/* ── Banner ── */}
      <IdentityBanner
        className="mb-6"
        seed={person.id}
        name={name}
        handle={person.username}
        bio={person.bio}
        avatarUrl={person.avatarUrl}
        meta={<>
          {joined && (
            <Row inline align="center" gap={1.5} as="span"><Calendar className="h-3 w-3" /> Joined {joined}</Row>
          )}
          <Row inline align="center" gap={1.5} as="span">
            <BookOpen className="h-3 w-3" />
            {published.length} published {published.length === 1 ? "document" : "documents"}
          </Row>
        </>}
        actions={isSelf && (
          /* Your own public profile is a preview of how you look to others, so
             the way back to changing it belongs here. "Edit profile" covers the
             public half — name, handle, bio; "Settings" is the private half,
             which was reachable only by navigating away entirely. */
          <Row align="center" gap={2} as="span">
            <Button asChild variant="secondary" size="md">
              <Link to="/profile/edit">Edit profile</Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link to="/profile"><Settings2 className="h-3.5 w-3.5" /> Settings</Link>
            </Button>
          </Row>
        )}
      />

      {/* ── Published work ── */}
      <PageHeader
        level="section"
        title="Published"
        subtitle={`Documents ${isSelf ? "you have" : `${name} has`} shared publicly.`}
        className="mb-4"
      />

      {published.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="muted"
          title="Nothing published yet"
          description={isSelf
            ? "Make a document public from your workspace to show it here."
            : "Check back later."}
        />
      ) : (
        <Grid gap={2} cols={{ sm: 2 }}>
          {published.map(doc => {
            const format = formatOf(doc.mainTopic);
            const isLatex = format === "latex";
            const Icon = isLatex ? FileCode2 : FileType2;
            return (
              <button key={doc.id} className="pub-row" onClick={() => openDoc(doc)}>
                <DocTypeIcon type={format} icon={Icon} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[13px] font-medium text-[var(--ink)] truncate">{doc.name}</span>
                  <Text size="2xs" tone="ghost" as="span" className="block">
                    {isLatex ? "LaTeX" : "MDX"}
                    {doc.updatedAt && ` · ${formatDate(doc.updatedAt)}`}
                  </Text>
                </span>
              </button>
            );
          })}
        </Grid>
      )}
    </Page>
  );
}
