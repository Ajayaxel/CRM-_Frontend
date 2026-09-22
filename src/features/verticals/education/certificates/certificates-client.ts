export type CertType = 'COMPLETION' | 'MERIT' | 'PARTICIPATION' | 'INTERNSHIP';

export interface Certificate {
  id: string;
  type: CertType;
  title: string;
  serial: string;
  code: string;
  grade?: string | null;
  issuedOn: string;
  revoked: boolean;
  student?: { firstName: string; lastName?: string | null; admissionNo: string };
  course?: { name: string; code: string } | null;
}

export const CERT_TYPE_LABEL: Record<CertType, string> = {
  COMPLETION: 'Completion',
  MERIT: 'Merit',
  PARTICIPATION: 'Participation',
  INTERNSHIP: 'Internship',
};
