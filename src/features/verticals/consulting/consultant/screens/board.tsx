'use client';

/**
 * Kanban (spec §24).
 *
 * Native HTML5 drag and drop — the board only needs "pick a card up, drop it
 * between two others", and a 40kB DnD dependency is not worth that. Dropping
 * computes a fractional index from the neighbours, so a move writes one row.
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/foundation/auth';
import { apiErrorMessage } from '@/lib/api';
import { useBoard, useMoveTask, type Task, type TaskStatus } from '../api';
import { Avatar, Empty, ProgressBar, Skeleton, TONE_VAR, humanize } from '../ui/primitives';
import { DueCell, PriorityMark, taskTone } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';

const HINT: Partial<Record<TaskStatus, string>> = {
  BACKLOG: 'Not committed',
  TODO: 'Ready to start',
  IN_PROGRESS: 'Being worked on',
  IN_REVIEW: 'Waiting on a reviewer',
  TESTING: 'With QA',
  BLOCKED: 'Waiting on something',
  DONE: 'Finished',
};

export function TaskBoard({ verticalId, projectId }: { verticalId?: string; projectId?: string }) {
  const { hasPermission } = useAuth();
  const ws = useWorkspace();
  const { data: columns, isLoading } = useBoard({ verticalId, projectId });
  const move = useMoveTask();

  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<{ status: TaskStatus; index: number } | null>(null);

  const canUpdate = hasPermission('pm.task.update');
  const canCreate = hasPermission('pm.task.create');

  if (!verticalId && !projectId) {
    return <Empty title="Choose a product line" body="A board shows one product line or one project at a time — nineteen product lines of cards side by side is a wall, not a board." />;
  }
  if (isLoading || !columns) {
    return <div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2, 3].map((i) => <div key={i} style={{ flex: 1 }}><Skeleton rows={3} height={64} /></div>)}</div>;
  }

  const drop = (status: TaskStatus, index: number) => {
    if (!dragging) return;
    const list = (columns.find((c) => c.status === status)?.tasks ?? []).filter((t) => t.id !== dragging);
    move.mutate(
      { id: dragging, status, afterTaskId: index > 0 ? list[index - 1]?.id : undefined, beforeTaskId: list[index]?.id },
      { onError: (e) => toast.error(apiErrorMessage(e)) },
    );
    setDragging(null);
    setTarget(null);
  };

  return (
    <div className="cw-board">
      {columns.map((col) => (
        <div
          key={col.status}
          className="cw-col"
          data-over={target?.status === col.status}
          onDragOver={(e) => { if (dragging) { e.preventDefault(); setTarget({ status: col.status, index: col.tasks.length }); } }}
          onDrop={(e) => { e.preventDefault(); drop(col.status, target?.status === col.status ? target.index : col.tasks.length); }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px 9px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE_VAR[taskTone(col.status)], flex: 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 650 }}>{humanize(col.status)}</span>
            <span className="cw-tab-count">{col.count}</span>
            {canCreate && (
              <button
                type="button"
                className="cw-icon-btn"
                style={{ marginLeft: 'auto', width: 22, height: 22 }}
                aria-label={`Add task to ${humanize(col.status)}`}
                onClick={() => ws.create('TASK', { verticalId, projectId, status: col.status })}
              ><Plus size={13} /></button>
            )}
          </div>

          {col.tasks.length === 0 && HINT[col.status] && (
            <div className="cw-meta" style={{ padding: '8px 5px 12px' }}>{HINT[col.status]}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {col.tasks.map((task, i) => (
              <div
                key={task.id}
                onDragOver={(e) => { if (dragging) { e.preventDefault(); e.stopPropagation(); setTarget({ status: col.status, index: i }); } }}
              >
                {target?.status === col.status && target.index === i && dragging !== task.id && (
                  <div style={{ height: 2, borderRadius: 2, marginBottom: 5, background: TONE_VAR[taskTone(col.status)] }} />
                )}
                <BoardCard
                  task={task}
                  draggable={canUpdate}
                  dragging={dragging === task.id}
                  onDragStart={() => setDragging(task.id)}
                  onDragEnd={() => { setDragging(null); setTarget(null); }}
                  onOpen={() => ws.openRecord('TASK', task.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BoardCard({
  task, draggable, dragging, onDragStart, onDragEnd, onOpen,
}: {
  task: Task;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const subtasks = task._count?.subtasks ?? 0;
  return (
    <div
      className="cw-card"
      draggable={draggable}
      data-dragging={dragging}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      role="button"
      tabIndex={0}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <PriorityMark value={task.priority} showLabel={false} />
        <span className="cw-mono">{task.ref}</span>
        <span style={{ marginLeft: 'auto', flex: 'none' }}><DueCell date={task.dueDate} status={task.status} /></span>
      </div>

      <div style={{ fontWeight: 520, lineHeight: 1.42, marginBottom: subtasks > 0 || task.blockedReason ? 8 : 9 }}>
        {task.title}
      </div>

      {task.blockedReason && task.status === 'BLOCKED' && (
        <div style={{
          fontSize: 11.5, color: 'var(--cw-red)', background: 'var(--cw-red-bg)',
          padding: '4px 6px', borderRadius: 'var(--cw-r-sm)', marginBottom: 8,
        }}>{task.blockedReason}</div>
      )}

      {subtasks > 0 && (
        <div style={{ marginBottom: 8 }}><ProgressBar value={task.progress} tone={taskTone(task.status)} /></div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {task.project && <span className="cw-meta cw-truncate" style={{ minWidth: 0 }}>{task.project.name}</span>}
        <span style={{ marginLeft: 'auto', flex: 'none' }}>
          <Avatar name={task.assignee?.name} size={19} />
        </span>
      </div>
    </div>
  );
}
