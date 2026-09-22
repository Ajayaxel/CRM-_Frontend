'use client';

/**
 * Workspace-level state: which record is peeking, what is being created, and
 * whether the command menu is open.
 *
 * The record pointer is a history stack rather than a single value. Following
 * a relationship — task → its blocker → that blocker's project — has to be
 * reversible, otherwise "seamless navigation" just means "easy to get lost".
 */

import { createContext, useContext } from 'react';

export type RecordKind = 'TASK' | 'ISSUE' | 'FEATURE' | 'MILESTONE' | 'DEVELOPER' | 'PROJECT';
export type CreateKind = 'VERTICAL' | 'PROJECT' | 'TASK' | 'ISSUE' | 'FEATURE' | 'MILESTONE' | 'DOCUMENT';

export interface RecordRef {
  kind: RecordKind;
  id: string;
}

export interface CreateDefaults {
  verticalId?: string;
  projectId?: string;
  milestoneId?: string;
  parentId?: string;
  status?: string;
  assigneeId?: string;
}

export interface WorkspaceApi {
  /** Peek a record, pushing it onto the navigation stack. */
  openRecord: (kind: RecordKind, id: string) => void;
  closeRecord: () => void;
  record: RecordRef | null;

  /** Relationship navigation within the panel. */
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;

  create: (kind: CreateKind, defaults?: CreateDefaults) => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  /** Rows-per-screen preference, shared by every table. */
  density: 'comfortable' | 'compact';
  setDensity: (d: 'comfortable' | 'compact') => void;
}

export const WorkspaceCtx = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used inside the Consultant workspace shell');
  return ctx;
}
