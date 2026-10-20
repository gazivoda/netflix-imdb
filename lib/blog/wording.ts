// Wording rules for article prose: gap tier words (spec 3.4), always-forbidden
// words, banned phrases and claims (7.3), and direction detection. Shared by the
// copy lint, the schema checks and the writer brief. Pure data and functions.

import type { Archetype, Tier } from './stats';
import { maskedSentences, maskTitles } from './sentences';
import { stripTokens } from './tokens';

export interface WordRule {
  /** Human label shown in messages and in the brief. */
  label: string;
  re: RegExp;
}

const rule = (label: string, re: RegExp): WordRule => ({ label, re });

// ---------------------------------------------------------------- tier words (3.4)

const GAP_WORDS = [
  rule('gap', /\bgaps?\b/i),
  rule('split', /\bsplit(?:s|ting)?\b/i),
  rule('divide', /\bdivid(?:e|es|ed|ing)\b/i),
  rule('disagree', /\bdisagree\w*/i),
];
const WIDE_WORDS = [
  rule('wide', /\bwide(?:r|st)?\b/i),
  rule('large', /\blarg(?:e|er|est)\b/i),
  rule('big', /\bbig(?:ger|gest)?\b/i),
  rule('sharp', /\bsharp(?:ly|er|est)?\b/i),
  rule('split', /\bsplit(?:s|ting)?\b/i),
];
const EXTREME_WORDS = [
  rule('huge', /\bhuge(?:ly)?\b/i),
  rule('massive', /\bmassive(?:ly)?\b/i),
  rule('enormous', /\benormous(?:ly)?\b/i),
  rule('chasm', /\bchasms?\b/i),
];
const VERY_WIDE_WORDS = [rule('very wide', /\bvery wide\b/i), rule('widest', /\bwidest\b/i)];

const SLIGHT_ONLY_NEVER = [
  rule('clear gap', /\bclear(?:er|est)? gaps?\b/i),
  rule('noticeably', /\bnoticeabl[ey]\b/i),
  rule('disagree', /\bdisagree\w*/i),
];
/** Intensity words that claim a real difference; never on an agree-tier film. */
const INTENSITY_WORDS = [
  rule('slightly higher/lower', /\bslightly (?:higher|lower|ahead|behind|above|below|warmer|cooler|more|less|kinder|harsher|stronger|weaker)\b/i),
  rule('far higher/lower/more', /\bfar (?:higher|lower|ahead|behind|above|below|warmer|cooler|more|less|kinder|harsher|stronger|weaker)\b/i),
  rule('much higher/lower', /\bmuch (?:higher|lower|warmer|cooler|more|less|kinder|harsher|stronger|weaker)\b/i),
  rule('well above/below', /\bwell (?:above|below|ahead|behind)\b/i),
  rule('considerably/significantly/markedly/substantially', /\b(?:considerabl[ey]|significant(?:ly)?|marked(?:ly)?|substantial(?:ly)?)\b/i),
];

/**
 * Words that must NOT appear for each tier. Cumulative: a tier never borrows the vocabulary of any
 * higher tier, and "huge/massive/enormous/chasm" belong to the very-wide tier only.
 */
export const TIER_NEVER: Record<Tier, WordRule[]> = {
  agree: [...GAP_WORDS, ...WIDE_WORDS, ...EXTREME_WORDS, ...VERY_WIDE_WORDS, ...SLIGHT_ONLY_NEVER, ...INTENSITY_WORDS],
  slight: [...WIDE_WORDS, ...EXTREME_WORDS, ...VERY_WIDE_WORDS, ...SLIGHT_ONLY_NEVER],
  clear: [...WIDE_WORDS, ...EXTREME_WORDS, ...VERY_WIDE_WORDS],
  wide: [...EXTREME_WORDS, ...VERY_WIDE_WORDS],
  'very-wide': [],
};

/**
 * Fixed phrases where a tier word is not about the score difference ("a wide release",
 * "the big screen", "a generation gap"). They are blanked before tier words are matched.
 */
export const TIER_PHRASE_EXEMPTIONS: RegExp[] = [
  /\bwide(?:r)?[- ]releases?\b/gi,
  /\bbig[- ]screens?\b/gi,
  /\bgenerations?[- ]gaps?\b/gi,
  /\bage[- ]gaps?\b/gi,
  // a computed rank, not a size word: "the {{gapRank}} largest difference in the set"
  /\{\{\s*gapRank\s*\}\}\s+(?:largest|biggest)\b/gi,
];

