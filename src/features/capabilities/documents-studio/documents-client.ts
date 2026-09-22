export type DocSubject = 'INVOICE' | 'ENGAGEMENT' | 'EMPLOYEE';

export interface DocKind {
  key: string;
  label: string;
  blurb: string;
  subject: DocSubject;
  tokens: string[];
}

export interface DocTemplate {
  id: string | null;
  kind: string;
  name: string;
  html: string;
  usedTokens: string[];
  version: number;
  /** True while the tenant has never saved their own — see the service. */
  isPackagedDefault: boolean;
}

export interface GeneratedDoc {
  kind: string;
  subject: DocSubject;
  subjectId: string;
  templateVersion: number;
  html: string;
}

export const SUBJECT_LABEL: Record<DocSubject, string> = {
  INVOICE: 'Money',
  ENGAGEMENT: 'Client work',
  EMPLOYEE: 'People',
};

export const SUBJECT_BLURB: Record<DocSubject, string> = {
  INVOICE: 'Rendered from an invoice or quotation record',
  ENGAGEMENT: 'Rendered from an engagement, with prose you supply',
  EMPLOYEE: 'Rendered from an employee record',
};

/**
 * A repeating block, declared in the contract as `name[]`.
 *
 * Shown separately from scalars because they behave differently in a template:
 * a scalar is one substitution, a block is a section that repeats per row.
 */
export function splitTokens(tokens: string[]) {
  return {
    scalars: tokens.filter((t) => !t.endsWith('[]')).sort(),
    blocks: tokens.filter((t) => t.endsWith('[]')).map((t) => t.slice(0, -2)).sort(),
  };
}
