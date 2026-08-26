import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, BookOpen, FileType2, FileCode2, Calendar, UserX, Settings2 } from "lucide-react";
import { fetchPersonProfile, personName, type PublishedDoc } from "@/lib/api";
import { formatOf } from "@/lib/types";
import { documentRoute } from "@/lib/documentUrl";
import { formatDate, formatMonthYear } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { EmptyState, PageHeader, IdentityBanner, DocTypeIcon } from "@/components/ui/primitives";

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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-faint)]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-shell page-shell--narrow">
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
      </div>
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
    <div className="page-shell">
      <Link to="/community"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Community
      </Link>

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
            <span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Joined {joined}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            {published.length} published {published.length === 1 ? "document" : "documents"}
          </span>
        </>}
        actions={isSelf && (
          /* Your own public profile is a preview of how you look to others, so
             the way back to changing it belongs here. "Edit profile" covers the
             public half — name, handle, bio; "Settings" is the private half,
             which was reachable only by navigating away entirely. */
          <span className="flex items-center gap-2">
            <Link to="/profile/edit" className="btn-subtle btn-subtle--pill h-9 px-4">
              Edit profile
            </Link>
            <Link to="/profile" className="btn-subtle btn-subtle--pill h-9 px-4">
              <Settings2 className="h-3.5 w-3.5" /> Settings
            </Link>
          </span>
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
        <div className="grid gap-2 sm:grid-cols-2">
          {published.map(doc => {
            const format = formatOf(doc.mainTopic);
            const isLatex = format === "latex";
            const Icon = isLatex ? FileCode2 : FileType2;
            return (
              <button key={doc.id} className="pub-row" onClick={() => openDoc(doc)}>
                <DocTypeIcon type={format} icon={Icon} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[13px] font-medium text-[var(--ink)] truncate">{doc.name}</span>
                  <span className="block text-[11px] text-[var(--ink-ghost)]">
                    {isLatex ? "LaTeX" : "MDX"}
                    {doc.updatedAt && ` · ${formatDate(doc.updatedAt)}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