/** Text with the exempt fixed phrases blanked out, for tier matching only. */
export const withoutTierExemptions = (text: string): string =>
  TIER_PHRASE_EXEMPTIONS.reduce((t, re) => t.replace(re, ' '), text);

/** Wording the writer should use per tier (spec 3.4). */
export const TIER_USE: Record<Tier, string[]> = {
  agree: ['closely agree', 'within a few points'],
  slight: ['slightly higher', 'a small gap', 'mostly agree'],
  clear: ['a clear gap', 'noticeably higher', 'disagree'],
  wide: ['a wide gap', 'a large gap', 'sharply'],
  'very-wide': ['a very wide gap', 'one of the widest in this set (only if gap rank is 10 or better)'],
};

export function tierNeverRules(tier: Tier, gapRank: number): WordRule[] {
  // "widest" is allowed in the very-wide tier only for gapRank <= 10
  if (tier === 'very-wide' && gapRank > 10) return [rule('widest (gap rank is not 10 or better)', /\bwidest\b/i)];
  return TIER_NEVER[tier];
}

// ---------------------------------------------------------------- always forbidden (3.4, 7.3)

export const ALWAYS_FORBIDDEN: WordRule[] = [
  rule('polarising/polarizing', /\bpolari[sz]\w*/i),
  rule('overrated', /\boverrated\b/i),
  rule('underrated', /\bunderrated\b/i),
  rule('masterpiece', /\bmasterpieces?\b/i),
  rule('must-watch', /\bmust[- ]watch\b/i),
  rule('flop', /\bflops?\b/i),
  rule('critics hated', /\bcritics hated\b/i),
  rule('audiences hated', /\baudiences? hated\b/i),
  rule('best', /\bbest\b/i),
  rule('worst', /\bworst\b/i),
];

