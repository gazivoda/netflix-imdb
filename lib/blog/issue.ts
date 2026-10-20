// The finding shape shared by every blog check (schema, lint, similarity).

export interface Issue {
  /** Short machine-readable rule id, for example "tier-word" or "prose-length". */
  rule: string;
  message: string;
  /** Where in the article: "summary", "sections[why-split].paragraphs[1]", ... */
  where?: string;
}

export const issue = (rule: string, message: string, where?: string): Issue => ({ rule, message, ...(where ? { where } : {}) });

export const formatIssue = (i: Issue): string => `[${i.rule}]${i.where ? ` ${i.where}:` : ''} ${i.message}`;
