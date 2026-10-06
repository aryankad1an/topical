import { Wand2 } from 'lucide-react';
import { Button, Chip, type ChipTone, TextLink, PanelHeader } from '@/components/ui';
import type { RefinedPlan } from '../lib/generation';

const KIND_LABEL: Record<string, string> = {
  moved: 'Moved', renamed: 'Renamed', added: 'Added',
  removed: 'Removed', nested: 'Nested', split: 'Split',
};

/** Additions read as growth, removals as loss, moves as the accent; the rest stay neutral. */
const KIND_TONE: Record<string, ChipTone> = {
  added: 'success', removed: 'danger', moved: 'accent', nested: 'accent',
};

interface Props {
  proposal: RefinedPlan;
  onApply: () => void;
  onDiscard: () => void;
}

/**
 * A structure the model proposes, shown next to the reasons for each change.
 *
 * Never applied on arrival. The outline *is* the document, so accepting one
 * rewrites the page — and a restructure that lands silently is one nobody can
 * check. The reasons are the point: a finished list with no account of what
 * moved is something the writer has to reverse-engineer before trusting it.
 */
export function OutlineProposal({ proposal, onApply, onDiscard }: Props) {
  return (
    <div className="orail-proposal">
      <PanelHeader icon={<Wand2 className="h-3 w-3" />} title="Proposed structure" onClose={onDiscard} closeLabel="Discard" />

      {proposal.summary && <p className="orail-summary">{proposal.summary}</p>}

      <div className="orail-preview">
        {proposal.plan.map(item => (
          <div key={item.id} className="orail-preview-row" style={{ paddingLeft: (item.level - 1) * 12 }}>
            {item.title}
          </div>
        ))}
      </div>

      {proposal.changes.length > 0 && (
        <div className="orail-changes">
          {proposal.changes.map((change, i) => (
            <div key={i} className="orail-change">
              <Chip size="xs" caps tone={KIND_TONE[change.kind] ?? 'neutral'} className="orail-kind">
                {KIND_LABEL[change.kind] ?? change.kind}
              </Chip>
              <div>
                <div className="orail-change-title">{change.title}</div>
                <div className="orail-change-reason">{change.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="orail-proposal-actions">
        <Button variant="primary" size="xs" onClick={onApply}>Apply</Button>
        <TextLink size="2xs" onClick={onDiscard}>Discard</TextLink>
      </div>
    </div>
  );
}
