'use client';

/** Portfolio activity and the audit trail (spec §21, §22). */

import React, { useState } from 'react';
import { useVerticals } from '../api';
import { OptionList, Popover, Tabs } from '../ui/primitives';
import { ActivityRail, AuditTable } from '../records/collab';
import { Page } from './page';

const TABS = ['All', 'People', 'Automated', 'Audit trail'] as const;

export function ActivityScreen() {
  const { data: verticals = [] } = useVerticals();
  const [verticalId, setVerticalId] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('All');

  const current = verticals.find((v: any) => v.id === verticalId);

  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Activity' }]}
      title="Activity"
      description="Every change, assignment, comment and automated event."
      actions={
        <Popover
          align="end"
          width={260}
          trigger={({ ref, onClick }) => (
            <button type="button" ref={ref as any} className="cw-btn" onClick={onClick}>
              {current ? `${(current as any).icon ?? ''} ${current.name}` : 'All product lines'}
            </button>
          )}
        >
          {({ close }) => (
            <OptionList
              searchable
              value={verticalId ?? undefined}
              options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim() }))}
              onPick={(v) => { setVerticalId(v); close(); }}
              footer={verticalId ? <button type="button" className="cw-opt" onClick={() => { setVerticalId(null); close(); }}>All product lines</button> : undefined}
            />
          )}
        </Popover>
      }
    >
      <div style={{ margin: '10px 0 16px' }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'Audit trail' ? (
        <>
          <div className="cw-meta" style={{ marginBottom: 10 }}>
            Field-level history. These rows are written alongside the organisation&apos;s audit log and cannot be edited.
          </div>
          <AuditTable verticalId={verticalId ?? undefined} />
        </>
      ) : (
        <div style={{ maxWidth: 760 }}>
          <ActivityRail
            verticalId={verticalId ?? undefined}
            limit={100}
            source={tab === 'People' ? 'MANUAL,SYSTEM' : tab === 'Automated' ? 'AUTOMATED' : undefined}
          />
        </div>
      )}
    </Page>
  );
}
