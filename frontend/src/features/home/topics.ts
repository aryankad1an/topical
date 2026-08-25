/**
 * The topics the landing page demonstrates itself with.
 *
 * The hero's claim is "all you need is a topic", so the hero has to be given
 * nothing but a topic and be seen producing the rest. Everything below is
 * what one topic expands into: a document title, an outline, and the first
 * sections written against it.
 *
 * The prose is real. A lorem-ipsum mock of a research tool advertises that
 * the output is not worth reading, and a reader who stops to read a sentence
 * here is exactly the reader worth having. Three fields — computer science,
 * biology, economic history — because a tool that only ever demos itself on
 * its author's own subject looks like it only works there.
 */

export interface DemoSection {
  heading: string;
  /** Shown in the rail once the section is written, as the real rail does. */
  words: number;
  body: string;
  /** A single set-off line: an equation, a sequence, a parity. Optional. */
  figure?: string;
  /** Only the last written section carries these, under a change bar. */
  bullets?: { lead: string; rest: string }[];
  /** Superscript marker on the body, matching a source in the status bar. */
  cite?: number;
}

export interface DemoTopic {
  /** What the visitor is shown typing. This is the entire input. */
  topic: string;
  docTitle: string;
  kind: 'MDX' | 'LaTeX';
  intro: string;
  introWords: number;
  sources: number;
  sections: DemoSection[];
}

export const DEMO_TOPICS: DemoTopic[] = [
  {
    topic: 'Dynamic programming',
    docTitle: 'Dynamic programming — lesson plan',
    kind: 'MDX',
    intro:
      'Dynamic programming solves a problem once per distinct subproblem and reuses the answer everywhere else it appears. It applies wherever two properties hold together.',
    introWords: 26,
    sources: 2,
    sections: [
      {
        heading: 'Overlapping subproblems',
        words: 34,
        cite: 1,
        body:
          'A plain recursion for Fibonacci recomputes F(3) five times at n = 8. The call tree grows exponentially while the number of distinct subproblems grows only linearly.',
      },
      {
        heading: 'Optimal substructure',
        words: 41,
        cite: 2,
        body:
          'An optimal solution is built from optimal solutions to its subproblems. That is what lets a table be filled from smaller entries to larger ones without ever revisiting a decision.',
        figure: 'dp[i][w] = max(dp[i-1][w], v[i] + dp[i-1][w-wt[i]])',
        bullets: [
          { lead: 'Define the state', rest: '— what a single entry stands for.' },
          { lead: 'Write the recurrence', rest: '— how one state is built from smalle' },
        ],
      },
      { heading: 'Tabulation', words: 29, body: '' },
      { heading: 'Space optimisation', words: 26, body: '' },
    ],
  },

  {
    topic: 'CRISPR gene editing',
    docTitle: 'CRISPR gene editing — literature review',
    kind: 'LaTeX',
    intro:
      'CRISPR–Cas9 is an RNA-guided nuclease: a short guide RNA supplies the address and the Cas9 protein makes the cut. Everything after the cut is the cell’s own repair machinery.',
    introWords: 29,
    sources: 3,
    sections: [
      {
        heading: 'Guide RNA targeting',
        words: 38,
        cite: 1,
        body:
          'A 20-nucleotide spacer base-pairs with the target strand, so retargeting the enzyme means resynthesising an oligo rather than re-engineering a protein.',
      },
      {
        heading: 'The PAM requirement',
        words: 33,
        cite: 2,
        body:
          'Cas9 will not cut unless a short protospacer-adjacent motif sits immediately 3′ of the target — NGG in S. pyogenes. The PAM is also what stops the enzyme from cleaving the locus that encodes it.',
        figure: "5′—[ N20 spacer ]—NGG—3′   ·   SpCas9",
        bullets: [
          { lead: 'Blunt cut', rest: '— three bases upstream of the PAM.' },
          { lead: 'Repair decides the outcome', rest: '— NHEJ leaves an indel, HDR copies a temp' },
        ],
      },
      { heading: 'NHEJ versus HDR', words: 30, body: '' },
      { heading: 'Off-target effects', words: 27, body: '' },
    ],
  },

  {
    topic: 'The Bretton Woods system',
    docTitle: 'Bretton Woods — seminar notes',
    kind: 'MDX',
    intro:
      'For a quarter-century after 1944 exchange rates were fixed against the dollar, and the dollar was fixed against gold. The arrangement held until the anchor could no longer carry the weight.',
    introWords: 31,
    sources: 2,
    sections: [
      {
        heading: 'Pegged exchange rates',
        words: 35,
        cite: 1,
        body:
          'Members declared a par value and defended it within one percent, devaluing only by agreement with the Fund. Capital controls were assumed rather than incidental.',
      },
      {
        heading: 'The dollar–gold anchor',
        words: 31,
        cite: 2,
        body:
          'Only the dollar was convertible into gold, only for foreign central banks, and only at a fixed parity. Every other currency reached gold through the dollar.',
        figure: '$35 / oz  ·  the parity, 1944 — 1971',
        bullets: [
          { lead: 'Reserves grew by US deficits', rest: '— which is what made the pledge doubtful.' },
          { lead: 'The Triffin dilemma', rest: '— the dollar had to be abundant and scar' },
        ],
      },
      { heading: 'The Triffin dilemma', words: 29, body: '' },
      { heading: 'Convertibility suspended', words: 24, body: '' },
    ],
  },
];
