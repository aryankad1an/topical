import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoTopic } from './topics';

/**
 * The clock behind the hero demonstration.
 *
 * Everything visible is derived from a single integer tick rather than a
 * chain of `setTimeout`s. A chain has to be torn down and rebuilt every time
 * the sequence is paused, resumed, jumped or cancelled, and each of those is
 * a place for a stray timer to survive and fight the next one. One counter
 * and one pure function of it means pausing is "stop incrementing", jumping
 * is "assign", and there is no state to get out of sync with itself.
 *
 * The sequence per topic, in ticks:
 *
 *   type ── settle ── outline builds ── §1 written ── §2 being written ── hold ── erase
 *
 * It stops after two sections on purpose. The product writes a section at a
 * time into an outline you approved first, so a demo that fills every row
 * would be advertising a different product — the two rows left at "—" are
 * the honest part of the picture.
 */

const TICK_MS = 45;

const SETTLE = 5;      // the beat where the old document clears for the new one
const PER_ROW = 5;     // each outline row arrives 225ms after the last
const SECTION_1 = 11;  // first section written
const SECTION_2 = 15;  // second section arrives and stays mid-word
const HOLD = 70;       // ~3.2s to actually read it
const ERASE_RATE = 2;  // characters removed per tick — leaving is faster than arriving

export interface DemoFrame {
  /** The topic in the field. */
  index: number;
  topic: DemoTopic;
  /**
   * The topic the *document* is showing, which is not always the one in the
   * field. While a new topic is being typed the previous document stays up:
   * an editor that blanks itself the moment you touch the search box looks
   * like it threw the work away, and the claim being made is the opposite of
   * that. The two only diverge for the second or so that typing takes.
   */
  previewTopic: DemoTopic;
  /** What the field shows being typed. */
  typed: string;
  /** Outline rows revealed in the rail, 0…sections.length. */
  railCount: number;
  /** Sections present in the document, 0…2. */
  docCount: number;
  /** True once the topic is fully typed — the point the outline can exist. */
  settled: boolean;
}

function typeTicks(t: DemoTopic) {
  return t.topic.length;
}
function eraseTicks(t: DemoTopic) {
  return Math.ceil(t.topic.length / ERASE_RATE);
}
function totalTicks(t: DemoTopic, rows: number) {
  return typeTicks(t) + SETTLE + rows * PER_ROW + SECTION_1 + SECTION_2 + HOLD + eraseTicks(t);
}

/** The tick at which a topic's outline is complete and both sections are in. */
function restingTick(topics: DemoTopic[], index: number) {
  let base = 0;
  for (let i = 0; i < index; i++) base += totalTicks(topics[i], topics[i].sections.length);
  const t = topics[index];
  return base + typeTicks(t) + SETTLE + t.sections.length * PER_ROW + SECTION_1 + SECTION_2;
}

/**
 * The tick at which a topic's first outline row lands.
 *
 * Deliberately past the clear beat. The auto-cycle earns that empty frame —
 * it is the old document being put away — but a visitor who just picked a
 * topic asked for something to be built, and answering with a blank window
 * reads as a reset rather than a start.
 */
function outlineTick(topics: DemoTopic[], index: number) {
  let base = 0;
  for (let i = 0; i < index; i++) base += totalTicks(topics[i], topics[i].sections.length);
  return base + typeTicks(topics[index]) + SETTLE;
}

