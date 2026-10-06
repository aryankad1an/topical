import { useState } from 'react';
import { toast } from 'sonner';
import { uploadFile } from '@/lib/api';
import { Field, Input, Button, Spinner, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (url: string) => void;
}

/** Upload a picture or point at one, then place it in the document. */
export function ImageDialog({ open, onOpenChange, onInsert }: Props) {
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      setUrl(await uploadFile(file));
      toast.success('Uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) setUrl(''); }}>
      <DialogContent className="sm:max-w-md dialog-dark">
        <DialogHeader>
          <DialogTitle className="text-[var(--ink)] text-sm">Insert an image</DialogTitle>
          <DialogDescription className="text-[var(--ink-faint)] text-xs">
            Upload from this device, or paste a link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <Field id="image-file" label="From your device" hint={uploading ? <><Spinner size="xs" /> Uploading…</> : undefined}>
            <Input
              id="image-file"
              type="file"
              variant="file"
              accept="image/*"
              onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); }}
            />
          </Field>
          <Field id="image-url" label="Or a URL">
            <Input id="image-url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
          </Field>
          {url && <img src={url} alt="" className="image-preview" />}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => { onInsert(url.trim()); onOpenChange(false); setUrl(''); }}
            disabled={!url.trim()}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
