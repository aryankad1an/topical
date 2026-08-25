import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Globe } from 'lucide-react';
import { DEMO_TOPICS } from './topics';
import { useTopicDemo } from './useTopicDemo';
import { LiveDocument } from './LiveDocument';

/** The OS setting, watched rather than read once — it can change mid-session. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Carried across the sign-up so the first project is not another blank page. */
function rememberTopic(topic: string) {
  try {
    localStorage.setItem('topical_pending_topic', topic);
  } catch {
    // Private mode blocks the write. Losing the topic is not worth a crash.
  }
}

/**
 * The hero.
 *
 * The old one set the word "Topical" at 5.5rem — the largest type on the page
 * spent saying the name that is already in the nav bar — over three stacked
 * paragraphs of decreasing size, and only then showed the product.
 *
 * This one makes the claim and then performs it in the same breath: the
 * headline says a topic is all it takes, the field below is given nothing but
 * a topic, and the document underneath builds itself out of that one input.
 * A visitor can check the promise without reading a single feature.
 *
 * The field is real. A fake input that swallows keystrokes to protect an
 * animation is the exact opposite of the point being made — typing in it
 * ends the demonstration for good, and the topic typed is carried into
 * sign-up.
 */
export function TopicHero({ startHref, startLabel }: { startHref: string; startLabel: string }) {
  const reduced = useReducedMotion();
  const { frame, taken, observe, take, jumpTo } = useTopicDemo(DEMO_TOPICS, reduced);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // An empty field submits whatever the demonstration is currently showing:
    // pressing the arrow is agreement with what is on screen.
    const topic = value.trim() || frame.topic.topic;
    rememberTopic(topic);
    navigate({ to: startHref });
  };

  return (
    <section className="hero" ref={observe}>
      <div className="hero-inner">
        <h1 className="hero-title animate-fade-in">
          All you need is <em className="hero-mark">a topic</em>
        </h1>

        <p className="hero-sub animate-fade-in-delay-1">
          Topical turns it into an outline you approve, researches every section against
          your document and the live web, and hands you a cited draft in a real editor.
        </p>

        <form className="topic-bar animate-fade-in-delay-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="hero-topic">Your topic</label>
          <div className="topic-field">
            <input
              id="hero-topic"
              ref={inputRef}
              className="topic-input"
              value={value}
              onChange={e => { take(); setValue(e.target.value); }}
              onFocus={take}
              placeholder={taken ? 'Type any topic…' : ''}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            {/* The typed topic lives in an overlay, not in the input's value:
                a value the visitor did not type is a value they then have to
                delete before they can type their own. */}
            {!taken && (
              <span className="topic-ghost" aria-hidden="true">
                {frame.typed}
                {!reduced && <i className="topic-caret" />}
              </span>
            )}
          </div>
          <button type="submit" className="accent-btn topic-go">
            <span className="topic-go-label">{startLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="topic-tries animate-fade-in-delay-2">
          <span className="topic-tries-label">Watch it build</span>
          {DEMO_TOPICS.map((t, i) => (
            <button
              key={t.topic}
              type="button"
              className="topic-try"
              data-current={!taken && frame.index === i}
              onClick={() => { setValue(''); jumpTo(i); }}
            >
              {t.topic}
            </button>
          ))}
        </div>

        <div className="hero-preview animate-fade-in-delay-3">
          <LiveDocument frame={frame} />
        </div>

        <p className="hero-aside animate-fade-in-delay-3">
          Free to start · bring your own model key ·{' '}
          <Link to="/community" className="hero-aside-link">
            <Globe className="h-3 w-3" />
            read what others published
          </Link>
        </p>
      </div>
    </section>
  );
}
