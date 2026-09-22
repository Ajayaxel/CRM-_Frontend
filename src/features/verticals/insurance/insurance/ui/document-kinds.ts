/**
 * MIRRORED from apps/api/src/documents/document-kinds.ts. The API validates the
 * key it is sent; this file decides which slots a broker sees. If they drift, a
 * slot renders an Upload button whose upload the API rejects — so
 * scripts/client-documents-offline.ts pins the two files equal.
 *
 * The documents a broker asks a client for, by name.
 *
 * "Files on this client" was a flat list: you could see that two files existed
 * and not that the PAN card was missing. Underwriting and claims both stall on
 * exactly that — a missing document nobody noticed was missing — so what the
 * office needs is not a folder, it is a CHECKLIST, and a checklist needs the
 * file to say which slot it fills.
 *
 * `folder` cannot say it. Folder answers "which module owns this file"; this
 * answers "which named thing is it". A PAN card and a policy schedule live in
 * the same folder and are not remotely the same request.
 *
 * The list is deliberately short. Every slot here is a document a broker will
 * actually chase, and an empty slot is a visible gap — so a slot nobody chases
 * would train people to ignore the gaps.
 */

export type ClientDocumentKind = {
  key: string;
  label: string;
  /** Why it is asked for — an empty slot should explain itself. */
  blurb: string;
  /** Only shown when the client holds motor cover. */
  motorOnly?: boolean;
  /** A client can hold several: two vehicles, three policies. */
  multiple?: boolean;
};

export const CLIENT_DOCUMENT_KINDS: readonly ClientDocumentKind[] = [
  { key: 'AADHAAR', label: 'Aadhaar card', blurb: 'Identity and address proof' },
  { key: 'PAN', label: 'PAN card', blurb: 'Asked for by the insurer on higher premiums' },
  { key: 'PHOTO', label: 'Photograph', blurb: 'Passport-size photo' },
  { key: 'CANCELLED_CHEQUE', label: 'Cancelled cheque', blurb: 'Where a claim settlement gets paid' },
  { key: 'POLICY_SCHEDULE', label: 'Policy document', blurb: 'The schedule issued by the insurer', multiple: true },
  { key: 'RC', label: 'RC book', blurb: 'Registration certificate of the insured vehicle', motorOnly: true, multiple: true },
  {
    key: 'DRIVING_LICENCE', label: 'Driving licence',
    blurb: 'Needed to settle an own-damage claim', motorOnly: true, multiple: true,
  },
] as const;

export const CLIENT_DOCUMENT_KIND_KEYS = CLIENT_DOCUMENT_KINDS.map((k) => k.key);

/**
 * MIRRORED from apps/api/src/documents/document-kinds.ts. The API validates the
 * key it is sent; this file decides which slots a broker sees. If they drift, a
 * slot renders an Upload button whose upload the API rejects — so
 * scripts/client-documents-offline.ts pins the two files equal.
 *
 * Every category that means "there is a vehicle on this book".
 *
 * MOTOR is the retired generic bucket and it is in this list on purpose: 20
 * policies on the live book still sit in it, and leaving it out would hide the
 * RC slot from precisely the oldest customers — the ones whose paperwork is
 * most likely to be incomplete. The three specific classes are what new
 * business is written as.
 */
export const MOTOR_CATEGORIES = ['MOTOR', 'PRIVATE_CAR', 'TWO_WHEELER', 'COMMERCIAL_VEHICLE'];

export function isMotorCategory(category?: string | null): boolean {
  return MOTOR_CATEGORIES.includes((category ?? '').toUpperCase());
}

/**
 * MIRRORED from apps/api/src/documents/document-kinds.ts. The API validates the
 * key it is sent; this file decides which slots a broker sees. If they drift, a
 * slot renders an Upload button whose upload the API rejects — so
 * scripts/client-documents-offline.ts pins the two files equal.
 * The slots to show for a client, given the categories they actually hold. */
export function kindsForClient(categories: (string | null | undefined)[]): ClientDocumentKind[] {
  const motor = categories.some(isMotorCategory);
  return CLIENT_DOCUMENT_KINDS.filter((k) => !k.motorOnly || motor);
}
