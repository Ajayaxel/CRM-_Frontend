'use client';

/**
 * Omni — the visual flow builder.
 *
 * A conversation flow is a graph: a trigger, some messages, some questions, a
 * branch or two. Everything here is hand-rolled — nodes are absolutely
 * positioned cards on a transformed layer, edges are bezier paths in an SVG
 * overlay behind them. No graph library, because the bundle has to stay honest.
 *
 * The three surfaces are the list (cards), the canvas (palette · canvas ·
 * inspector) and the simulator drawer. The runtime service owns /flows; while
 * those routes are still landing every query degrades to an empty state instead
 * of throwing.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Bolt, Clock, GitBranch, HelpCircle, MessageSquare, Minus, Pause,
  Play, Plus, Save, Sparkles, Trash2, UserRound, Waypoints, Zap, ZoomIn,
} from 'lucide-react';
import {
  Badge, Card, Drawer, EmptyState, Field, FormSection, Skeleton, Toolbar,
  useIsNarrow, TONE, type Tone,
} from '@/features/verticals/insurance/insurance/ui/kit';
import { omniApi, CHANNEL_META, type ChannelType, type Bot } from '../omni-client';

// ============================================================ domain

export type FlowNodeType =
  | 'TRIGGER' | 'MESSAGE' | 'QUESTION' | 'CONDITION' | 'ACTION' | 'AI' | 'HANDOFF' | 'DELAY';

export type FlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type TriggerKind = 'KEYWORD' | 'NEW_CONVERSATION' | 'CTWA' | 'CAMPAIGN';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowTrigger {
  kind: TriggerKind;
  keywords?: string[];
}

export interface Flow {
  id: string;
  name: string;
  description?: string | null;
  channelType: ChannelType;
  status: FlowStatus;
  trigger: FlowTrigger;
  nodes: FlowNode[];
  edges: FlowEdge[];
  version?: number;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

const FLOW_CHANNELS: ChannelType[] = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TELEGRAM', 'WEB_CHAT', 'SMS'];

const NODE_META: Record<FlowNodeType, { label: string; icon: any; tone: Tone; blurb: string }> = {
  TRIGGER: { label: 'Trigger', icon: Zap, tone: 'active', blurb: 'Where every conversation starts' },
  MESSAGE: { label: 'Send message', icon: MessageSquare, tone: 'info', blurb: 'Say something, optionally with buttons' },
  QUESTION: { label: 'Ask a question', icon: HelpCircle, tone: 'sales', blurb: 'Ask, then remember the answer' },
  CONDITION: { label: 'Branch', icon: GitBranch, tone: 'renewal', blurb: 'Split the path on what you know' },
  ACTION: { label: 'Do something', icon: Bolt, tone: 'claim', blurb: 'Tag, set a field, create a lead' },
  AI: { label: 'AI reply', icon: Sparkles, tone: 'claim', blurb: 'Let a bot answer freely' },
  HANDOFF: { label: 'Hand to human', icon: UserRound, tone: 'expired', blurb: 'Put it in the team inbox' },
  DELAY: { label: 'Wait', icon: Clock, tone: 'neutral', blurb: 'Pause before the next step' },
};

const PALETTE: FlowNodeType[] = ['TRIGGER', 'MESSAGE', 'QUESTION', 'CONDITION', 'ACTION', 'AI', 'HANDOFF', 'DELAY'];

const STATUS_TONE: Record<FlowStatus, Tone> = {
  DRAFT: 'neutral', ACTIVE: 'active', PAUSED: 'renewal', ARCHIVED: 'neutral',
};
const STATUS_LABEL: Record<FlowStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Live', PAUSED: 'Paused', ARCHIVED: 'Archived',
};

// ============================================================ geometry

const NODE_W = 226;
const CANVAS_W = 4000;
const CANVAS_H = 2600;
const GRID = 8;
const Z_MIN = 0.4;
const Z_MAX = 1.5;

const nodeH = (n: FlowNode) => (n.type === 'CONDITION' ? 98 : 78);
const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const inPort = (n: FlowNode) => ({ x: n.x, y: n.y + nodeH(n) / 2 });

function outPort(n: FlowNode, handle?: string) {
  if (n.type === 'CONDITION') return { x: n.x + NODE_W, y: n.y + (handle === 'false' ? 68 : 36) };
  return { x: n.x + NODE_W, y: n.y + nodeH(n) / 2 };
}

function bezier(s: { x: number; y: number }, t: { x: number; y: number }) {
  const dx = Math.max(46, Math.abs(t.x - s.x) * 0.5);
  return `M${s.x},${s.y} C${s.x + dx},${s.y} ${t.x - dx},${t.y} ${t.x},${t.y}`;
}

function hitNode(nodes: FlowNode[], p: { x: number; y: number }) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y && p.y <= n.y + nodeH(n)) return n;
  }
  return null;
}

let idSeq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(idSeq++).toString(36)}`;

// ============================================================ copy helpers

function triggerSummary(t?: FlowTrigger | null) {
  if (!t) return 'No trigger set';
  switch (t.kind) {
    case 'KEYWORD':
      return t.keywords?.length ? `Keyword: ${t.keywords.join(', ')}` : 'Keyword: none set yet';
    case 'NEW_CONVERSATION': return 'Any new conversation';
    case 'CTWA': return 'Click-to-WhatsApp ad';
    case 'CAMPAIGN': return 'Reply to a campaign';
    default: return 'No trigger set';
  }
}

const OP_LABEL: Record<string, string> = {
  eq: 'is', neq: 'is not', contains: 'contains', gt: 'is more than', lt: 'is less than', exists: 'has any answer',
};

function nodeSummary(n: FlowNode, trigger?: FlowTrigger | null) {
  const d = n.data ?? {};
  switch (n.type) {
    case 'TRIGGER': return triggerSummary(trigger);
    case 'MESSAGE': return d.body ? String(d.body).split('\n')[0] : 'Nothing to say yet';
    case 'QUESTION':
      return d.prompt
        ? `Ask: ${String(d.prompt).split('\n')[0]}${d.variable ? ` → ${d.variable}` : ''}`
        : 'No question written yet';
    case 'CONDITION':
      if (!d.variable) return 'No answer chosen yet';
      return `${d.variable} ${OP_LABEL[d.op as string] ?? 'is'}${d.op === 'exists' ? '' : ` ${d.value ?? '…'}`}`;
    case 'ACTION':
      if (d.kind === 'TAG') return d.tag ? `Tag the contact "${d.tag}"` : 'Tag the contact';
      if (d.kind === 'SET_FIELD') return d.field ? `Set ${d.field} = ${d.value ?? '…'}` : 'Set a field';
      if (d.kind === 'CREATE_LEAD') return 'Create a lead in the CRM';
      if (d.kind === 'API_CALL') return d.url ? `Call ${d.url}` : 'Call an external URL';
      return 'Pick what should happen';
    case 'AI': return d.prompt ? String(d.prompt).split('\n')[0] : 'AI answers in its own words';
    case 'HANDOFF': return 'Hands the chat to a human';
    case 'DELAY': return `Waits ${d.minutes ?? 0} minute${Number(d.minutes) === 1 ? '' : 's'}`;
    default: return '';
  }
}

function nodeTitle(n: FlowNode) {
  return (n.data?.title as string) || NODE_META[n.type].label;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================ validation

/** Plain-language reasons a flow is not fit to go live. */
function validateFlow(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const issues: string[] = [];
  const triggers = nodes.filter((n) => n.type === 'TRIGGER');

  if (triggers.length === 0) issues.push('This flow has no starting point. Add a Trigger node so WhatsApp knows when to run it.');
  if (triggers.length > 1) issues.push(`There are ${triggers.length} Trigger nodes. A flow can only start in one place — delete the extras.`);

  if (triggers.length === 1) {
    const seen = new Set<string>([triggers[0].id]);
    const queue = [triggers[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (e.source === cur && !seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
      }
    }
    const orphans = nodes.filter((n) => !seen.has(n.id));
    if (orphans.length) {
      issues.push(
        `${orphans.length === 1 ? 'One step is' : `${orphans.length} steps are`} not connected to the trigger, so nobody will ever reach ${orphans.length === 1 ? 'it' : 'them'}: ${orphans.map(nodeTitle).join(', ')}.`,
      );
    }
  }

  for (const n of nodes) {
    if (n.type === 'QUESTION' && !String(n.data?.variable ?? '').trim()) {
      issues.push(`"${nodeTitle(n)}" asks a question but has nowhere to keep the answer. Give it a name to save into.`);
    }
    if (n.type === 'QUESTION' && !String(n.data?.prompt ?? '').trim()) {
      issues.push(`"${nodeTitle(n)}" has no question written in it yet.`);
    }
    if (n.type === 'MESSAGE' && !String(n.data?.body ?? '').trim()) {
      issues.push(`"${nodeTitle(n)}" is a message with no text in it.`);
    }
    if (n.type === 'CONDITION') {
      if (!String(n.data?.variable ?? '').trim()) {
        issues.push(`"${nodeTitle(n)}" has to branch on something — choose the answer it should check.`);
      }
      const t = edges.some((e) => e.source === n.id && (e.sourceHandle ?? 'true') === 'true');
      const f = edges.some((e) => e.source === n.id && e.sourceHandle === 'false');
      if (!t && !f) issues.push(`"${nodeTitle(n)}" branches but neither the Yes nor the No path goes anywhere.`);
      else if (!t) issues.push(`"${nodeTitle(n)}" has no Yes path — connect it to the next step.`);
      else if (!f) issues.push(`"${nodeTitle(n)}" has no No path — connect it to the next step.`);
    }
  }

  return issues;
}

// ============================================================ feature root

export function FlowsFeature() {
  const [openId, setOpenId] = useState<string | null>(null);
  return openId
    ? <FlowEditor id={openId} onBack={() => setOpenId(null)} />
    : <FlowList onOpen={setOpenId} />;
}

// ============================================================ list

function FlowList({ onOpen }: { onOpen: (id: string) => void }) {
  const [compose, setCompose] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['omni-flows'],
    queryFn: async () => (await omniApi.get<Flow[]>('/flows')).data,
    retry: false,
  });

  const flows = data ?? [];

  return (
    <div className="ds-stack">
      <Toolbar>
        <div style={{ marginRight: 'auto', minWidth: 0 }}>
          <h1 className="ds-h1">Flows</h1>
          <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
            Draw the conversation once — welcome, qualify, book — and let it run itself.
          </div>
        </div>
        <button className="btn-primary" onClick={() => setCompose(true)}><Plus size={15} /> New flow</button>
      </Toolbar>

      {isLoading && <Skeleton rows={3} height={132} />}

      {!isLoading && isError && (
        <Card>
          <EmptyState
            icon={Waypoints}
            title="The flow service isn’t answering yet"
            body="Flows live on the omni runtime. Once it is up this page will fill itself in — nothing you have built is lost."
          />
        </Card>
      )}

      {!isLoading && !isError && flows.length === 0 && (
        <Card>
          <EmptyState
            icon={Waypoints}
            title="No flows yet"
            body="A flow is the conversation you would have had anyway — greet someone, ask what they need, book the appointment. Build it once and it answers at 2am."
            actionLabel="Build your first flow"
            onAction={() => setCompose(true)}
          />
        </Card>
      )}

      {!isLoading && !isError && flows.length > 0 && (
        <div className="ds-grid ds-grid-cards">
          {flows.map((f) => (
            <Card key={f.id} onClick={() => onOpen(f.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s-3)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ds-h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>
                    {CHANNEL_META[f.channelType]?.label ?? f.channelType}
                  </div>
                </div>
                <Badge tone={STATUS_TONE[f.status] ?? 'neutral'}>{STATUS_LABEL[f.status] ?? f.status}</Badge>
              </div>

              <div className="ds-small" style={{ marginTop: 'var(--s-3)', color: 'var(--ink-2)' }}>
                {triggerSummary(f.trigger)}
              </div>

              <div style={{
                display: 'flex', gap: 'var(--s-4)', marginTop: 'var(--s-4)',
                paddingTop: 'var(--s-3)', borderTop: '1px solid var(--hairline-soft)',
              }}>
                <span className="ds-caption">{f.nodes?.length ?? 0} step{(f.nodes?.length ?? 0) === 1 ? '' : 's'}</span>
                <span className="ds-caption" style={{ marginLeft: 'auto' }}>
                  {f.publishedAt ? `Published ${fmtDate(f.publishedAt)}` : 'Never published'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewFlowDrawer open={compose} onClose={() => setCompose(false)} onCreated={onOpen} />
    </div>
  );
}

// ============================================================ new flow

function NewFlowDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('WHATSAPP');
  const [kind, setKind] = useState<TriggerKind>('KEYWORD');
  const [keywords, setKeywords] = useState('hi, hello');

  useEffect(() => {
    if (!open) return;
    setName(''); setDescription(''); setChannelType('WHATSAPP'); setKind('KEYWORD'); setKeywords('hi, hello');
  }, [open]);

  const create = useMutation({
    mutationFn: async () => {
      const trigger: FlowTrigger = {
        kind,
        ...(kind === 'KEYWORD' ? { keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
      };
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        channelType,
        trigger,
        // Every flow is born with its entry point already on the canvas — a
        // blank canvas with no trigger is a puzzle, not a starting point.
        nodes: [{ id: newId('trigger'), type: 'TRIGGER', x: 96, y: 240, data: {} }],
        edges: [],
      };
      return (await omniApi.post<Flow>('/flows', body)).data;
    },
    onSuccess: (flow) => {
      qc.invalidateQueries({ queryKey: ['omni-flows'] });
      toast.success('Flow created');
      onClose();
      if (flow?.id) onCreated(flow.id);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not create the flow'),
  });

  return (
    <Drawer open={open} onClose={onClose} title="New flow" subtitle="Name it, pick the channel, decide what starts it.">
      <FormSection title="The basics">
        <Field label="Flow name" required span={2}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome and qualify" />
        </Field>
        <Field label="Description" hint="Optional — a note for whoever edits this next." span={2}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Greets new enquiries and books a call" />
        </Field>
        <Field label="Channel">
          <select className="input" value={channelType} onChange={(e) => setChannelType(e.target.value as ChannelType)}>
            {FLOW_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_META[c].label}</option>)}
          </select>
        </Field>
      </FormSection>

      <FormSection title="What starts it" description="The moment this flow takes over the conversation.">
        <Field label="Trigger" span={2}>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as TriggerKind)}>
            <option value="KEYWORD">Someone sends a keyword</option>
            <option value="NEW_CONVERSATION">Any brand-new conversation</option>
            <option value="CTWA">A click-to-WhatsApp ad</option>
            <option value="CAMPAIGN">A reply to a campaign</option>
          </select>
        </Field>
        {kind === 'KEYWORD' && (
          <Field label="Keywords" hint="Separate with commas. Matching is not case sensitive." span={2}>
            <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="hi, hello, start" />
          </Field>
        )}
      </FormSection>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          Create flow
        </button>
      </div>
    </Drawer>
  );
}

// ============================================================ editor

type Selection = { kind: 'node' | 'edge'; id: string } | null;
type Gesture =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'node'; id: string; dx: number; dy: number; moved: boolean }
  | null;

function FlowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const narrow = useIsNarrow(900);

  const { data: flow, isLoading, isError } = useQuery({
    queryKey: ['omni-flow', id],
    queryFn: async () => (await omniApi.get<Flow>(`/flows/${id}`)).data,
    retry: false,
  });

  const [name, setName] = useState('');
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<Selection>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [testing, setTesting] = useState(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!flow || loadedFor.current === flow.id) return;
    loadedFor.current = flow.id;
    setName(flow.name ?? '');
    setNodes(Array.isArray(flow.nodes) ? flow.nodes : []);
    setEdges(Array.isArray(flow.edges) ? flow.edges : []);
    setDirty(false);
    setSel(null);
  }, [flow]);

  // ---------------------------------------------------------- view

  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 24, y: 24, z: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const toCanvas = useCallback((cx: number, cy: number) => {
    const r = viewportRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => {
      const r = viewportRef.current?.getBoundingClientRect();
      const z = clamp(v.z * factor, Z_MIN, Z_MAX);
      const mx = (r?.width ?? 0) / 2;
      const my = (r?.height ?? 0) / 2;
      const k = z / v.z;
      return { z, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  }, []);

  // Wheel zoom anchored on the pointer. Registered natively because React's
  // wheel handler is passive and cannot stop the page from scrolling too.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      const z = clamp(v.z * (e.deltaY > 0 ? 0.92 : 1.08), Z_MIN, Z_MAX);
      const k = z / v.z;
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView({ z, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [narrow, flow?.id]);

  // ---------------------------------------------------------- graph edits

  const patchNodes = useCallback((fn: (ns: FlowNode[]) => FlowNode[]) => {
    setNodes((ns) => fn(ns));
    setDirty(true);
  }, []);

  const connect = useCallback((source: string, target: string, sourceHandle?: string) => {
    setEdges((es) => {
      // One edge per output: re-dragging a port re-routes it rather than
      // silently stacking two contradictory paths.
      const kept = es.filter((e) => !(e.source === source && (e.sourceHandle ?? null) === (sourceHandle ?? null)));
      if (kept.some((e) => e.source === source && e.target === target && (e.sourceHandle ?? null) === (sourceHandle ?? null))) return kept;
      return [...kept, { id: newId('e'), source, target, sourceHandle }];
    });
    setDirty(true);
  }, []);

  const addNode = useCallback((type: FlowNodeType, at?: { x: number; y: number }) => {
    if (type === 'TRIGGER' && nodesRef.current.some((n) => n.type === 'TRIGGER')) {
      toast.error('This flow already has a trigger — a conversation can only start in one place.');
      return;
    }
    const v = viewRef.current;
    const r = viewportRef.current?.getBoundingClientRect();
    const fallback = {
      x: (-v.x + (r?.width ?? 800) / 2) / v.z - NODE_W / 2,
      y: (-v.y + (r?.height ?? 600) / 2) / v.z - 40,
    };
    const p = at ?? fallback;
    const node: FlowNode = { id: newId(type.toLowerCase()), type, x: snap(p.x), y: snap(p.y), data: defaultData(type) };
    patchNodes((ns) => [...ns, node]);
    setSel({ kind: 'node', id: node.id });
  }, [patchNodes]);

  const removeNode = useCallback((nid: string) => {
    const n = nodesRef.current.find((x) => x.id === nid);
    if (n?.type === 'TRIGGER') {
      toast.error('The trigger is the entry point — every flow keeps exactly one.');
      return;
    }
    patchNodes((ns) => ns.filter((x) => x.id !== nid));
    setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid));
    setSel(null);
  }, [patchNodes]);

  const removeEdge = useCallback((eid: string) => {
    setEdges((es) => es.filter((e) => e.id !== eid));
    setDirty(true);
    setSel(null);
  }, []);

  const updateNodeData = useCallback((nid: string, patch: Record<string, any>) => {
    patchNodes((ns) => ns.map((n) => (n.id === nid ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [patchNodes]);

  // ---------------------------------------------------------- gestures

  const gesture = useRef<Gesture>(null);
  // The gesture itself lives in a ref so dragging does not re-render on every
  // pointermove — but a ref cannot drive the cursor, so the *fact* of dragging
  // is mirrored into state. Without this the canvas never showed "grabbing".
  const [dragging, setDragging] = useState<null | 'pan' | 'node'>(null);
  const [link, setLink] = useState<{ source: string; handle?: string; x: number; y: number } | null>(null);
  const linkRef = useRef(link);
  linkRef.current = link;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (g?.kind === 'pan') {
        setView((v) => ({ ...v, x: g.ox + (e.clientX - g.sx), y: g.oy + (e.clientY - g.sy) }));
        return;
      }
      if (g?.kind === 'node') {
        const p = toCanvas(e.clientX, e.clientY);
        g.moved = true;
        setNodes((ns) => ns.map((n) => (n.id === g.id ? { ...n, x: snap(p.x - g.dx), y: snap(p.y - g.dy) } : n)));
        return;
      }
      if (linkRef.current) {
        const p = toCanvas(e.clientX, e.clientY);
        setLink((l) => (l ? { ...l, x: p.x, y: p.y } : l));
      }
    };
    const onUp = (e: PointerEvent) => {
      const g = gesture.current;
      if (g?.kind === 'node' && g.moved) setDirty(true);
      gesture.current = null;
      setDragging(null);

      const l = linkRef.current;
      if (l) {
        const p = toCanvas(e.clientX, e.clientY);
        const target = hitNode(nodesRef.current, p);
        if (target && target.id !== l.source && target.type !== 'TRIGGER') connect(l.source, target.id, l.handle);
        setLink(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [toCanvas, connect]);

  const startNodeDrag = useCallback((e: React.PointerEvent, n: FlowNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    gesture.current = { kind: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y, moved: false };
    setDragging('node');
    setSel({ kind: 'node', id: n.id });
  }, [toCanvas]);

  const startLink = useCallback((e: React.PointerEvent, n: FlowNode, handle?: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = outPort(n, handle);
    setLink({ source: n.id, handle, x: p.x, y: p.y });
  }, []);

  const startPan = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const v = viewRef.current;
    gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y };
    setDragging('pan');
    setSel(null);
  }, []);

  // Delete removes whatever is selected, unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      if (!sel) return;
      e.preventDefault();
      if (sel.kind === 'edge') removeEdge(sel.id);
      else removeNode(sel.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, removeEdge, removeNode]);

  // ---------------------------------------------------------- persistence

  const save = useMutation({
    mutationFn: () => omniApi.patch(`/flows/${id}`, { name: name.trim(), nodes, edges }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['omni-flows'] });
      toast.success('Flow saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not save the flow'),
  });

  const publish = useMutation({
    mutationFn: async () => {
      await omniApi.patch(`/flows/${id}`, { name: name.trim(), nodes, edges });
      return omniApi.post(`/flows/${id}/publish`);
    },
    onSuccess: () => {
      setDirty(false);
      setConfirmPublish(false);
      qc.invalidateQueries({ queryKey: ['omni-flow', id] });
      qc.invalidateQueries({ queryKey: ['omni-flows'] });
      loadedFor.current = null;
      toast.success('Flow is live');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not publish the flow'),
  });

  const pause = useMutation({
    mutationFn: () => omniApi.post(`/flows/${id}/pause`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['omni-flow', id] });
      qc.invalidateQueries({ queryKey: ['omni-flows'] });
      loadedFor.current = null;
      toast.success('Flow paused');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not pause the flow'),
  });

  const onPublish = () => {
    const found = validateFlow(nodes, edges);
    setIssues(found);
    if (found.length) {
      toast.error('This flow is not ready to go live yet.');
      return;
    }
    setConfirmPublish(true);
  };

  const selectedNode = sel?.kind === 'node' ? nodes.find((n) => n.id === sel.id) ?? null : null;

  // ---------------------------------------------------------- render

  if (isLoading) {
    return (
      <div className="ds-stack">
        <Skeleton rows={1} height={54} />
        <Skeleton rows={1} height={520} />
      </div>
    );
  }

  if (isError || !flow) {
    return (
      <div className="ds-stack">
        <Toolbar>
          <button className="btn-secondary btn-sm" onClick={onBack}><ArrowLeft size={14} /> All flows</button>
        </Toolbar>
        <Card>
          <EmptyState
            icon={Waypoints}
            title="This flow could not be loaded"
            body="The omni runtime did not answer. Try again in a moment — the flow itself is safe on the server."
          />
        </Card>
      </div>
    );
  }

  const header = (
    <div className="ds-stack">
      <Toolbar>
        <button className="btn-ghost btn-sm" onClick={onBack} aria-label="Back to all flows">
          <ArrowLeft size={14} /> All flows
        </button>
        <input
          className="input"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          aria-label="Flow name"
          style={{ maxWidth: 320, fontWeight: 640 }}
        />
        <Badge tone={STATUS_TONE[flow.status] ?? 'neutral'}>{STATUS_LABEL[flow.status] ?? flow.status}</Badge>
        {dirty && <span className="ds-caption">Unsaved changes</span>}

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          <button className="btn-secondary btn-sm" onClick={() => setTesting(true)}><Play size={13} /> Test</button>
          {flow.status === 'ACTIVE' && (
            <button className="btn-secondary btn-sm" disabled={pause.isPending} onClick={() => pause.mutate()}>
              <Pause size={13} /> Pause
            </button>
          )}
          <button className="btn-secondary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>
            <Save size={13} /> Save
          </button>
          <button className="btn-primary btn-sm" disabled={publish.isPending} onClick={onPublish}>
            <Zap size={13} /> {flow.status === 'ACTIVE' ? 'Republish' : 'Publish'}
          </button>
        </span>
      </Toolbar>

      {issues.length > 0 && (
        <div style={{
          border: `1px solid ${TONE.expired.line}`, background: TONE.expired.bg,
          borderRadius: 'var(--r-card)', padding: 'var(--s-4)',
        }}>
          <div className="ds-h3" style={{ color: TONE.expired.fg }}>
            {issues.length === 1 ? 'One thing to fix before this can go live' : `${issues.length} things to fix before this can go live`}
          </div>
          <ul style={{ margin: 'var(--s-2) 0 0', paddingLeft: 18, display: 'grid', gap: 'var(--s-1)' }}>
            {issues.map((t, i) => <li key={i} className="ds-small" style={{ color: 'var(--ink-2)' }}>{t}</li>)}
          </ul>
          <button className="ds-viewall" style={{ marginTop: 'var(--s-2)' }} onClick={() => setIssues([])}>Dismiss</button>
        </div>
      )}
    </div>
  );

  if (narrow) {
    return (
      <div className="ds-stack">
        {header}
        <Card>
          <EmptyState
            icon={Waypoints}
            title="Flow editing needs a wider screen"
            body="Dragging nodes around a canvas on a phone is a fight, not a feature. Open this flow on a laptop to edit it — publishing and pausing still work from here."
          />
        </Card>
        <Card>
          <div className="ds-h3">What this flow does</div>
          <div className="ds-caption" style={{ marginTop: 'var(--s-1)' }}>{triggerSummary(flow.trigger)}</div>
          <div style={{ marginTop: 'var(--s-3)', display: 'grid', gap: 'var(--s-2)' }}>
            {nodes.map((n) => {
              const meta = NODE_META[n.type];
              const t = TONE[meta.tone];
              return (
                <div key={n.id} className="ds-list-row">
                  <span className="ds-entity-icon" style={{ color: t.fg, background: t.bg }}><meta.icon size={15} /></span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 560, color: 'var(--ink)' }}>{nodeTitle(n)}</div>
                    <div className="ds-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nodeSummary(n, flow.trigger)}
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <TestDrawer open={testing} onClose={() => setTesting(false)} flowId={id} />
      </div>
    );
  }

  const linkSource = link ? nodes.find((n) => n.id === link.source) : null;
  const emptyCanvas = nodes.filter((n) => n.type !== 'TRIGGER').length === 0;

  return (
    <div className="ds-stack">
      {header}

      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'stretch', minHeight: 560 }}>
        <Palette onAdd={addNode} hasTrigger={nodes.some((n) => n.type === 'TRIGGER')} />

        <div
          ref={viewportRef}
          onPointerDown={startPan}
          style={{
            position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden',
            background: 'var(--surface)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-card)', touchAction: 'none',
            cursor: dragging === 'pan' ? 'grabbing' : dragging === 'node' ? 'grabbing' : 'grab',
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('application/x-flow-node') as FlowNodeType;
            if (!type || !NODE_META[type]) return;
            const p = toCanvas(e.clientX, e.clientY);
            addNode(type, { x: p.x - NODE_W / 2, y: p.y - 36 });
          }}
        >
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: CANVAS_H,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, transformOrigin: '0 0',
              backgroundImage:
                'linear-gradient(to right, var(--hairline-soft) 1px, transparent 1px),'
                + 'linear-gradient(to bottom, var(--hairline-soft) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <svg
              width={CANVAS_W}
              height={CANVAS_H}
              // The overlay spans the whole canvas, so it must not swallow the
              // pan gesture — only the edge hit-paths opt back into events.
              style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
            >
              {edges.map((e) => {
                const s = nodes.find((n) => n.id === e.source);
                const t = nodes.find((n) => n.id === e.target);
                if (!s || !t) return null;
                const d = bezier(outPort(s, e.sourceHandle), inPort(t));
                const on = sel?.kind === 'edge' && sel.id === e.id;
                return (
                  <g key={e.id}>
                    {/* fat invisible stroke so an edge is actually clickable */}
                    <path
                      d={d} fill="none" stroke="transparent" strokeWidth={14}
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onPointerDown={(ev) => { ev.stopPropagation(); setSel({ kind: 'edge', id: e.id }); }}
                    />
                    <path
                      d={d} fill="none"
                      stroke={on ? TONE.info.fg : 'var(--hairline-strong)'}
                      strokeWidth={on ? 2.4 : 1.6}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}

              {link && linkSource && (
                <path
                  d={bezier(outPort(linkSource, link.handle), { x: link.x, y: link.y })}
                  fill="none" stroke={TONE.info.fg} strokeWidth={1.8} strokeDasharray="5 4"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>

            {nodes.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                selected={sel?.kind === 'node' && sel.id === n.id}
                summary={nodeSummary(n, flow.trigger)}
                onDragStart={(e) => startNodeDrag(e, n)}
                onLinkStart={(e, handle) => startLink(e, n, handle)}
                linking={!!link}
              />
            ))}
          </div>

          {emptyCanvas && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', padding: 'var(--s-6)',
            }}>
              <div>
                <div className="ds-h3">Drag a node from the left to begin</div>
                <div className="ds-caption" style={{ marginTop: 'var(--s-1)', maxWidth: '44ch' }}>
                  Start with a message, then a question, then a branch. Join them by dragging from the dot on a node’s right edge onto the next one.
                </div>
              </div>
            </div>
          )}

          <div style={{
            position: 'absolute', right: 'var(--s-3)', bottom: 'var(--s-3)', display: 'flex',
            gap: 'var(--s-1)', alignItems: 'center', background: 'var(--surface)',
            border: '1px solid var(--hairline)', borderRadius: 'var(--r-control)', padding: 'var(--s-1)',
          }}>
            <button className="btn-ghost btn-sm" aria-label="Zoom out" onClick={() => zoomBy(0.9)}><Minus size={13} /></button>
            <span className="ds-caption ds-num" style={{ minWidth: 38, textAlign: 'center' }}>{Math.round(view.z * 100)}%</span>
            <button className="btn-ghost btn-sm" aria-label="Zoom in" onClick={() => zoomBy(1.1)}><ZoomIn size={13} /></button>
            <button className="btn-ghost btn-sm" onClick={() => setView({ x: 24, y: 24, z: 1 })}>Reset</button>
          </div>
        </div>

        <Inspector
          node={selectedNode}
          flow={flow}
          onChange={(patch) => selectedNode && updateNodeData(selectedNode.id, patch)}
          onDelete={() => selectedNode && removeNode(selectedNode.id)}
        />
      </div>

      {confirmPublish && (
        <Drawer
          open
          onClose={() => setConfirmPublish(false)}
          title="Publish this flow?"
          subtitle="It starts answering real people as soon as you confirm."
          width={460}
        >
          <div className="ds-body" style={{ marginBottom: 'var(--s-5)' }}>
            <strong>{name || flow.name}</strong> will run on {CHANNEL_META[flow.channelType]?.label ?? flow.channelType} whenever
            {' '}{triggerSummary(flow.trigger).toLowerCase()} happens. Anything you have changed on the canvas is saved first.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-2)' }}>
            <button className="btn-secondary" onClick={() => setConfirmPublish(false)}>Not yet</button>
            <button className="btn-primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
              Publish and go live
            </button>
          </div>
        </Drawer>
      )}

      <TestDrawer open={testing} onClose={() => setTesting(false)} flowId={id} />
    </div>
  );
}

