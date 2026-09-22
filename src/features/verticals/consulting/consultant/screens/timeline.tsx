'use client';

/**
 * Timeline and calendar (spec §25).
 *
 * Both are hand-rolled: a Gantt row is a div with a left offset and a width, and
 * a month grid is a seven-column grid. A charting dependency would add weight
 * and a visual language that does not match this workspace.
 *
 * Dependency connectors are drawn as an SVG overlay measured from the real bar
 * positions after layout, rather than computed from dates — the bars are the
 * source of truth, so the lines cannot drift out of sync with them.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendar, useTimeline, useVerticals } from '../api';
import { Empty, ErrorState, Loading, OptionList, Popover, TONE_VAR, fmtDate, humanize } from '../ui/primitives';
import { StatusChip, milestoneTone, taskTone } from '../ui/cells';
import { useWorkspace } from '../ui/workspace-context';
import { Page } from './page';

function VerticalPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { data: verticals = [] } = useVerticals();
  const current = verticals.find((v: any) => v.id === value);
  return (
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
          value={value ?? undefined}
          options={verticals.map((v: any) => ({ value: v.id, label: `${v.icon ?? ''} ${v.name}`.trim() }))}
          onPick={(v) => { onChange(v); close(); }}
          footer={value ? <button type="button" className="cw-opt" onClick={() => { onChange(null); close(); }}>All product lines</button> : undefined}
        />
      )}
    </Popover>
  );
}

interface Link {
  id: string;
  d: string;
  arrow: string;
  blocked: boolean;
}

export function TimelineScreen({ verticalId: fixed, embedded }: { verticalId?: string; embedded?: boolean }) {
  const ws = useWorkspace();
  const [verticalId, setVerticalId] = useState<string | null>(fixed ?? null);
  const query = useTimeline(verticalId ?? undefined);
  const data = query.data;

  const wrapRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<Link[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const span = useMemo(() => {
    const dates: number[] = [];
    for (const p of data?.projects ?? []) {
      if (p.startDate) dates.push(new Date(p.startDate).getTime());
      if (p.targetDate) dates.push(new Date(p.targetDate).getTime());
      for (const t of p.tasks ?? []) {
        if (t.startDate) dates.push(new Date(t.startDate).getTime());
        if (t.dueDate) dates.push(new Date(t.dueDate).getTime());
      }
    }
    if (!dates.length) {
      const now = Date.now();
      return { from: now - 15 * 86400000, to: now + 75 * 86400000 };
    }
    const from = Math.min(...dates) - 3 * 86400000;
    const to = Math.max(...dates) + 3 * 86400000;
    return { from, to: to > from ? to : from + 30 * 86400000 };
  }, [data]);

  const pos = useCallback((d?: string | null) => {
    if (!d) return null;
    return ((new Date(d).getTime() - span.from) / (span.to - span.from)) * 100;
  }, [span]);

  const registerBar = useCallback((id: string, el: HTMLElement | null) => {
    if (el) barRefs.current.set(id, el);
    else barRefs.current.delete(id);
  }, []);

  /**
   * Measure the rendered bars and build one elbow path per dependency.
   *
   * Runs after layout and again on resize, because the bar geometry depends on
   * the container width — recomputing from dates alone would drift the moment a
   * column wraps or the panel opens.
   */
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !data?.dependencies?.length) { setLinks([]); return; }
    const base = wrap.getBoundingClientRect();
    setSize({ w: base.width, h: base.height });

    const out: Link[] = [];
    for (const dep of data.dependencies) {
      const a = barRefs.current.get(dep.fromId);
      const b = barRefs.current.get(dep.toId);
      if (!a || !b) continue;

      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - base.left;
      const y1 = ra.top - base.top + ra.height / 2;
      const x2 = rb.left - base.left;
      const y2 = rb.top - base.top + rb.height / 2;

      // A successor that starts before its predecessor finishes is a real
      // scheduling conflict, so the line says so.
      const blocked = x2 < x1;

      // Elbow: out to the right of the predecessor, down/up, then into the
      // successor's left edge. When the successor sits to the left we route
      // around underneath instead of drawing a line straight through the bars.
      const gap = 9;
      const d = blocked
        ? `M ${x1} ${y1} H ${x1 + gap} V ${(y1 + y2) / 2 + 11} H ${x2 - gap} V ${y2} H ${x2 - 3}`
        : `M ${x1} ${y1} H ${Math.max(x1 + gap, x2 - gap)} V ${y2} H ${x2 - 3}`;

      out.push({
        id: `${dep.fromId}->${dep.toId}`,
        d,
        arrow: `${x2 - 4},${y2} ${x2 - 8},${y2 - 3.2} ${x2 - 8},${y2 + 3.2}`,
        blocked,
      });
    }
    setLinks(out);
  }, [data]);

  useLayoutEffect(() => { measure(); }, [measure, verticalId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [measure]);

  const todayPos = pos(new Date().toISOString());

  const body = query.isLoading ? <Loading kind="list" rows={5} />
    : query.isError ? <ErrorState error={query.error} what="the timeline" onRetry={query.refetch} />
      : !data?.projects.length ? (
        <Empty icon={CalendarDays} title="Nothing to plot" body="Give projects and tasks start and target dates and they will appear here." />
      ) : (
        <div style={{ paddingTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--cw-line)' }}>
            <span className="cw-meta">{fmtDate(new Date(span.from))}</span>
            {links.length > 0 && (
              <span className="cw-meta">
                {links.length} dependenc{links.length === 1 ? 'y' : 'ies'}
                {links.some((l) => l.blocked) && <span style={{ color: 'var(--cw-red)' }}> · {links.filter((l) => l.blocked).length} out of sequence</span>}
              </span>
            )}
            <span className="cw-meta">{fmtDate(new Date(span.to))}</span>
          </div>

          <div ref={wrapRef} className="cw-gantt" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 14 }}>
            {/* Connectors sit above the bars but never take pointer events. */}
            <svg className="cw-gantt-links" width={size.w} height={size.h} aria-hidden="true">
              {links.map((l) => (
                <g key={l.id}>
                  <path className="cw-gantt-link" data-blocked={l.blocked} d={l.d} />
                  <polygon className="cw-gantt-arrow" data-blocked={l.blocked} points={l.arrow} />
                </g>
              ))}
            </svg>

            {todayPos != null && todayPos >= 0 && todayPos <= 100 && (
              <div style={{
                position: 'absolute', left: `${todayPos}%`, top: 0, bottom: 0, width: 1,
                background: 'var(--cw-red)', opacity: 0.35, pointerEvents: 'none',
              }} />
            )}

            {data.projects.map((p) => {
              const left = pos(p.startDate) ?? 0;
              const right = pos(p.targetDate) ?? left + 6;
              const accent = p.vertical?.accent ?? TONE_VAR.blue;
              return (
                <div key={p.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <a href={`/consultant/projects/${p.id}`} style={{ fontWeight: 580, textDecoration: 'none', color: 'var(--cw-ink)' }}>{p.name}</a>
                    <StatusChip kind="project" value={p.status} />
                    <span className="cw-meta cw-num" style={{ marginLeft: 'auto' }}>{p.progress}%</span>
                  </div>

                  <div style={{ position: 'relative', height: 14, background: 'var(--cw-sunken)', borderRadius: 7, marginBottom: 5 }}>
                    <div style={{
                      position: 'absolute', left: `${Math.max(0, left)}%`,
                      width: `${Math.max(1.5, Math.min(100, right) - Math.max(0, left))}%`,
                      top: 2, bottom: 2, borderRadius: 5, background: accent, opacity: 0.24,
                    }} />
                    <div style={{
                      position: 'absolute', left: `${Math.max(0, left)}%`,
                      width: `${Math.max(1.5, (Math.min(100, right) - Math.max(0, left)) * (p.progress / 100))}%`,
                      top: 2, bottom: 2, borderRadius: 5, background: accent,
                    }} />
                    {p.milestones?.map((m) => {
                      const x = pos(m.targetDate);
                      if (x == null) return null;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          title={`${m.name} · ${fmtDate(m.targetDate)}`}
                          onClick={() => ws.openRecord('MILESTONE', m.id)}
                          style={{
                            position: 'absolute', left: `${x}%`, top: -3, transform: 'translateX(-50%)',
                            width: 14, height: 20, border: 0, background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 2,
                          }}
                        >
                          <span style={{
                            width: 8, height: 8, transform: 'rotate(45deg)',
                            background: TONE_VAR[milestoneTone(m.status)], boxShadow: '0 0 0 1.5px var(--cw-bg)',
                          }} />
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(p.tasks ?? []).slice(0, 12).map((t) => {
                      const tl = pos(t.startDate ?? t.dueDate) ?? 0;
                      const tr = pos(t.dueDate ?? t.startDate) ?? tl + 2;
                      const w = Math.max(1.2, Math.min(100, tr) - Math.max(0, tl));
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => ws.openRecord('TASK', t.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', padding: '1px 0', cursor: 'pointer', width: '100%' }}
                          title={`${t.ref} ${t.title}`}
                        >
                          <span className="cw-meta cw-truncate" style={{ width: 168, flex: 'none', textAlign: 'left' }}>{t.ref} {t.title}</span>
                          <span style={{ position: 'relative', flex: 1, height: 9 }}>
                            <span
                              ref={(el) => registerBar(t.id, el)}
                              style={{
                                position: 'absolute', left: `${Math.max(0, tl)}%`, width: `${w}%`,
                                top: 1, bottom: 1, borderRadius: 3,
                                background: TONE_VAR[taskTone(t.status)], opacity: 0.85,
                              }}
                            />
                          </span>
                        </button>
                      );
                    })}
                    {(p.tasks?.length ?? 0) > 12 && (
                      <span className="cw-meta" style={{ paddingLeft: 4 }}>+{p.tasks!.length - 12} more dated task(s) — open the project to see them all</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {links.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', borderTop: '1px solid var(--cw-line)', paddingTop: 10 }}>
              <LegendLine colour="var(--cw-ink-4)" label="Blocks — predecessor finishes first" />
              <LegendLine colour="var(--cw-red)" label="Out of sequence — successor starts too early" />
            </div>
          )}
        </div>
      );

  if (embedded) return body;
  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Timeline' }]}
      title="Timeline"
      description="Projects, milestones, dated work and the dependencies between them."
      actions={!fixed ? <VerticalPicker value={verticalId} onChange={setVerticalId} /> : undefined}
    >
      {body}
    </Page>
  );
}

function LegendLine({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="22" height="8" aria-hidden="true">
        <path d="M0 4 H14" stroke={colour} strokeWidth="1.25" fill="none" />
        <polygon points="20,4 15,1.6 15,6.4" fill={colour} />
      </svg>
      <span className="cw-meta">{label}</span>
    </span>
  );
}

// ============================================================ Calendar

export function CalendarScreen({ verticalId: fixed }: { verticalId?: string }) {
  const ws = useWorkspace();
  const [verticalId, setVerticalId] = useState<string | null>(fixed ?? null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const from = useMemo(() => { const d = new Date(cursor); d.setDate(1); return d; }, [cursor]);
  const to = useMemo(() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59); return d; }, [cursor]);
  const query = useCalendar(from.toISOString(), to.toISOString(), verticalId ?? undefined);
  const data = query.data;

  const cells = useMemo(() => {
    const startOffset = (from.getDay() + 6) % 7; // Monday-first
    const out: (Date | null)[] = Array.from({ length: startOffset }, () => null);
    for (let i = 1; i <= to.getDate(); i++) out.push(new Date(from.getFullYear(), from.getMonth(), i));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [from, to]);

  const byDay = useMemo(() => {
    const m = new Map<string, { label: string; colour: string; onClick?: () => void }[]>();
    const push = (d: string | null | undefined, item: { label: string; colour: string; onClick?: () => void }) => {
      if (!d) return;
      const key = new Date(d).toDateString();
      m.set(key, [...(m.get(key) ?? []), item]);
    };
    for (const t of data?.tasks ?? []) push(t.dueDate, { label: `${t.ref} ${t.title}`, colour: TONE_VAR[taskTone(t.status)], onClick: () => ws.openRecord('TASK', t.id) });
    for (const ms of data?.milestones ?? []) push(ms.targetDate, { label: ms.name, colour: TONE_VAR[milestoneTone(ms.status)], onClick: () => ws.openRecord('MILESTONE', ms.id) });
    for (const d of data?.deployments ?? []) push(d.startedAt, { label: `${d.version ?? 'Deploy'} · ${humanize(d.environment)}`, colour: TONE_VAR.violet });
    return m;
  }, [data, ws]);

  const today = new Date().toDateString();

  return (
    <Page
      crumbs={[{ label: 'Consultant', href: '/consultant' }, { label: 'Calendar' }]}
      title="Calendar"
      description="Deadlines, milestones and releases."
      actions={
        <>
          {!fixed && <VerticalPicker value={verticalId} onChange={setVerticalId} />}
          <button className="cw-icon-btn" aria-label="Previous month" onClick={() => setCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; })}><ChevronLeft size={15} /></button>
          <span style={{ fontWeight: 620, minWidth: 128, textAlign: 'center' }}>
            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button className="cw-icon-btn" aria-label="Next month" onClick={() => setCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; })}><ChevronRight size={15} /></button>
        </>
      }
    >
      {query.isLoading ? <Loading kind="cards" rows={6} />
        : query.isError ? <ErrorState error={query.error} what="the calendar" onRetry={query.refetch} />
          : (
            <div style={{ paddingTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: 'var(--cw-line)', border: '1px solid var(--cw-line)', borderRadius: 'var(--cw-r)', overflow: 'hidden' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="cw-meta" style={{ background: 'var(--cw-sunken)', textAlign: 'center', padding: '6px 0', fontWeight: 620 }}>{d}</div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} style={{ background: 'var(--cw-sunken)', minHeight: 96 }} />;
                  const items = byDay.get(d.toDateString()) ?? [];
                  const isToday = d.toDateString() === today;
                  return (
                    <div key={d.toISOString()} style={{ background: 'var(--cw-bg)', minHeight: 96, padding: 6 }}>
                      <div className="cw-num" style={{
                        fontSize: 11.5, fontWeight: isToday ? 750 : 550, marginBottom: 5,
                        color: isToday ? 'var(--cw-bg)' : 'var(--cw-ink-3)',
                        background: isToday ? 'var(--cw-ink)' : 'transparent',
                        width: 18, height: 18, borderRadius: '50%', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>{d.getDate()}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {items.slice(0, 3).map((it, j) => (
                          <button
                            key={j}
                            type="button"
                            title={it.label}
                            onClick={it.onClick}
                            className="cw-cal-item"
                            style={{ borderLeftColor: it.colour, cursor: it.onClick ? 'pointer' : 'default' }}
                          >{it.label}</button>
                        ))}
                        {items.length > 3 && <span className="cw-meta" style={{ fontSize: 10 }}>+{items.length - 3} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <Legend colour={TONE_VAR.blue} label="Task due" />
                <Legend colour={TONE_VAR.green} label="Milestone" />
                <Legend colour={TONE_VAR.violet} label="Deployment" />
              </div>
            </div>
          )}
    </Page>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 3, borderRadius: 2, background: colour }} />
      <span className="cw-meta">{label}</span>
    </span>
  );
}
