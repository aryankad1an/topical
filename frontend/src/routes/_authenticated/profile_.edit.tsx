import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AtSign, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { updateProfile } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
// The server enforces this same rule on PATCH /api/profile.
import { usernameProblem } from "@/lib/validation";
import { ProfileEditorFields } from "@/components/ProfileEditorFields";
import { PageHeader, Surface } from "@/components/ui/primitives";

export const Route = createFileRoute("/_authenticated/profile_/edit")({
  component: EditProfile,
});

function EditProfile() {
  const { user, refetchUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || "");
    setBio(user.bio || "");
    setAvatarUrl(user.avatarUrl || null);
  }, [user?.username, user?.bio, user?.avatarUrl]);

  const dirty =
    username !== (user?.username || "") ||
    bio !== (user?.bio || "") ||
    avatarUrl !== (user?.avatarUrl || null);

  const usernameError = usernameProblem(username);

  const handleSave = async () => {
    if (usernameError) { toast.error(usernameError); return; }
    setIsSaving(true);
    try {
      await updateProfile({ username: username || undefined, bio, avatarUrl });
      await refetchUser?.();
      toast.success("Profile updated");
      navigate({ to: "/profile" });
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update profile"));
    } finally { setIsSaving(false); }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-faint)]" />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--narrow">
      <Link to="/profile"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
      </Link>

      <PageHeader
        className="mb-8"
        title="Edit profile"
        subtitle="This is what other members see on your public profile."
      />

      <Surface size="lg" padding="lg" className="mb-5">
        <ProfileEditorFields
          avatarUrl={avatarUrl}
          onAvatarChange={setAvatarUrl}
          fallbackAvatar={user.picture}
          fallbackInitial={user.given_name?.[0] || "U"}
          username={username}
          onUsernameChange={setUsername}
          bio={bio}
          onBioChange={setBio}
          disabled={isSaving}
        />

        {/* Live feedback on the one field with real rules attached. */}
        <div className="mt-3 flex items-start gap-2 text-[11.5px]">
          {usernameError ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" style={{ color: "var(--status-danger)" }} />
              <span style={{ color: "var(--status-danger)" }}>{usernameError}</span>
            </>
          ) : username ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0 mt-px" style={{ color: "var(--status-success)" }} />
              <span className="text-[var(--ink-faint)]">
                Your profile will be at <span className="person-handle">/u/{username}</span>
              </span>
            </>
          ) : (
            <>
              <AtSign className="h-3.5 w-3.5 shrink-0 mt-px text-[var(--ink-ghost)]" />
              <span className="text-[var(--ink-faint)]">
                A username is required before you can publish documents to the community.
              </span>
            </>
          )}
        </div>
      </Surface>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || !dirty || !!usernameError}
          className="accent-btn h-10 px-6 rounded-full text-sm">
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save changes"}
        </Button>
        <Link to="/profile"
          className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors"
          style={{ textDecoration: "none" }}>
          Cancel
        </Link>
        {dirty && <span className="text-[11px] text-[var(--ink-ghost)] ml-auto">Unsaved changes</span>}
      </div>
    </div>
  );
}
