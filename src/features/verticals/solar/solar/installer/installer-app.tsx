'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Camera, HardHat, WifiOff, RefreshCw, ChevronLeft, ShieldCheck, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { WorkOrder } from '../solar-client';
import { QueuedOp, cacheWorkOrders, enqueue, flush, isOnline, pendingCount, readCachedWorkOrders } from './offline-queue';

/**
 * E6 — the installer app. Mobile-first and offline-first: a crew on a roof with no
 * signal can tick the checklist, attach photos, sign off and file the report, and it
 * all syncs when they get bars back.
 */
export function InstallerApp() {
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = useCallback(async (op: QueuedOp) => {
    if (op.kind === 'tick') {
      await api.patch(`/solar/checklist/${op.checklistItemId}`, { done: op.done, note: op.note });
    } else {
      await api.post(`/solar/work-orders/${op.workOrderId}/complete`, {
        safetySignedBy: op.safetySignedBy, report: op.report, photos: op.photos,
      });
    }
  }, []);

  const [crew, setCrew] = useState<string>(() => {
    try { return localStorage.getItem('bmn-installer-crew') ?? ''; } catch { return ''; }
  });
  const [crews, setCrews] = useState<string[]>([]);
  const pickCrew = (c: string) => {
    setCrew(c);
    try { localStorage.setItem('bmn-installer-crew', c); } catch {}
  };
  useEffect(() => {
    api.get<string[]>('/solar/crews').then((r) => setCrews(r.data)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const team = (() => { try { return localStorage.getItem('bmn-installer-crew') ?? ''; } catch { return ''; } })();
      const { data } = await api.get<WorkOrder[]>(`/solar/work-orders/mine${team ? `?team=${encodeURIComponent(team)}` : ''}`);
      setOrders(data);
      await cacheWorkOrders('mine', data);
      setCachedAt(Date.now());
    } catch {
      // No signal (or the request failed): fall back to what was last cached.
      const cached = await readCachedWorkOrders<WorkOrder[]>('mine');
      if (cached) { setOrders(cached.data); setCachedAt(cached.at); }
      else setOrders([]);
    }
  }, []);

  useEffect(() => { load(); }, [crew, load]);

  const sync = useCallback(async (silent = false) => {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      const r = await flush(send);
      setQueued(r.remaining);
      if (r.sent > 0) await load();
      if (r.errors.length) setNote(`${r.errors.length} change(s) were rejected: ${r.errors[0]}`);
      else if (!silent && r.sent > 0) setNote(`${r.sent} change(s) synced`);
    } finally { setSyncing(false); }
  }, [send, load]);

  useEffect(() => {
    setOnline(isOnline());
    void load();
    void pendingCount().then(setQueued);
    void sync(true);
    const on = () => { setOnline(true); void sync(true); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-installer.js', { scope: '/installer' }).catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load, sync]);

  /** Apply locally first, then queue — the crew sees the tick instantly either way. */
  const queueOp = async (op: QueuedOp) => {
    await enqueue(op);
    setQueued(await pendingCount());
    if (isOnline()) void sync(true);
  };

  const open = orders?.find((o) => o.id === openId) ?? null;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 90 }}>
      <StatusBar online={online} queued={queued} syncing={syncing} cachedAt={cachedAt} onSync={() => void sync()} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 0' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Crew</span>
        <select className="input" style={{ height: 32, fontSize: 13, flex: 1 }} value={crew} onChange={(e) => pickCrew(e.target.value)}>
          <option value="">All jobs (no crew selected)</option>
          {crews.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {note && (
        <div style={{ margin: '10px 14px', fontSize: 12.5, background: 'var(--surface-2)', borderRadius: 9, padding: '9px 11px', display: 'flex', gap: 8 }}>
          <span style={{ flex: 1 }}>{note}</span>
          <button onClick={() => setNote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}><X size={14} /></button>
        </div>
      )}

      {!open && <JobList orders={orders} onOpen={setOpenId} crew={crew} />}
      {open && (
        <JobDetail
          order={open}
          onBack={() => setOpenId(null)}
          onTick={async (itemId, done) => {
            setOrders((prev) => prev?.map((o) => o.id !== open.id ? o : {
              ...o, checklist: o.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)),
            }) ?? prev);
            await queueOp({ kind: 'tick', checklistItemId: itemId, done });
          }}
          onComplete={async (payload) => {
            setOrders((prev) => prev?.map((o) => (o.id === open.id ? { ...o, status: 'COMPLETE', ...payload } : o)) ?? prev);
            await queueOp({ kind: 'complete', workOrderId: open.id, ...payload });
            setOpenId(null);
            setNote(isOnline() ? 'Job filed' : 'Job saved — it will sync when you have signal');
          }}
        />
      )}
    </div>
  );
}

function StatusBar({ online, queued, syncing, cachedAt, onSync }: { online: boolean; queued: number; syncing: boolean; cachedAt: number | null; onSync: () => void }) {
  const tone = !online ? { bg: '#4a3410', fg: '#f6c66a' } : queued > 0 ? { bg: 'var(--surface-2)', fg: 'var(--ink-2)' } : { bg: 'var(--surface-2)', fg: 'var(--ink-3)' };
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: tone.bg, color: tone.fg, fontSize: 12.5 }}>
      {!online ? <WifiOff size={14} /> : <HardHat size={14} />}
      <span style={{ flex: 1 }}>
        {!online
          ? `Working offline${queued ? ` · ${queued} change${queued === 1 ? '' : 's'} waiting` : ''}`
          : queued > 0 ? `${queued} change${queued === 1 ? '' : 's'} to sync` : 'All changes saved'}
        {!online && cachedAt && <span style={{ opacity: .8 }}> · list from {new Date(cachedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>}
      </span>
      {online && queued > 0 && (
        <button onClick={onSync} disabled={syncing} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} /> Sync
        </button>
      )}
    </div>
  );
}

