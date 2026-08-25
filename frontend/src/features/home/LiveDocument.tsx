import { Plus } from 'lucide-react';
import type { DemoFrame } from './useTopicDemo';

/**
 * The editor, in miniature, driven by whatever topic the hero currently holds.
 *
 * It shows rather than announces. Nothing here is captioned "generated" or
 * "placed at your cursor" — those are marketing sentences in a UI costume,
 * and no editor has ever labelled its own text that way. The same facts are
 * carried by the things a real editor would already be doing: the rail
 * reports per-section state, a change bar marks what just arrived, the prose
 * stops mid-word behind a live caret, and the status bar says what the
 * application is busy with.
 *
 * The rail and the page agree line for line. A rail listing six sections over
 * a document showing one heading is a mock of an outline editor whose outline
 * does not match its document — advertising the single thing the product must
 * never do. Written rows have their heading below, in order; queued rows have
 * none, because nothing has been written into them yet.
 */
export function LiveDocument({ frame }: { frame: DemoFrame }) {
  const { previewTopic: topic, railCount, docCount } = frame;
  const sections = topic.sections;
  // The window is "holding a document" whenever the rail has rows in it —
  // which includes the second or so where a new topic is being typed over
  // the last one's finished document. Keying this off the field's own state
  // instead blanked the title of a document that was still on screen.
  const hasDocument = railCount > 0;
  const writingIndex = docCount - 1;

  const words = docCount === 0
    ? 0
    : topic.introWords + sections.slice(0, docCount).reduce((n, s) => n + s.words, 0);

  return (
    <div className="preview-window" aria-hidden="true">
      <div className="preview-chrome">
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span key={topic.docTitle} className="preview-title preview-swap">
          {hasDocument ? topic.docTitle : 'Untitled document'}
        </span>
      </div>

      <div className="preview-body">
        <div className="preview-rail">
          <div className="preview-rail-head">
            <span className="preview-rail-label">Outline</span>
            <span className="preview-rail-count">{railCount || '—'}</span>
          </div>

          {sections.slice(0, railCount).map((section, i) => {
            const written = i < writingIndex;
            const active = i === writingIndex;
            return (
              <div
                key={`${topic.topic}-${section.heading}`}
                className={
                  'preview-node preview-enter' +
                  (active ? ' preview-node--active' : written ? '' : ' preview-node--queued')
                }
              >
                <span className="preview-node-text">{section.heading}</span>
                {active ? (
                  <span className="preview-pulse"><i /><i /><i /></span>
                ) : (
                  <span className="preview-node-meta">{written ? section.words : '—'}</span>
                )}
              </div>
            );
          })}

          {/* The real rail closes with this row; without it the mock reads as
              a list that got cut off. */}
          {railCount === sections.length && (
            <div className="preview-node preview-node--add preview-enter">
              <Plus className="h-2.5 w-2.5" /> Add section
            </div>
          )}
        </div>

        <div className="preview-pane">
          <article className="preview-doc">
            {hasDocument && (
              <h3 key={topic.topic} className="preview-doc-title preview-enter">
                {topic.topic}
              </h3>
            )}

            {docCount > 0 && (
              <p key={`${topic.topic}-intro`} className="preview-doc-p preview-enter">
                {topic.intro}
              </p>
            )}

            {sections.slice(0, docCount).map((section, i) => {
              const body = (
                <>
                  <h4 className="preview-doc-h">{section.heading}</h4>
                  <p className="preview-doc-p">
                    {section.body}
                    {section.cite && <sup className="preview-cite">{section.cite}</sup>}
                  </p>
                  {section.figure && <p className="preview-eq">{section.figure}</p>}
                  {section.bullets && (
                    <ul className="preview-doc-list">
                      {section.bullets.map((b, bi) => (
                        <li key={b.lead}>
                          <strong>{b.lead}</strong> {b.rest}
                          {/* Stops mid-word behind the caret, because that is
                              what text arriving a token at a time looks like. */}
                          {bi === section.bullets!.length - 1 && <span className="preview-caret" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );

              // A change bar in the gutter — the convention every editor
              // already uses for "this is new" — rather than a captioned box.
              return i === writingIndex ? (
                <div key={`${topic.topic}-${section.heading}`} className="preview-fresh preview-enter">
                  {body}
                </div>
              ) : (
                <div key={`${topic.topic}-${section.heading}`} className="preview-enter">{body}</div>
              );
            })}
          </article>
        </div>
      </div>

      <div className="preview-status">
        <span className="preview-status-badge">{topic.kind}</span>
        <span className="preview-status-item">{words} words</span>
        <span className="preview-status-item preview-status-item--wide">
          {docCount > 0 ? `${topic.sources} sources` : 'no sources yet'}
        </span>
        <span className="preview-status-live">
          <i className="preview-status-dot" />
          {docCount > 0
            ? `Writing “${sections[writingIndex].heading}”`
            : railCount > 0
              ? 'Planning the outline'
              : 'Waiting for a topic'}
        </span>
      </div>
    </div>
  );
}
