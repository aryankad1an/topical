import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/api";
import { errorMessage } from "@/lib/utils";

const BIO_MAX_LENGTH = 280;

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
    } catch (error) {
      toast.error(errorMessage(error, "Failed to upload image"));
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  const displayedAvatar = previewUrl || avatarUrl || fallbackAvatar || undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            {displayedAvatar ? (
              <AvatarImage src={displayedAvatar} alt="Avatar" />
            ) : (
              <AvatarFallback className="text-lg">{fallbackInitial}</AvatarFallback>
            )}
          </Avatar>
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(25,25,23,0.45)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--ink)]" />
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
          <Button type="button" variant="outline" size="sm" onClick={handlePickFile} disabled={disabled || isUploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Change photo
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">JPEG, PNG, GIF or WebP, up to 5MB.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="profile-username" className="text-sm font-medium mb-2 block">Username</Label>
        <Input
          id="profile-username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Choose a unique username"
          className="max-w-[280px] bg-[var(--surface)] border-[var(--line)]"
          disabled={disabled}
        />
      </div>

      <div>
        <Label htmlFor="profile-bio" className="text-sm font-medium mb-2 block">Bio</Label>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value.slice(0, BIO_MAX_LENGTH))}
          placeholder="Tell the community a bit about yourself"
          className="bg-[var(--surface)] border-[var(--line)] resize-none"
          rows={3}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/{BIO_MAX_LENGTH}</p>
      </div>
    </div>
  );
}
