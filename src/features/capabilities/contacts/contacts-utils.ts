export type GuardianRelation = 'FATHER' | 'MOTHER' | 'GUARDIAN' | 'SIBLING' | 'OTHER';

export interface GuardianRow {
  id: string;
  name: string;
  relation: GuardianRelation;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  students: {
    isPrimary: boolean;
    isEmergencyContact: boolean;
    student: {
      id: string;
      firstName: string;
      lastName?: string | null;
      admissionNo: string;
      status: string;
    };
  }[];
}

export interface DuplicateContactGroup {
  field: 'email' | 'phone' | 'name';
  value: string;
  contacts: GuardianRow[];
}

export interface TagRow {
  id: string;
  name: string;
  color?: string | null;
}

export const RELATION_LABELS: Record<GuardianRelation, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
  SIBLING: 'Sibling',
  OTHER: 'Other Relation',
};

export const RELATION_OPTIONS = Object.entries(RELATION_LABELS).map(([value, label]) => ({ value, label }));
