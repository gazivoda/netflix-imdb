// The finding shape shared by every blog check (schema, lint, similarity).

export interface Issue {
  /** Short machine-readable rule id, for example "tier-word" or "prose-length". */
  rule: string;
  message: string;
  /** Where in the article: "summary", "sections[why-split].paragraphs[1]", ... */
  where?: string;
  /** "warn" findings are printed but never fail a check; absent means an error. */
  severity?: 'warn';
}

export const issue = (rule: string, message: string, where?: string): Issue => ({ rule, message, ...(where ? { where } : {}) });

export const warning = (rule: string, message: string, where?: string): Issue => ({ ...issue(rule, message, where), severity: 'warn' });

export const isWarning = (i: Issue): boolean => i.severity === 'warn';

export const formatIssue = (i: Issue): string => `${isWarning(i) ? 'WARN ' : ''}[${i.rule}]${i.where ? ` ${i.where}:` : ''} ${i.message}`;
