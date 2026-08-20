import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, BookOpen, FileType2, FileCode2, Calendar, UserX } from "lucide-react";
import { fetchPersonProfile, personName, type PublishedDoc } from "@/lib/api";
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
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full mx-auto py-16" style={{ maxWidth: "34rem", paddingInline: "var(--gutter)" }}>
        <EmptyState
          icon={UserX}
          tone="muted"
          title="Profile not found"
          description={error instanceof Error ? error.message : `No member goes by @${username}.`}
          action={
            <Link to="/community" className="text-xs text-white/45 hover:text-white/80 transition-colors">
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
  const joined = person.createdAt
    ? new Date(person.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const openDoc = (doc: PublishedDoc) => {
    navigate({ to: "/editor", search: { id: doc.id, type: doc.mainTopic.startsWith("latex:") ? "latex" : "mdx" } } as never);
  };

  return (
    <div className="w-full mx-auto py-10" style={{ maxWidth: "60rem", paddingInline: "var(--gutter)" }}>
      <Link to="/community"
        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/65 transition-colors mb-6">
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
          <Link to="/profile/edit"
            className="btn-subtle btn-subtle--pill h-9 px-4">
            Edit profile
          </Link>
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
            const isLatex = doc.mainTopic.startsWith("latex:");
            const Icon = isLatex ? FileCode2 : FileType2;
            return (
              <button key={doc.id} className="pub-row" onClick={() => openDoc(doc)}>
                <DocTypeIcon type={isLatex ? "latex" : "mdx"} icon={Icon} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[13px] font-medium text-white/85 truncate">{doc.name}</span>
                  <span className="block text-[11px] text-white/25">
                    {isLatex ? "LaTeX" : "MDX"}
                    {doc.updatedAt && ` · ${new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
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
