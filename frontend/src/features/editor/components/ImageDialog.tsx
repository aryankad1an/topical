import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { uploadFile } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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
          <div>
            <label className="text-[11px] text-[var(--ink-muted)] mb-1 block">From your device</label>
            <input
              type="file"
              accept="image/*"
              className="text-xs text-[var(--ink-muted)]"
              onChange={event => { const file = event.target.files?.[0]; if (file) upload(file); }}
            />
            {uploading && (
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--ink-faint)]">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-[var(--ink-muted)] mb-1 block">Or a URL</label>
            <Input placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} className="glass-input text-xs" />
          </div>
          {url && <img src={url} alt="" className="image-preview" />}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="glass-btn border-[var(--line)] text-xs h-8">
            Cancel
          </Button>
          <Button
            onClick={() => { onInsert(url.trim()); onOpenChange(false); setUrl(''); }}
            disabled={!url.trim()}
            className="text-[var(--accent-ink)] font-semibold text-xs h-8"
            style={{ background: 'var(--accent-400)' }}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