function defaultData(type: FlowNodeType): Record<string, any> {
  switch (type) {
    case 'MESSAGE': return { body: '' };
    case 'QUESTION': return { prompt: '', variable: '', validate: 'text' };
    case 'CONDITION': return { variable: '', op: 'eq', value: '' };
    case 'ACTION': return { kind: 'TAG', tag: '' };
    case 'AI': return { prompt: '' };
    case 'DELAY': return { minutes: 60 };
    default: return {};
  }
}

// ============================================================ palette

function Palette({ onAdd, hasTrigger }: { onAdd: (t: FlowNodeType) => void; hasTrigger: boolean }) {
  return (
    <div style={{
      width: 208, flex: 'none', background: 'var(--surface)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-card)', padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-1)',
      alignSelf: 'flex-start',
    }}>
      <div className="ds-caption-upper" style={{ padding: '2px 4px var(--s-2)' }}>Steps</div>
      {PALETTE.map((t) => {
        const meta = NODE_META[t];
        const tone = TONE[meta.tone];
        const disabled = t === 'TRIGGER' && hasTrigger;
        return (
          <button
            key={t}
            type="button"
            draggable={!disabled}
            disabled={disabled}
            title={disabled ? 'This flow already has its trigger' : meta.blurb}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-flow-node', t);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onAdd(t)}
            className="ds-card ds-card-interactive"
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s-2)', padding: '9px 10px',
              textAlign: 'left', font: 'inherit', width: '100%',
              opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'grab',
            }}
          >
            <span className="ds-entity-icon" style={{ color: tone.fg, background: tone.bg, width: 26, height: 26 }}>
              <meta.icon size={14} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{meta.label}</span>
            </span>
          </button>
        );
      })}
      <div className="ds-caption" style={{ marginTop: 'var(--s-2)', lineHeight: 1.45 }}>
        Drag onto the canvas, or click to drop one in the middle.
      </div>
    </div>
  );
}

