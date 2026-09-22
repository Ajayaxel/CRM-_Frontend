export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  baseSalary: number;
  hireDate: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'EXITED';
  userId?: string | null;
}

export interface EmployeePage { data: Employee[]; total: number; take: number; skip: number }

export const STATUS_META: Record<Employee['status'], { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success)' },
  ON_LEAVE: { label: 'On leave', bg: 'var(--surface-2)', fg: 'var(--gold,#E6A23C)' },
  EXITED: { label: 'Exited', bg: 'var(--surface-2)', fg: 'var(--ink-3)' },
};

export const employeeName = (e: Employee) => [e.firstName, e.lastName].filter(Boolean).join(' ').trim();

/** The three documents a person can be the subject of. */
export const EMPLOYEE_DOC_KINDS = [
  { key: 'OFFER_LETTER', label: 'Offer letter' },
  { key: 'EXPERIENCE_CERTIFICATE', label: 'Experience certificate' },
  { key: 'SALARY_REQUEST', label: 'Salary request' },
] as const;
