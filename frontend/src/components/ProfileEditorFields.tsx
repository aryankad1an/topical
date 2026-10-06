import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button, Input, Textarea, Avatar, Spinner, Field, Row, Text } from '@/components/ui';
import { uploadFile } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
// The same ceiling the server stores to, and the schema rejects past.
import { MAX_BIO_LENGTH } from "@/lib/validation";

interface ProfileEditorFieldsProps {
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
  fallbackAvatar?: string | null;
  fallbackInitial?: string;
  username: string;
  onUsernameChange: (value: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  disabled?: boolean;
}

/** Avatar upload + username + bio fields, shared between the onboarding modal and the Profile page. */
export function ProfileEditorFields({
  avatarUrl,
  onAvatarChange,
  fallbackAvatar,
  fallbackInitial = "U",
  username,
  onUsernameChange,
  bio,
  onBioChange,
  disabled,
}: ProfileEditorFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);
    try {
      const url = await uploadFile(file);
      onAvatarChange(url);
      // Drop the local preview only once the uploaded URL is in hand, and
      // revoke it only after it is no longer what the <img> points at.
      // Revoking it in a `finally` while `displayedAvatar` still preferred it
      // left the element pointing at a dead blob: the avatar went blank the
      // moment the upload succeeded.
      setPreviewUrl(null);
      URL.revokeObjectURL(localPreview);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload image"));
      setPreviewUrl(null);
      URL.revokeObjectURL(localPreview);
    } finally {
      setIsUploading(false);
    }
  };

  const displayedAvatar = previewUrl || avatarUrl || fallbackAvatar || undefined;

  return (
    <div className="space-y-5">
      <Row align="center" gap={4}>
        <div className="relative">
          <Avatar size="lg" shape="circle" tone="muted" src={displayedAvatar} name={fallbackInitial} alt="Avatar" />
          {isUploading && (
            <div className="avatar-busy">
              <Spinner size="lg" tone="ink" />
            </div>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button type="button" variant="secondary" size="md" onClick={handlePickFile} disabled={disabled || isUploading}>
            <Upload className="h-3.5 w-3.5" /> Change photo
          </Button>
          <Text size="xs" tone="muted" className="mt-1.5">JPEG, PNG, GIF or WebP, up to 5MB.</Text>
        </div>
      </Row>

      <Field id="profile-username" label="Username">
        <Input
          id="profile-username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Choose a unique username"
          className="max-w-[280px]"
          disabled={disabled}
        />
      </Field>

      <Field id="profile-bio" label="Bio" count={{ value: bio.length, max: MAX_BIO_LENGTH }}>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value.slice(0, MAX_BIO_LENGTH))}
          placeholder="Tell the community a bit about yourself"
          rows={3}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