function frameAt(topics: DemoTopic[], tick: number): DemoFrame {
  const cycle = topics.reduce((n, t) => n + totalTicks(t, t.sections.length), 0);
  let rem = ((tick % cycle) + cycle) % cycle;

  for (let index = 0; index < topics.length; index++) {
    const topic = topics[index];
    const previous = topics[(index - 1 + topics.length) % topics.length];
    const rows = topic.sections.length;
    const span = totalTicks(topic, rows);
    if (rem >= span) {
      rem -= span;
      continue;
    }

    const full = topic.topic;
    let at = rem;

    // Typing: the last topic's finished document is still on screen.
    const typing = typeTicks(topic);
    if (at < typing) {
      return {
        index, topic, previewTopic: previous, settled: false,
        typed: full.slice(0, at + 1),
        railCount: previous.sections.length, docCount: 2,
      };
    }
    at -= typing;

    // The one beat where the pane is empty: the old document has cleared and
    // the new outline has not arrived. Short enough to read as a wipe.
    if (at < SETTLE) {
      return { index, topic, previewTopic: topic, typed: full, railCount: 0, docCount: 0, settled: true };
    }
    at -= SETTLE;

    const outlining = rows * PER_ROW;
    if (at < outlining) {
      return {
        index, topic, previewTopic: topic, typed: full, settled: true,
        railCount: Math.min(rows, Math.floor(at / PER_ROW) + 1),
        docCount: 0,
      };
    }
    at -= outlining;

    if (at < SECTION_1) {
      return { index, topic, previewTopic: topic, typed: full, railCount: rows, docCount: 1, settled: true };
    }
    at -= SECTION_1;

    if (at < SECTION_2 + HOLD) {
      return { index, topic, previewTopic: topic, typed: full, railCount: rows, docCount: 2, settled: true };
    }
    at -= SECTION_2 + HOLD;

    // Erasing. The document stays put while the field empties: what is being
    // demonstrated is that the topic is the only input, not that the work
    // evaporates when the input changes.
    const left = Math.max(0, full.length - (at + 1) * ERASE_RATE);
    return {
      index, topic, previewTopic: topic, settled: false,
      typed: full.slice(0, left),
      railCount: rows, docCount: 2,
    };
  }

  const first = topics[0];
  return {
    index: 0, topic: first, previewTopic: first, typed: first.topic,
    railCount: 0, docCount: 0, settled: true,
  };
}

export interface TopicDemo {
  frame: DemoFrame;
  /** True once the visitor has typed in the field — the demo never resumes. */
  taken: boolean;
  /** Attach to the hero: the clock only runs while it is on screen. */
  observe: (node: HTMLElement | null) => void;
  /** Hand the field over to the visitor, leaving the preview on a whole frame. */
  take: () => void;
  /** Jump the demonstration to a topic and let it build from there. */
  jumpTo: (index: number) => void;
}

export function useTopicDemo(topics: DemoTopic[], reduced: boolean): TopicDemo {
  // First paint lands on a finished document, part-way into its hold, rather
  // than on an empty window slowly filling. A visitor who bounces after two
  // seconds should still have seen the product, and one who stays gets the
  // whole topic-to-document sequence a beat later.
  const [tick, setTick] = useState(() => restingTick(topics, 0) + SECTION_2 + 20);
  const [taken, setTaken] = useState(false);
  const [visible, setVisible] = useState(true);
  const tickRef = useRef(0);
  tickRef.current = tick;
  // Read inside `take`, which fires on the focus event and must not depend on
  // the render that set `taken` having happened yet.
  const takenRef = useRef(false);

  const frame = useMemo(
    () => frameAt(topics, reduced ? restingTick(topics, 0) : tick),
    [topics, tick, reduced],
  );

  // Reduced motion gets the finished picture, not a faster version of the
  // performance: the sequence is the motion, so there is nothing left of it
  // to soften. Nothing here runs a timer in that case.
  const running = !taken && !reduced && visible;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  // A demonstration nobody is looking at is a timer nobody is looking at.
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const observe = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && !document.hidden),
      { threshold: 0.08 },
    );
    io.observe(node);
    observerRef.current = io;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);

  // Freezing mid-keystroke would leave a half-typed topic sitting above a
  // half-built outline, which looks like the page broke at the moment it was
  // touched. Snap to the resting frame of whatever topic was on screen.
  const take = useCallback(() => {
    if (takenRef.current) return;
    takenRef.current = true;
    const current = frameAt(topics, tickRef.current);
    setTick(restingTick(topics, current.index));
    setTaken(true);
  }, [topics]);

  const jumpTo = useCallback((index: number) => {
    takenRef.current = false;
    setTaken(false);
    setTick(outlineTick(topics, index));
  }, [topics]);

  return { frame, taken, observe, take, jumpTo };
}
