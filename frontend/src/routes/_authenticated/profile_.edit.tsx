import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AtSign, Check, AlertCircle } from 'lucide-react';
import { Button, PageHeader, Surface, LoadingState, BackLink, Page, Text, Row } from '@/components/ui';
import { useAuth } from "@/lib/auth-context";
import { updateProfile } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
// The server enforces this same rule on PATCH /api/profile.
import { usernameProblem } from "@/lib/validation";
import { ProfileEditorFields } from "@/components/ProfileEditorFields";

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
      <LoadingState size="region" />
    );
  }

  return (
    <Page width="narrow">
      <BackLink><Link to="/profile">Back to profile</Link></BackLink>

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
              <Text tone="faint" as="span">
                Your profile will be at <span className="person-handle">/u/{username}</span>
              </Text>
            </>
          ) : (
            <>
              <AtSign className="h-3.5 w-3.5 shrink-0 mt-px text-[var(--ink-ghost)]" />
              <Text tone="faint" as="span">
                A username is required before you can publish documents to the community.
              </Text>
            </>
          )}
        </div>
      </Surface>

      <Row align="center" gap={3}>
        <Button variant="primary" size="lg" onClick={handleSave} loading={isSaving} disabled={!dirty || !!usernameError}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
        <Link to="/profile"
          className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors"
          style={{ textDecoration: "none" }}>
          Cancel
        </Link>
        {dirty && <Text size="2xs" tone="ghost" as="span" className="ml-auto">Unsaved changes</Text>}
      </Row>
    </Page>
  );
}
