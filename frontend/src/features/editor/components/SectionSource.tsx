import { Cpu, Globe, Link2, Plus, X } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import type { GenerationMethod } from '../lib/generation';

const METHODS: { key: GenerationMethod; icon: typeof Globe; label: string; hint: string }[] = [
  { key: 'web', icon: Globe, label: 'Web', hint: 'Research the section online first' },
  { key: 'llm', icon: Cpu, label: 'Model', hint: "Use the model's own knowledge" },
  { key: 'urls', icon: Link2, label: 'URLs', hint: 'Ground it in pages you choose' },
];

/** More than a handful of sources stops being a choice and starts being a list. */
const MAX_URLS = 4;

interface Props {
  method: GenerationMethod;
  onMethod: (method: GenerationMethod) => void;
  urls: string[];
  onUrls: (urls: string[]) => void;
  /** True when "URLs" is chosen but none have been entered yet. */
  needsUrls: boolean;
}

/** What the model is grounded in when it writes a section. */
export function SectionSource({ method, onMethod, urls, onUrls, needsUrls }: Props) {
  return (
    <div className="outline-source">
      <div className="method-switch">
        {METHODS.map(m => (
          <button key={m.key} className="method-btn" data-active={method === m.key}
            onClick={() => onMethod(m.key)} title={m.hint}>
            <m.icon className="h-3 w-3" />{m.label}
          </button>
        ))}
      </div>

      {method === 'urls' && (
        <div className="orail-urls">
          {urls.map((url, i) => (
            <div key={i} className="flex gap-1">
              <input
                className="orail-input" placeholder="https://…" value={url}
                onChange={e => onUrls(urls.map((u, j) => (j === i ? e.target.value : u)))}
              />
              {urls.length > 1 && (
                <IconButton tone="danger" onClick={() => onUrls(urls.filter((_, j) => j !== i))} aria-label="Remove URL">
                  <X className="h-3 w-3" />
                </IconButton>
              )}
            </div>
          ))}
          {urls.length < MAX_URLS && (
            <button className="orail-link" onClick={() => onUrls([...urls, ''])}>
              <Plus className="h-2.5 w-2.5" /> Add URL
            </button>
          )}
          {needsUrls && <p className="ai-field-note">Add a URL to write sections from these pages.</p>}
        </div>
      )}
    </div>
  );
}
