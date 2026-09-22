/**
 * Re-exported vocabulary for the create forms.
 *
 * `ui/cells` owns the canonical lists; this file exists so a form imports one
 * flat module rather than reaching into the cell layer for constants.
 */

export {
  TASK_STATUSES, PRIORITIES, PROJECT_STATUSES, VERTICAL_STATUSES, HEALTHS,
  ISSUE_STATUSES, SEVERITIES, ISSUE_TYPES, FEATURE_STATUSES, MILESTONE_STATUSES,
  TEAM_ROLES,
} from '../ui/cells';

import type { DocType } from '../api';

export const DOC_TYPES: DocType[] = [
  'PROJECT', 'TECHNICAL', 'REQUIREMENTS', 'MEETING_NOTES', 'SOP', 'API',
  'ARCHITECTURE', 'DEPLOYMENT', 'CLIENT_REQUIREMENTS', 'DECISION_RECORD', 'TROUBLESHOOTING',
];
