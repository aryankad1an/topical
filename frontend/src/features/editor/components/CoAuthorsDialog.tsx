import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Users, X } from 'lucide-react';
import { searchUsername } from '@/lib/api';
import { Avatar, IconButton, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, SearchField, Text, Stack } from '@/components/ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coAuthors: string[];
  coAuthorUsernames: (string | null)[];
  /** Usernames are positional against `ids`, and null where unset. */
  onChange: (ids: string[], usernames: (string | null)[]) => void;
}

/** Add people who can open and edit this document live. */
export function CoAuthorsDialog({ open, onOpenChange, coAuthors, coAuthorUsernames, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => setResults(await searchUsername(query)), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const add = (id: string, username: string) => {
    if (coAuthors.includes(id)) return;
    onChange([...coAuthors, id], [...coAuthorUsernames, username]);
    toast.success(`${username} can now edit this document`);
  };

  const remove = (id: string) => {
    const index = coAuthors.indexOf(id);
    if (index < 0) return;
    const name = coAuthorUsernames[index] || id;
    onChange(coAuthors.filter(c => c !== id), coAuthorUsernames.filter((_, i) => i !== index));
    toast.success(`Removed ${name}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent material="solid" size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Share this document
          </DialogTitle>
          <DialogDescription>
            Collaborators see your cursor and edits as they happen.
          </DialogDescription>
        </DialogHeader>

        {/* The shared search field. Escape is left to the dialog, which closes. */}
        <SearchField
          className="mt-2"
          placeholder="Search by username…"
          aria-label="Search by username"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />

        {results.length > 0 && (
          <div className="share-results">
            {results.map(user => (
              <div key={user.id} className="share-row">
                <Avatar seed={user.id} name={user.username} size="xs" />
                <span className="share-name">{user.username}</span>
                <IconButton
                  onClick={() => add(user.id, user.username)}
                  disabled={coAuthors.includes(user.id)}
                  aria-label={`Add ${user.username}`}
                >
                  <UserPlus className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1">
          <h4 className="share-heading">Collaborators</h4>
          {coAuthors.length === 0 ? (
            <Text size="xs" tone="ghost">Only you can edit this document.</Text>
          ) : (
            <Stack gap={1.5}>
              {coAuthors.map((id, index) => (
                <div key={id} className="share-row share-row--filled">
                  <Avatar seed={id} name={coAuthorUsernames[index] || id} size="xs" />
                  <span className="share-name">{coAuthorUsernames[index] || id}</span>
                  <IconButton tone="danger" onClick={() => remove(id)} aria-label="Remove collaborator">
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              ))}
            </Stack>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
