import { Globe, Lock } from 'lucide-react';
import { Chip, ChipButton, Spinner } from '@/components/ui';

interface Props {
  isPublic: boolean;
  /** Whether this viewer may change it. Only the owner may. */
  canChange: boolean;
  /** A publish or unpublish is in flight for this document. */
  busy?: boolean;
  /** The document's name, for the accessible label. */
  name: string;
  onChange: (next: boolean) => void;
}

/**
 * Whether a document is on the community library — as one control, not two.
 *
 * A card used to carry a `Private` pill *and*, beside it, a bare switch. They
 * were the same fact stated twice: the pill said the state and the switch said
 * the state, and neither said which one you were meant to act on. The switch
 * also had no label at all, so what it published was only discoverable from a
 * tooltip.
 *
 * Now the label is the button. It states where the document stands and, for
 * the owner, flipping it is what changes that — with a confirmation in
 * between, because publishing is outward-facing and unpublishing breaks links
 * other people may already be holding.
 *
 * For anyone who is not the owner it is a plain label, not a disabled control:
 * a switch that refuses is worse than no switch.
 */
export function VisibilityChip({ isPublic, canChange, busy, name, onChange }: Props) {
  const Icon = isPublic ? Globe : Lock;
  const label = isPublic ? 'Public' : 'Private';

  const body = (
    <>
      {busy ? <Spinner size="2xs" /> : <Icon className="h-2.5 w-2.5" />}
      {label}
    </>
  );

  if (!canChange) {
    return <Chip tone={isPublic ? 'accent' : 'quiet'}>{body}</Chip>;
  }

  return (
    <ChipButton
      tone={isPublic ? 'accent' : 'quiet'}
      disabled={busy}
      onClick={() => onChange(!isPublic)}
      title={isPublic ? `Unpublish “${name}”` : `Publish “${name}” to the community`}
      aria-label={isPublic ? `Unpublish “${name}”` : `Publish “${name}” to the community`}
    >
      {body}
    </ChipButton>
  );
}
