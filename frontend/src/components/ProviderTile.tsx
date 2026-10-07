import type { ReactNode } from 'react';
import { Chip, Row } from '@/components/ui';
import { type AiCredential, presetFor } from '@/lib/aiCredentials';

/**
 * One connected AI provider: its brand mark, its name, the model it will use,
 * and — on the providers screen — the actions that apply to it. The profile
 * and the providers screen each drew this tile by hand.
 */
export function ProviderTile({ credential, actions }: { credential: AiCredential; actions?: ReactNode }) {
  const preset = presetFor(credential.provider);
  return (
    <div className="provider-tile" data-default={credential.isDefault}
      style={{ ['--brand' as string]: preset.color }}>
      <span className="provider-mark">{preset.name[0]}</span>
      <div className="min-w-0 flex-1">
        <Row align="center" gap={1.5}>
          <span className="provider-name">{preset.name}</span>
          {credential.isDefault && <Chip size="xs" caps tone="brand">Default</Chip>}
        </Row>
        <p className="provider-model truncate">{credential.model}</p>
      </div>
      {actions}
    </div>
  );
}