/** Claims the spec bans outright (6.1 article-copy, 7.3). */
export const FORBIDDEN_CLAIMS: WordRule[] = [
  rule('Netflix Original', /\bnetflix[\s-]+originals?\b/i),
  rule('available on Netflix', /\bavailable (?:on|to stream on) netflix\b/i),
  rule('streaming now', /\bstreaming now\b|\bnow streaming\b|\bon netflix now\b/i),
  rule('availability: stream/watch on Netflix', /\bstream(?:s|ing|ed)? (?:it )?on netflix\b|\bwatch(?:es|ing|ed)? (?:it )?on netflix\b|\bon netflix (?:in|today|now)\b/i),
  rule('official', /\bofficial(?:ly)?\b/i),
  rule('partnered', /\bpartner(?:ed|ship|ing)\b/i),
  rule('box office / budget', /\bbox office\b|\bbudgets?\b|\bgross(?:ed|es|ing)?\b|\bticket sales\b|\bcost\b[^.!?]{0,40}\bto (?:make|produce|shoot)\b/i),
  rule('personal viewing claim', /\b(?:I|[Ww]e) (?:watched|saw|loved|liked|enjoyed|hated)\b/),
  // Personal taste: first person singular anywhere, "we" + an opinion verb. Case-sensitive "I" so
  // the Roman numeral in a masked title or "i.e." does not count; the film title is masked first.
  rule('personal taste (I)', /(?<![\w'])I(?![\w'])|\bI'(?:m|ve|d|ll)\b/),
  rule('personal taste (my)', /\bmy\b/i),
  rule('personal taste (we think/feel/found ...)', /\bwe (?:think|thought|feel|felt|found|find|believe|believed|recommend|recommended|love|loved|like|prefer|preferred)\b/i),
  // Quotes from critics or users are banned; any double quotation mark in prose is treated as one.
  rule('quotation mark (no critic or audience quotes)', /["“”„‟«»]/),
];

/** Phrases banned by the writer brief (7.3). Matching is case-insensitive; "'" and the curly apostrophe are equal. */
export const BANNED_PHRASES: WordRule[] = [
  rule('delve', /\bdelv(?:e|es|ed|ing)\b/i),
  rule("it's important to note", /\bit(?:'s| is) important to note\b/i),
  rule("in today's", /\bin today's\b/i),
  rule("whether you're", /\bwhether (?:you're|you are)\b/i),
  rule('a testament to', /\ba testament to\b/i),
  rule('tapestry', /\btapestr(?:y|ies)\b/i),
  rule('rollercoaster', /\broller[- ]?coasters?\b/i),
  rule('buckle up', /\bbuckle up\b/i),
  rule('at the end of the day', /\bat the end of the day\b/i),
  rule('in conclusion', /\bin conclusion\b/i),
  rule('edge-of-your-seat', /\bedge[- ]of[- ]your[- ]seat\b/i),
  rule('cinematic journey', /\bcinematic journeys?\b/i),
  rule('stands as', /\bstands as\b/i),
  rule('boasts', /\bboast(?:s|ed|ing)?\b/i),
  rule('gripping', /\bgripping\b/i),
  rule('captivating', /\bcaptivating\b/i),
  rule('must-see', /\bmust[- ]see\b/i),
  rule('elevate', /\belevat(?:e|es|ed|ing)\b/i),
  rule('showcase', /\bshowcas(?:e|es|ed|ing)\b/i),
  rule('navigate', /\bnavigat(?:e|es|ed|ing)\b/i),
  rule('landscape', /\blandscapes?\b/i),
  rule('look no further', /\blook no further\b/i),
  rule('without further ado', /\bwithout further ado\b/i),
  rule('a feast for', /\ba feast for\b/i),
];

// ---------------------------------------------------------------- text preparation

/** Text as the wording rules see it: tokens, link targets and curly quotes neutralised. */
export function wordingText(text: string): string {
  return stripTokens(text, ' T ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[\u2018\u2019]/g, "'");
}

/** Labels of the rules that match `text`. */
export const matchRules = (text: string, rules: WordRule[]): string[] => {
  const t = wordingText(text);
  return [...new Set(rules.filter((r) => r.re.test(t)).map((r) => r.label))];
};

// ---------------------------------------------------------------- direction (3.1 summary, 3.3)

export type Direction = 'critics-higher' | 'audience-higher';

const CRITIC_SRC = String.raw`critics?|reviewers?|rotten tomatoes|rt|tomatometer|metascore|the critic(?: side| score| number| figure)?`;
const AUDIENCE_SRC = String.raw`audiences?|viewers?|fans?|users?|voters?|imdb|crowds?|the audience(?: side| score| number| figure)?`;
const CRITIC = new RegExp(String.raw`\b(?:${CRITIC_SRC})\b`, 'gi');
const AUDIENCE = new RegExp(String.raw`\b(?:${AUDIENCE_SRC})\b`, 'gi');
const UP_SRC = String.raw`higher|ahead|above|warmer|stronger|kinder|more (?:positive|favorabl[ey]|favourabl[ey]|generous|enthusiastic)|more than|outscor(?:e|es|ed|ing)|outrat(?:e|es|ed|ing)|beat(?:s|ing)?`;
const DOWN_SRC = String.raw`lower|below|behind|cooler|weaker|harsher|less (?:positive|favorabl[ey]|favourabl[ey]|generous|enthusiastic)|less than|trail(?:s|ed|ing)?`;
const UP = new RegExp(String.raw`\b(?:${UP_SRC})\b`, 'gi');
const DOWN = new RegExp(String.raw`\b(?:${DOWN_SRC})\b`, 'gi');

/** Words that express agreement (summary and why-split of the agreed archetypes). */
export const AGREE_WORDS = /\b(?:agree(?:s|d|ment)?|align(?:s|ed)?|lines? up|in step|within a few points|consistent|similar(?:ly)?|closely)\b/i;

function positions(re: RegExp, s: string): { at: number; end: number }[] {
  return [...s.matchAll(new RegExp(re.source, 'gi'))].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** Sentences as the direction rules see them: tokens neutralised, the film's names masked. */
function directionSentences(text: string, names: readonly string[]): string[] {
  return maskedSentences(wordingText(text), names);
}

/**
 * Directions implied by comparative sentences ("critics rate it higher than audiences").
 * Lenient: per sentence, the subject nearest before a comparative (else after) is who is
 * higher or lower. Used to find the required direction statement.
 */
export function detectDirections(text: string, names: readonly string[] = []): Direction[] {
  const found = new Set<Direction>();
  for (const sentence of directionSentences(text, names)) {
    const subjects = [
      ...positions(CRITIC, sentence).map((p) => ({ p: p.at, who: 'critic' as const })),
      ...positions(AUDIENCE, sentence).map((p) => ({ p: p.at, who: 'audience' as const })),
    ];
    for (const [re, up] of [
      [UP, true],
      [DOWN, false],
    ] as const) {
      for (const { at } of positions(re, sentence)) {
        const before = subjects.filter((s) => s.p < at).sort((a, b) => b.p - a.p)[0];
        const after = subjects.filter((s) => s.p > at).sort((a, b) => a.p - b.p)[0];
        const subject = before ?? after;
        if (!subject) continue;
        const criticsHigher = (subject.who === 'critic') === up;
        found.add(criticsHigher ? 'critics-higher' : 'audience-higher');
      }
    }
  }
  return [...found];
}

// "X <comparative> than Y" / "X outscores Y": both sides named. Strict, so a hypothetical
// clause ("a film can rate warmly with critics and still land lower among viewers") is not
// read as a claim.
const THAN_TAIL = new RegExp(
  String.raw`^\s*(?:than\s+)?(?:(?:the|its|their|what|those|most|many|all)\s+)*(?:(${CRITIC_SRC})|(${AUDIENCE_SRC}))\b`,
  'i',
);

/** Explicit comparisons that name both sides: the claims a contradiction check can trust. */
export function detectClaims(text: string, names: readonly string[] = []): Direction[] {
  const found = new Set<Direction>();
  for (const sentence of directionSentences(text, names)) {
    const subjects = [
      ...positions(CRITIC, sentence).map((p) => ({ p: p.end, who: 'critic' as const })),
      ...positions(AUDIENCE, sentence).map((p) => ({ p: p.end, who: 'audience' as const })),
    ];
    for (const [re, up] of [
      [UP, true],
      [DOWN, false],
    ] as const) {
      for (const m of positions(re, sentence)) {
        const word = sentence.slice(m.at, m.end).toLowerCase();
        const verb = /^(?:outscor|outrat|beat|trail)/.test(word);
        const rest = sentence.slice(m.end);
        // comparatives need "than" (or "more than"/"less than" already contain it); verbs take an object
        if (!verb && !/than$/.test(word) && !/^\s*than\b/i.test(rest)) continue;
        const tail = THAN_TAIL.exec(rest);
        if (!tail) continue;
        const other = tail[1] ? 'critic' : 'audience';
        // nearest subject before the comparative, inside the same clause
        const clauseStart = Math.max(sentence.lastIndexOf(',', m.at), sentence.lastIndexOf(';', m.at), -1);
        const before = subjects.filter((s) => s.p <= m.at && s.p > clauseStart).sort((a, b) => b.p - a.p)[0];
        if (!before || before.who === other) continue;
        const criticsHigher = (before.who === 'critic') === up;
        found.add(criticsHigher ? 'critics-higher' : 'audience-higher');
      }
    }
  }
  return [...found];
}

export interface DirectionContext {
  archetype: Archetype;
  /** Signed gap (rt - imdbX10); positive means critics higher. */
  gap: number;
  tier: Tier;
  /** The film's display title and shortTitle; masked before detection. */
  names?: readonly string[];
}

/**
 * The direction problems of a summary or why-split, or [] when it is fine:
 * - the archetype's direction (or agreement) must be stated;
 * - an explicit comparison must never point the wrong way (any archetype);
 * - an agree-tier film (gap under 5) must not claim either side is higher.
 */
export function directionProblems(text: string, ctx: DirectionContext): string[] {
  const names = ctx.names ?? [];
  const out: string[] = [];
  if (!matchesArchetype(text, ctx.archetype, names)) out.push(`must state the direction: ${DIRECTION_HELP[ctx.archetype]}`);
  const truth: Direction | null = ctx.gap > 0 ? 'critics-higher' : ctx.gap < 0 ? 'audience-higher' : null;
  const claims = detectClaims(text, names);
  if (ctx.tier === 'agree' && claims.length) {
    out.push(`claims "${claims[0]}" but the scores agree (gap under 5): do not say either side is higher`);
  } else {
    const wrong = claims.filter((c) => c !== truth);
    if (wrong.length) out.push(`contradicts the data: a sentence says "${wrong[0]}" but the gap is ${ctx.gap > 0 ? '+' : ''}${ctx.gap}`);
  }
  return out;
}

/** True when the text states the direction (or agreement) the archetype requires. */
export function matchesArchetype(text: string, archetype: Archetype, names: readonly string[] = []): boolean {
  if (archetype.startsWith('agreed')) return AGREE_WORDS.test(maskTitles(wordingText(text), names));
  return detectDirections(text, names).includes(archetype as Direction);
}

export const DIRECTION_HELP: Record<Archetype, string> = {
  'critics-higher': 'a sentence saying critics (or Rotten Tomatoes) rate it higher than audiences (or IMDb)',
  'audience-higher': 'a sentence saying audiences (or IMDb) rate it higher than critics (or Rotten Tomatoes)',
  'agreed-high': 'an agreement word such as "closely agree", "mostly agree", "align", "within a few points"',
  'agreed-low': 'an agreement word such as "closely agree", "mostly agree", "align", "within a few points"',
  'agreed-mixed': 'an agreement word such as "closely agree", "mostly agree", "align", "within a few points"',
};