function JobList({ orders, onOpen, crew }: { orders: WorkOrder[] | null; onOpen: (id: string) => void; crew?: string }) {
  if (!orders) return <P>Loading your jobs…</P>;
  const todo = orders.filter((o) => o.status !== 'COMPLETE');
  const done = orders.filter((o) => o.status === 'COMPLETE');
  return (
    <div style={{ padding: 14 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 14px' }}>Today&apos;s jobs</h1>
      {!todo.length && !done.length && <P>{crew ? `No jobs assigned to ${crew} yet — assign one from the project's Installation panel.` : 'No jobs assigned.'}</P>}
      {todo.map((o) => <JobCard key={o.id} o={o} onOpen={onOpen} />)}
      {done.length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '18px 0 8px' }}>Completed</div>}
      {done.map((o) => <JobCard key={o.id} o={o} onOpen={onOpen} />)}
    </div>
  );
}

function JobCard({ o, onOpen }: { o: WorkOrder; onOpen: (id: string) => void }) {
  const done = o.checklist.filter((c) => c.done).length;
  const pct = o.checklist.length ? (done / o.checklist.length) * 100 : 0;
  return (
    <button onClick={() => onOpen(o.id)} style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 14, padding: 15, marginBottom: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{o.title}</div>
        {o.status === 'COMPLETE'
          ? <span className="badge" style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)' }}>Done</span>
          : <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{done}/{o.checklist.length}</span>}
      </div>
      {o.teamName && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{o.teamName}</div>}
      {o.status !== 'COMPLETE' && (
        <div style={{ height: 5, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 10 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand,#132376)' }} />
        </div>
      )}
    </button>
  );
}

function JobDetail({ order, onBack, onTick, onComplete }: {
  order: WorkOrder; onBack: () => void;
  onTick: (itemId: string, done: boolean) => void | Promise<void>;
  onComplete: (p: { safetySignedBy: string; report: string; photos: string[] }) => void | Promise<void>;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [signedBy, setSignedBy] = useState('');
  const [report, setReport] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const outstanding = order.checklist.filter((c) => !c.done);
  const complete = order.status === 'COMPLETE';

  // Photos are held as data URLs so they survive with the queued job while offline.
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 8).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setPhotos((p) => [...p, String(r.result)]);
      r.readAsDataURL(f);
    });
  };

  const submit = () => {
    if (outstanding.length) return setErr(`${outstanding.length} step(s) still open`);
    if (!signedBy.trim()) return setErr('A safety sign-off is required');
    if (!report.trim()) return setErr('An installation report is required');
    setErr(null);
    void onComplete({ safetySignedBy: signedBy.trim(), report: report.trim(), photos });
  };

  return (
    <div style={{ padding: 14 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, padding: '4px 0 12px' }}>
        <ChevronLeft size={16} /> All jobs
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{order.title}</h1>
      {order.teamName && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>{order.teamName}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
        {order.checklist.map((c) => (
          <button key={c.id} disabled={complete} onClick={() => onTick(c.id, !c.done)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '13px 2px', cursor: complete ? 'default' : 'pointer', borderBottom: '1px solid var(--line-soft)' }}>
            {c.done ? <CheckCircle2 size={21} style={{ color: 'var(--success,#1e874b)', flexShrink: 0 }} /> : <Circle size={21} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />}
            <span style={{ fontSize: 14.5, lineHeight: 1.35, color: c.done ? 'var(--ink-3)' : 'var(--ink-1)', textDecoration: c.done ? 'line-through' : undefined }}>{c.label}</span>
          </button>
        ))}
      </div>

      {complete ? (
        <div style={{ background: 'var(--success-bg,#e6f4ea)', color: 'var(--success,#1e874b)', borderRadius: 12, padding: 14, fontSize: 13.5 }}>
          <ShieldCheck size={15} style={{ verticalAlign: -2 }} /> Signed off by {order.safetySignedBy}
          {order.report && <div style={{ marginTop: 6, color: 'var(--ink-2)' }}>{order.report}</div>}
        </div>
      ) : (
        <>
          <Label>Photos</Label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={p} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 9, border: '1px solid var(--line-soft)' }} />
                <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove"
                  style={{ position: 'absolute', top: -6, right: -6, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()}
              style={{ width: 72, height: 72, borderRadius: 9, border: '1px dashed var(--line-soft)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--ink-3)', fontSize: 11 }}>
              <Camera size={17} /> Add
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          </div>

          <Label>Safety sign-off</Label>
          <input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Who is signing?" style={inp} />

          <Label>Installation report</Label>
          <textarea value={report} onChange={(e) => setReport(e.target.value)} rows={4} placeholder="What was done, anything the office should know…" style={{ ...inp, resize: 'vertical' }} />

          {err && <div style={{ color: 'var(--danger,#c0392b)', fontSize: 13, margin: '4px 0 10px' }}>{err}</div>}

          <button onClick={submit}
            style={{ width: '100%', height: 52, borderRadius: 12, border: 'none', background: 'var(--brand,#132376)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
            Close job
          </button>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>
            Works offline — everything syncs when you have signal.
          </div>
        </>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '13px 14px', fontSize: 16, borderRadius: 11,
  border: '1px solid var(--line-soft)', background: 'var(--surface)', marginBottom: 14, color: 'inherit',
};
const Label = ({ children }: { children: React.ReactNode }) =>
  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', margin: '4px 0 7px' }}>{children}</div>;
const P = ({ children }: { children: React.ReactNode }) =>
  <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>{children}</div>;
