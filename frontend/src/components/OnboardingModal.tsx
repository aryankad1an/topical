import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProfileEditorFields } from "@/components/ProfileEditorFields";
import { useAuth } from "@/lib/auth-context";
import { updateProfile } from "@/lib/api";
import { errorMessage } from "@/lib/utils";

/** Shown once, right after a brand-new account is created. */
export function OnboardingModal() {
  const { user, isNewUser, refetchUser } = useAuth();
  const [open, setOpen] = useState(false);
  /**
   * Whether this browser has already finished with the modal.
   *
   * A ref rather than state, and that is the whole bug fix. Saving calls
   * `refetchUser()`, which replaces the cached user object; the effect below
   * depends on `user`, so it re-runs. React flushed that run *before* it had
   * committed a `setDismissed(true)` issued in the same handler, so the effect
   * still saw `dismissed === false` and re-opened the modal it had just been
   * told to close — every save reopened the dialog, while skipping (which does
   * not refetch) closed it correctly.
   *
   * A ref is written synchronously, so it is already true by the time that
   * racing effect runs. It is also the honest type for this: "has the person
   * dealt with this modal" is a fact about this mounted instance, not
   * something the UI renders from.
   */
  const dismissedRef = useRef(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isNewUser && user && !dismissedRef.current) setOpen(true);
  }, [isNewUser, user]);

  const close = () => {
    dismissedRef.current = true;
    setOpen(false);
  };

  const handleSave = async () => {
    if (username && username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    setIsSaving(true);
    try {
      const update: Record<string, string | null> = {};
      if (username) update.username = username;
      if (bio) update.bio = bio;
      if (avatarUrl) update.avatarUrl = avatarUrl;

      if (Object.keys(update).length > 0) {
        await updateProfile(update);
        await refetchUser?.();
      }
      toast.success("Profile set up!");
      close();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save profile"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to Topical!</DialogTitle>
          <DialogDescription>
            Set up your profile — you can always change this later from Profile.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isSaving}>Skip for now</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</> : "Save & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
