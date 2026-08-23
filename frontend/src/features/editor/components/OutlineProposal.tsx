import { Wand2, X } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import type { RefinedPlan } from '../lib/generation';

const KIND_LABEL: Record<string, string> = {
  moved: 'Moved', renamed: 'Renamed', added: 'Added',
  removed: 'Removed', nested: 'Nested', split: 'Split',
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
      <div className="orail-proposal-head">
        <Wand2 className="h-3 w-3" />
        <span>Proposed structure</span>
        <IconButton className="ml-auto" onClick={onDiscard} aria-label="Discard">
          <X className="h-3 w-3" />
        </IconButton>
      </div>

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
              <span className="orail-kind" data-kind={change.kind}>
                {KIND_LABEL[change.kind] ?? change.kind}
              </span>
              <div>
                <div className="orail-change-title">{change.title}</div>
                <div className="orail-change-reason">{change.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="orail-proposal-actions">
        <button className="orail-go" onClick={onApply}>Apply</button>
        <button className="orail-link" onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}