// ============================================================ node card

function NodeCard({
  node, selected, summary, onDragStart, onLinkStart, linking,
}: {
  node: FlowNode;
  selected: boolean;
  summary: string;
  onDragStart: (e: React.PointerEvent) => void;
  onLinkStart: (e: React.PointerEvent, handle?: string) => void;
  linking: boolean;
}) {
  const meta = NODE_META[node.type];
  const tone = TONE[meta.tone];
  const h = nodeH(node);
  const isCondition = node.type === 'CONDITION';

  return (
    <div
      onPointerDown={onDragStart}
      style={{
        position: 'absolute', left: node.x, top: node.y, width: NODE_W, height: h,
        background: 'var(--surface)', borderRadius: 'var(--r-card)',
        border: `1px solid ${selected ? tone.fg : 'var(--hairline)'}`,
        boxShadow: selected ? 'var(--e-hover)' : 'var(--e-none)',
        padding: 'var(--s-3)', cursor: 'grab', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
        <span className="ds-entity-icon" style={{ color: tone.fg, background: tone.bg, width: 24, height: 24, borderRadius: 7 }}>
          <meta.icon size={13} />
        </span>
        <span style={{
          fontSize: 12.5, fontWeight: 620, color: 'var(--ink)', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{nodeTitle(node)}</span>
      </div>
      <div className="ds-caption" style={{
        marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{summary}</div>

      {/* input port — every node except the trigger can be arrived at */}
      {node.type !== 'TRIGGER' && (
        <span style={{
          position: 'absolute', left: -5, top: h / 2 - 5, width: 10, height: 10, borderRadius: '50%',
          background: linking ? tone.fg : 'var(--surface)', border: `2px solid ${tone.line}`,
        }} />
      )}

      {isCondition ? (
        <>
          <PortHandle label="Yes" top={36} tone={tone} onPointerDown={(e) => onLinkStart(e, 'true')} />
          <PortHandle label="No" top={68} tone={tone} onPointerDown={(e) => onLinkStart(e, 'false')} />
        </>
      ) : (
        <PortHandle top={h / 2} tone={tone} onPointerDown={(e) => onLinkStart(e)} />
      )}
    </div>
  );
}

function PortHandle({
  top, tone, label, onPointerDown,
}: { top: number; tone: { fg: string; bg: string; line: string }; label?: string; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <>
      {label && (
        <span className="ds-caption" style={{
          position: 'absolute', right: -6, top: top - 20, transform: 'translateX(100%)',
          color: tone.fg, fontWeight: 620, whiteSpace: 'nowrap',
        }}>{label}</span>
      )}
      <span
        role="button"
        aria-label={label ? `Connect the ${label} path` : 'Connect to the next step'}
        onPointerDown={onPointerDown}
        style={{
          position: 'absolute', right: -6, top: top - 6, width: 12, height: 12, borderRadius: '50%',
          background: tone.fg, border: '2px solid var(--surface)', cursor: 'crosshair',
        }}
      />
    </>
  );
}

// ============================================================ inspector

function Inspector({
  node, flow, onChange, onDelete,
}: {
  node: FlowNode | null;
  flow: Flow;
  onChange: (patch: Record<string, any>) => void;
  onDelete: () => void;
}) {
  const { data: bots } = useQuery({
    queryKey: ['omni-bots'],
    queryFn: async () => (await omniApi.get<Bot[]>('/bots')).data,
    retry: false,
    enabled: node?.type === 'AI',
  });

  const shell = (children: React.ReactNode) => (
    <div style={{
      width: 312, flex: 'none', alignSelf: 'flex-start', background: 'var(--surface)',
      border: '1px solid var(--hairline)', borderRadius: 'var(--r-card)', padding: 'var(--pad-card)',
    }}>{children}</div>
  );

  if (!node) {
    return shell(
      <EmptyState
        compact
        icon={Waypoints}
        title="Nothing selected"
        body="Click a step on the canvas to edit what it says and does."
      />,
    );
  }

  const meta = NODE_META[node.type];
  const tone = TONE[meta.tone];
  const d = node.data ?? {};
  const listValue = (v: any) => (Array.isArray(v) ? v.join(', ') : v ?? '');
  const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-4)' }}>
        <span className="ds-entity-icon" style={{ color: tone.fg, background: tone.bg }}><meta.icon size={15} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="ds-h3">{meta.label}</div>
          <div className="ds-caption">{meta.blurb}</div>
        </div>
        {node.type !== 'TRIGGER' && (
          <button className="btn-ghost btn-sm" aria-label="Delete this step" onClick={onDelete} style={{ flex: 'none', width: 30, padding: 0 }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <FormSection title="Step">
        <Field label="Label on the canvas" span={2} hint="Just for you — it never gets sent.">
          <input className="input" value={d.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} placeholder={meta.label} />
        </Field>

        {node.type === 'TRIGGER' && (
          <Field label="Starts when" span={2}>
            <div className="ds-inset" style={{ padding: 'var(--s-3)' }}>
              <div className="ds-small">{triggerSummary(flow.trigger)}</div>
              <div className="ds-caption" style={{ marginTop: 4 }}>
                The trigger is set on the flow itself, so every version starts the same way.
              </div>
            </div>
          </Field>
        )}

        {node.type === 'MESSAGE' && (
          <>
            <Field label="Message" required span={2}>
              <textarea
                className="input" rows={4} style={{ resize: 'vertical' }}
                value={d.body ?? ''} onChange={(e) => onChange({ body: e.target.value })}
                placeholder="Hi {{name}} 👋 thanks for reaching out — how can we help?"
              />
            </Field>
            <Field label="Reply buttons" span={2} hint="Up to three, separated by commas. Leave blank for a plain message.">
              <input
                className="input" value={listValue(d.buttons)}
                onChange={(e) => onChange({ buttons: toList(e.target.value) })}
                placeholder="Book a call, See prices"
              />
            </Field>
          </>
        )}

        {node.type === 'QUESTION' && (
          <>
            <Field label="Question" required span={2}>
              <textarea
                className="input" rows={3} style={{ resize: 'vertical' }}
                value={d.prompt ?? ''} onChange={(e) => onChange({ prompt: e.target.value })}
                placeholder="What's your budget?"
              />
            </Field>
            <Field label="Save the answer as" required hint="Use it later as {{budget}}.">
              <input className="input" value={d.variable ?? ''} onChange={(e) => onChange({ variable: e.target.value.replace(/\s+/g, '_') })} placeholder="budget" />
            </Field>
            <Field label="Expect">
              <select className="input" value={d.validate ?? 'text'} onChange={(e) => onChange({ validate: e.target.value })}>
                <option value="text">Any text</option>
                <option value="number">A number</option>
                <option value="email">An email address</option>
                <option value="phone">A phone number</option>
                <option value="choice">One of my choices</option>
              </select>
            </Field>
            {d.validate === 'choice' && (
              <Field label="Choices" span={2} hint="Separated by commas — these become the buttons.">
                <input className="input" value={listValue(d.choices)} onChange={(e) => onChange({ choices: toList(e.target.value) })} placeholder="Under 5k, 5-10k, Over 10k" />
              </Field>
            )}
            <Field label="If the answer doesn’t fit" span={2}>
              <input className="input" value={d.retryPrompt ?? ''} onChange={(e) => onChange({ retryPrompt: e.target.value })} placeholder="Sorry, could you send that again?" />
            </Field>
          </>
        )}

        {node.type === 'CONDITION' && (
          <>
            <Field label="Check the answer" required hint="The name you saved it as.">
              <input className="input" value={d.variable ?? ''} onChange={(e) => onChange({ variable: e.target.value.replace(/\s+/g, '_') })} placeholder="budget" />
            </Field>
            <Field label="Test">
              <select className="input" value={d.op ?? 'eq'} onChange={(e) => onChange({ op: e.target.value })}>
                <option value="eq">is exactly</option>
                <option value="neq">is not</option>
                <option value="contains">contains</option>
                <option value="gt">is more than</option>
                <option value="lt">is less than</option>
                <option value="exists">has any answer</option>
              </select>
            </Field>
            {d.op !== 'exists' && (
              <Field label="Value" span={2}>
                <input className="input" value={d.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="10000" />
              </Field>
            )}
            <Field label="" span={2}>
              <div className="ds-caption">Connect both the Yes and the No handle on the canvas — a branch with a dead end strands people mid-conversation.</div>
            </Field>
          </>
        )}

        {node.type === 'ACTION' && (
          <>
            <Field label="Do what" span={2}>
              <select className="input" value={d.kind ?? 'TAG'} onChange={(e) => onChange({ kind: e.target.value })}>
                <option value="TAG">Tag the contact</option>
                <option value="SET_FIELD">Set a field on the contact</option>
                <option value="CREATE_LEAD">Create a lead in the CRM</option>
                <option value="API_CALL">Call an external URL</option>
              </select>
            </Field>
            {(d.kind ?? 'TAG') === 'TAG' && (
              <Field label="Tag" span={2}>
                <input className="input" value={d.tag ?? ''} onChange={(e) => onChange({ tag: e.target.value })} placeholder="hot-lead" />
              </Field>
            )}
            {d.kind === 'SET_FIELD' && (
              <>
                <Field label="Field"><input className="input" value={d.field ?? ''} onChange={(e) => onChange({ field: e.target.value })} placeholder="source" /></Field>
                <Field label="Value"><input className="input" value={d.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} placeholder="whatsapp-flow" /></Field>
              </>
            )}
            {d.kind === 'CREATE_LEAD' && (
              <Field label="Lead source" span={2} hint="Shows up on the lead record so you know where it came from.">
                <input className="input" value={d.source ?? ''} onChange={(e) => onChange({ source: e.target.value })} placeholder="WhatsApp flow" />
              </Field>
            )}
            {d.kind === 'API_CALL' && (
              <>
                <Field label="Method">
                  <select className="input" value={d.method ?? 'POST'} onChange={(e) => onChange({ method: e.target.value })}>
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                </Field>
                <Field label="URL" span={2}>
                  <input className="input" value={d.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://example.com/hook" />
                </Field>
              </>
            )}
          </>
        )}

        {node.type === 'AI' && (
          <>
            <Field label="Bot" span={2} hint="Its knowledge base and persona answer the question.">
              <select className="input" value={d.botId ?? ''} onChange={(e) => onChange({ botId: e.target.value || undefined })}>
                <option value="">Default assistant</option>
                {(bots ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Extra instruction" span={2} hint="Optional — steers the answer for this step only.">
              <textarea
                className="input" rows={3} style={{ resize: 'vertical' }}
                value={d.prompt ?? ''} onChange={(e) => onChange({ prompt: e.target.value })}
                placeholder="Answer questions about pricing, then offer to book a call."
              />
            </Field>
          </>
        )}

        {node.type === 'HANDOFF' && (
          <Field label="" span={2}>
            <div className="ds-inset" style={{ padding: 'var(--s-3)' }}>
              <div className="ds-small">The conversation moves to the team inbox and the flow stops here.</div>
            </div>
          </Field>
        )}

        {node.type === 'DELAY' && (
          <Field label="Wait" hint="Minutes before the next step runs.">
            <input
              className="input" type="number" min={0}
              value={d.minutes ?? 0} onChange={(e) => onChange({ minutes: Number(e.target.value) })}
            />
          </Field>
        )}
      </FormSection>
    </>,
  );
}

// ============================================================ simulator

interface SimTurn { from: 'CONTACT' | 'FLOW' | 'SYSTEM'; text: string }

/** The runtime is still settling, so accept any sane transcript shape. */
function normalizeTranscript(payload: any): SimTurn[] {
  const raw = Array.isArray(payload) ? payload
    : payload?.transcript ?? payload?.messages ?? payload?.steps ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((m: any): SimTurn => {
    if (typeof m === 'string') return { from: 'FLOW', text: m };
    const text = m?.text ?? m?.body ?? m?.message ?? m?.prompt ?? m?.reply ?? '';
    const dir = String(m?.direction ?? m?.from ?? m?.role ?? m?.author ?? 'FLOW').toUpperCase();
    const from: SimTurn['from'] =
      dir.includes('CONTACT') || dir.includes('USER') || dir.includes('INBOUND') ? 'CONTACT'
        : dir.includes('SYSTEM') || dir.includes('NOTE') || dir.includes('DEBUG') ? 'SYSTEM'
          : 'FLOW';
    return { from, text: String(text) };
  }).filter((t) => t.text.trim());
}

function TestDrawer({ open, onClose, flowId }: { open: boolean; onClose: () => void; flowId: string }) {
  const [text, setText] = useState('hi');
  const [turns, setTurns] = useState<SimTurn[] | null>(null);

  useEffect(() => { if (open) { setTurns(null); setText('hi'); } }, [open]);

  const run = useMutation({
    mutationFn: async () => (await omniApi.post(`/flows/${flowId}/simulate`, { text })).data,
    onSuccess: (d) => {
      const t = normalizeTranscript(d);
      setTurns([{ from: 'CONTACT', text }, ...t]);
      if (!t.length) toast.error('The flow had nothing to say to that.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'The simulator is not available yet'),
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Test this flow"
      subtitle="A dry run — nothing is sent to anybody."
      width={480}
    >
      <FormSection title="Say something">
        <Field label="First message from the contact" span={2}>
          <input
            className="input" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="hi"
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) run.mutate(); }}
          />
        </Field>
      </FormSection>

      <button className="btn-primary" disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}>
        <Play size={14} /> {run.isPending ? 'Running…' : 'Run the flow'}
      </button>

      <div style={{ marginTop: 'var(--s-5)' }}>
        {turns === null && (
          <div className="ds-caption">The transcript will appear here, exactly as the contact would see it.</div>
        )}
        {turns !== null && turns.length === 0 && (
          <EmptyState compact icon={MessageSquare} title="No reply" body="Nothing in this flow matched that message." />
        )}
        {turns !== null && turns.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {turns.map((t, i) => {
              if (t.from === 'SYSTEM') {
                return <div key={i} className="ds-caption" style={{ textAlign: 'center' }}>{t.text}</div>;
              }
              const mine = t.from === 'CONTACT';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '78%', padding: '9px 12px', borderRadius: 14,
                    background: mine ? TONE.active.bg : 'var(--surface-2)',
                    border: `1px solid ${mine ? TONE.active.line : 'var(--hairline-soft)'}`,
                    fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', whiteSpace: 'pre-wrap',
                  }}>{t.text}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
