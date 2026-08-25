import { useState } from 'react';
import { FileDown, Loader2, X } from 'lucide-react';
import { useDialogDismiss } from '@/hooks/useDialogDismiss';
import {
  PDF_DEFAULTS, exportPdf,
  type PdfOptions, type PdfTheme, type PdfAccent, type PdfPage, type PdfMargin, type PdfFace,
} from '../lib/pdfExport';

/** One labelled row of mutually exclusive choices. */
function Choice<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; swatch?: string }[];
}) {
  return (
    <div className="pdf-field">
      <span className="pdf-field-label">{label}</span>
      <div className="pdf-choices" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className="pdf-choice"
            data-active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.swatch && <span className="pdf-swatch" style={{ background: option.swatch }} />}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * What the PDF should look like, decided before it is made.
 *
 * The export used to be a single "Print" button with no say in any of it —
 * whatever the app's current theme happened to be, at whatever page size the
 * browser defaulted to. A document that is about to leave the application and
 * be read somewhere else is exactly the point at which those are worth asking
 * about, and it is the last moment they can be changed cheaply.
 */
export function ExportPdfDialog({
  title, author, getHtml, onClose,
}: {
  title: string;
  author?: string | null;
  /** Read lazily: the preview keeps rendering while this dialog is open. */
  getHtml: () => string | null;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<PdfOptions>(PDF_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  const set = <K extends keyof PdfOptions>(key: K, value: PdfOptions[K]) =>
    setOptions(current => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const html = getHtml();
    if (!html) {
      setError('There is nothing rendered to export yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await exportPdf({ title, author, html }, options);
      onClose();
    } catch {
      setError('Could not build the document. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="post-detail-overlay" onClick={onClose}>
      <form className="pdf-dialog" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="post-detail-header">
          <span className="text-sm font-semibold text-[var(--ink-2)] flex items-center gap-2">
            <FileDown className="h-4 w-4" /> Export PDF
          </span>
          <button type="button" className="detail-close-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="pdf-body">
          <Choice<PdfTheme>
            label="Theme" value={options.theme} onChange={v => set('theme', v)}
            options={[
              { value: 'paper', label: 'Paper', swatch: '#faf9f5' },
              { value: 'plain', label: 'Plain', swatch: '#ffffff' },
              { value: 'ink', label: 'Ink', swatch: '#191714' },
            ]}
          />

          <Choice<PdfAccent>
            label="Accent" value={options.accent} onChange={v => set('accent', v)}
            options={[
              { value: 'terracotta', label: 'Terracotta', swatch: '#c25e38' },
              { value: 'indigo', label: 'Indigo', swatch: '#4a5b8c' },
              { value: 'forest', label: 'Forest', swatch: '#3d6b4a' },
              { value: 'none', label: 'None' },
            ]}
          />

          <Choice<PdfFace>
            label="Typeface" value={options.face} onChange={v => set('face', v)}
            options={[{ value: 'serif', label: 'Serif' }, { value: 'sans', label: 'Sans' }]}
          />

          <Choice<PdfPage>
            label="Page" value={options.page} onChange={v => set('page', v)}
            options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }]}
          />

          <Choice<PdfMargin>
            label="Margins" value={options.margin} onChange={v => set('margin', v)}
            options={[
              { value: 'narrow', label: 'Narrow' },
              { value: 'normal', label: 'Normal' },
              { value: 'wide', label: 'Wide' },
            ]}
          />

          <div className="pdf-field">
            <span className="pdf-field-label">Include</span>
            <div className="pdf-toggles">
              <label className="pdf-toggle">
                <input type="checkbox" checked={options.titlePage}
                  onChange={e => set('titlePage', e.target.checked)} />
                Title page
              </label>
              <label className="pdf-toggle">
                <input type="checkbox" checked={options.colourCode}
                  onChange={e => set('colourCode', e.target.checked)} />
                Colour in code blocks
              </label>
              <label className="pdf-toggle">
                <input type="checkbox"
                  checked={options.edgeToEdge || options.theme === 'ink'}
                  disabled={options.theme === 'ink'}
                  onChange={e => set('edgeToEdge', e.target.checked)} />
                <span>
                  Hide the browser's date &amp; URL
                  <span className="pdf-toggle-note">
                    {options.theme === 'ink'
                      ? 'Always on for Ink, which needs the full page.'
                      : 'Removes the page margin they print in; later pages get less top space.'}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {error && <p className="pdf-error">{error}</p>}

          {/* Said plainly rather than discovered: the browser owns the last
              step, and a person who expected a file to land in Downloads
              should know where the file actually comes from — and that the
              date-and-URL line across the top is its setting, not ours. */}
          <p className="pdf-note">
            Opens your browser's print dialog — choose <b>Save as PDF</b> as the destination.
            Text stays selectable and equations stay typeset.
            {options.theme !== 'ink' && !options.edgeToEdge && (
              <> The date and URL across the page are the dialog's <b>Headers and footers</b> setting —
              untick it there, or use the option above.</>
            )}
          </p>

          <button type="submit" className="accent-btn pdf-submit" disabled={busy}>
            {busy
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
              : <><FileDown className="h-4 w-4" /> Export PDF</>}
          </button>
        </div>
      </form>
    </div>
  );
}
