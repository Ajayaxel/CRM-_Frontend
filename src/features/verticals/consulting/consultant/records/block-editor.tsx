'use client';

/**
 * Block editor for documents.
 *
 * Notion-shaped: every paragraph, heading, list item and code fence is its own
 * block with a drag handle and a block menu, `/` opens a type picker, and
 * markdown prefixes (`# `, `- `, `1. `, `[] `, `> `) convert as you type.
 *
 * It serialises to and from **HTML** deliberately, because the API already
 * stores and sanitises an HTML body — this closes the editor gap without
 * touching the backend or migrating a single row. `blocksToHtml` and
 * `htmlToBlocks` are inverses; anything the parser does not recognise degrades
 * to a paragraph rather than being dropped.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronDown, Code2, Copy, GripVertical, Heading1, Heading2, Heading3,
  List, ListOrdered, Minus, Plus, Quote, Trash2, Type,
} from 'lucide-react';
import { Menu, OptionList, Popover } from '../ui/primitives';

export type BlockType =
  | 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'todo' | 'quote' | 'code' | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  html: string;
  checked?: boolean;
}

let seq = 0;
const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export const BLOCK_TYPES: { type: BlockType; label: string; hint: string; icon: React.ReactNode }[] = [
  { type: 'p', label: 'Text', hint: 'Plain paragraph', icon: <Type size={14} /> },
  { type: 'h1', label: 'Heading 1', hint: '# ', icon: <Heading1 size={14} /> },
  { type: 'h2', label: 'Heading 2', hint: '## ', icon: <Heading2 size={14} /> },
  { type: 'h3', label: 'Heading 3', hint: '### ', icon: <Heading3 size={14} /> },
  { type: 'bullet', label: 'Bulleted list', hint: '- ', icon: <List size={14} /> },
  { type: 'number', label: 'Numbered list', hint: '1. ', icon: <ListOrdered size={14} /> },
  { type: 'todo', label: 'To-do', hint: '[] ', icon: <Check size={14} /> },
  { type: 'quote', label: 'Quote', hint: '> ', icon: <Quote size={14} /> },
  { type: 'code', label: 'Code', hint: '```', icon: <Code2 size={14} /> },
  { type: 'divider', label: 'Divider', hint: '---', icon: <Minus size={14} /> },
];

// ============================================================ Serialisation

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Blocks → HTML. Consecutive list items collapse into one <ul>/<ol> so the
 * output is ordinary, portable markup rather than a wrapper per row.
 */
export function blocksToHtml(blocks: Block[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'bullet' || b.type === 'todo') {
      const isTodo = b.type === 'todo';
      const items: string[] = [];
      while (i < blocks.length && blocks[i].type === b.type) {
        const cur = blocks[i];
        items.push(isTodo
          ? `<li data-checked="${cur.checked ? 'true' : 'false'}">${cur.html}</li>`
          : `<li>${cur.html}</li>`);
        i++;
      }
      out.push(`<ul${isTodo ? ' data-type="todo"' : ''}>${items.join('')}</ul>`);
      continue;
    }
    if (b.type === 'number') {
      const items: string[] = [];
      while (i < blocks.length && blocks[i].type === 'number') {
        items.push(`<li>${blocks[i].html}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    switch (b.type) {
      case 'h1': out.push(`<h2>${b.html}</h2>`); break;
      case 'h2': out.push(`<h3>${b.html}</h3>`); break;
      case 'h3': out.push(`<h4>${b.html}</h4>`); break;
      case 'quote': out.push(`<blockquote>${b.html}</blockquote>`); break;
      case 'code': out.push(`<pre><code>${b.html}</code></pre>`); break;
      case 'divider': out.push('<hr>'); break;
      default: out.push(`<p>${b.html || '<br>'}</p>`);
    }
    i++;
  }
  return out.join('\n');
}

/**
 * Defence in depth.
 *
 * The server allow-lists document bodies, so this should never find anything.
 * It runs anyway because every block is written back with innerHTML: if the
 * server sanitiser ever regresses, this keeps the regression from becoming an
 * executing script in someone's browser.
 */
function scrubNode(root: HTMLElement) {
  root.querySelectorAll('script, style, iframe, object, embed, svg, form, base, meta, link').forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if (name === 'href' || name === 'src') {
        const v = attr.value.replace(/[\u0000-\u0020]/g, '').toLowerCase();
        const scheme = v.match(/^([a-z][a-z0-9+.-]*):/);
        if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme[1])) el.removeAttribute(attr.name);
      }
    }
  });
}

/** HTML → blocks. Unknown elements become paragraphs so nothing is silently lost. */
export function htmlToBlocks(html: string): Block[] {
  if (typeof document === 'undefined') return [{ id: newId(), type: 'p', html: '' }];
  const root = document.createElement('div');
  root.innerHTML = html ?? '';
  scrubNode(root);
  const blocks: Block[] = [];

  const push = (type: BlockType, inner: string, checked?: boolean) =>
    blocks.push({ id: newId(), type, html: inner.trim(), checked });

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? '').trim();
      if (t) push('p', esc(t));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    switch (el.tagName.toLowerCase()) {
      case 'h1': case 'h2': push('h1', el.innerHTML); break;
      case 'h3': push('h2', el.innerHTML); break;
      case 'h4': case 'h5': case 'h6': push('h3', el.innerHTML); break;
      case 'blockquote': push('quote', el.innerHTML); break;
      case 'pre': push('code', (el.querySelector('code') ?? el).innerHTML); break;
      case 'hr': push('divider', ''); break;
      case 'ul': {
        const todo = el.getAttribute('data-type') === 'todo';
        el.querySelectorAll(':scope > li').forEach((li) => {
          push(todo ? 'todo' : 'bullet', (li as HTMLElement).innerHTML, todo ? li.getAttribute('data-checked') === 'true' : undefined);
        });
        break;
      }
      case 'ol':
        el.querySelectorAll(':scope > li').forEach((li) => push('number', (li as HTMLElement).innerHTML));
        break;
      case 'p': {
        const inner = el.innerHTML.replace(/^<br\s*\/?>$/i, '');
        push('p', inner);
        break;
      }
      default:
        push('p', el.innerHTML);
    }
  });

  if (!blocks.length) blocks.push({ id: newId(), type: 'p', html: '' });
  return blocks;
}

// ============================================================ Editor

export function BlockEditor({
  value, onChange, editable = true, placeholder = 'Write, or press / for blocks…',
}: {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => htmlToBlocks(value));
  const [focus, setFocus] = useState<{ id: string; at: 'start' | 'end' } | null>(null);
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Reload only when the document identity changes underneath us. Re-parsing on
  // every keystroke would fight the caret.
  const loaded = useRef(value);
  useEffect(() => {
    if (value !== loaded.current && document.activeElement?.closest('.cw-be') == null) {
      loaded.current = value;
      setBlocks(htmlToBlocks(value));
    }
  }, [value]);

  /**
   * Every mutation funnels through here.
   *
   * Deliberately NOT a functional `setBlocks(bs => …)`: React runs updater
   * functions during render, and notifying the parent from inside one is a
   * setState-during-render — which React warns about and which silently threw
   * away keystrokes here. Mutations only ever happen in event handlers, so
   * reading the latest list from a ref is both correct and simpler.
   */
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const apply = useCallback((next: Block[], focusNext?: { id: string; at: 'start' | 'end' }) => {
    blocksRef.current = next;
    setBlocks(next);
    if (focusNext) setFocus(focusNext);
    const html = blocksToHtml(next);
    loaded.current = html;
    onChange(html);
  }, [onChange]);

  const update = useCallback((id: string, patch: Partial<Block>) => {
    apply(blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, [apply]);

  const insertAfter = useCallback((id: string, block: Partial<Block> = {}) => {
    const bs = blocksRef.current;
    const i = bs.findIndex((b) => b.id === id);
    const created: Block = { id: newId(), type: 'p', html: '', ...block };
    apply([...bs.slice(0, i + 1), created, ...bs.slice(i + 1)], { id: created.id, at: 'start' });
  }, [apply]);

  const removeBlock = useCallback((id: string) => {
    const bs = blocksRef.current;
    if (bs.length === 1) return;
    const i = bs.findIndex((b) => b.id === id);
    const next = bs.filter((b) => b.id !== id);
    const prev = next[Math.max(0, i - 1)];
    apply(next, prev ? { id: prev.id, at: 'end' } : undefined);
  }, [apply]);

  const move = useCallback((from: string, to: string) => {
    if (from === to) return;
    const bs = blocksRef.current;
    const a = bs.findIndex((b) => b.id === from);
    const bIdx = bs.findIndex((b) => b.id === to);
    if (a < 0 || bIdx < 0) return;
    const next = [...bs];
    const [moved] = next.splice(a, 1);
    next.splice(bIdx, 0, moved);
    apply(next);
  }, [apply]);

  // Numbering is positional, so it has to be derived at render rather than
  // stored — deleting item 2 must renumber 3 into 2.
  const numbering = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const b of blocks) {
      if (b.type === 'number') { n += 1; map.set(b.id, n); } else n = 0;
    }
    return map;
  }, [blocks]);

  return (
    <div className="cw-be">
      {blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          index={i}
          number={numbering.get(b.id)}
          editable={editable}
          placeholder={i === 0 && blocks.length === 1 ? placeholder : undefined}
          focus={focus?.id === b.id ? focus.at : null}
          onFocused={() => setFocus(null)}
          slashOpen={slashFor === b.id}
          onSlash={(open) => setSlashFor(open ? b.id : null)}
          dragging={dragId === b.id}
          over={overId === b.id}
          onDragStart={() => setDragId(b.id)}
          onDragOver={() => setOverId(b.id)}
          onDrop={() => { if (dragId) move(dragId, b.id); setDragId(null); setOverId(null); }}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          onChangeHtml={(html) => update(b.id, { html })}
          // Only the type changes here. Re-sending `b.html` would replay the
          // closure's stale copy and undo an edit that just landed — which is
          // how the "/code" token survived being stripped before conversion.
          onChangeType={(type) => update(b.id, type === 'divider' ? { type, html: '' } : { type })}
          onToggleCheck={() => update(b.id, { checked: !b.checked })}
          onEnter={(rest) => insertAfter(b.id, { type: continuationOf(b.type), html: rest })}
          onBackspaceEmpty={() => removeBlock(b.id)}
          onDuplicate={() => insertAfter(b.id, { type: b.type, html: b.html, checked: b.checked })}
          onDelete={() => removeBlock(b.id)}
          onFocusPrev={() => { const p = blocks[i - 1]; if (p) setFocus({ id: p.id, at: 'end' }); }}
          onFocusNext={() => { const n = blocks[i + 1]; if (n) setFocus({ id: n.id, at: 'start' }); }}
        />
      ))}

      {editable && (
        <button
          type="button"
          className="cw-be-add"
          onClick={() => insertAfter(blocks[blocks.length - 1].id)}
        >
          <Plus size={13} /> Add a block
        </button>
      )}
    </div>
  );
}

/** Pressing Enter inside a list continues the list; everywhere else drops to text. */
function continuationOf(type: BlockType): BlockType {
  return type === 'bullet' || type === 'number' || type === 'todo' ? type : 'p';
}

// ============================================================ Row

function BlockRow({
  block, index, number, editable, placeholder, focus, onFocused, slashOpen, onSlash,
  dragging, over, onDragStart, onDragOver, onDrop, onDragEnd,
  onChangeHtml, onChangeType, onToggleCheck, onEnter, onBackspaceEmpty,
  onDuplicate, onDelete, onFocusPrev, onFocusNext,
}: {
  block: Block;
  index: number;
  number?: number;
  editable: boolean;
  placeholder?: string;
  focus: 'start' | 'end' | null;
  onFocused: () => void;
  slashOpen: boolean;
  onSlash: (open: boolean) => void;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onChangeHtml: (html: string) => void;
  onChangeType: (t: BlockType) => void;
  onToggleCheck: () => void;
  onEnter: (rest: string) => void;
  onBackspaceEmpty: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocusPrev: () => void;
  onFocusNext: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [slashQuery, setSlashQuery] = useState('');

  // Write into the DOM only when the incoming HTML differs from what is already
  // there, so typing never re-renders the node the caret lives in.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== block.html) el.innerHTML = block.html;
  }, [block.html, block.type]);

  useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(focus === 'start');
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    onFocused();
  }, [focus, onFocused]);

  if (block.type === 'divider') {
    return (
      <BlockFrame
        editable={editable} dragging={dragging} over={over}
        onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
        onChangeType={onChangeType} onDuplicate={onDuplicate} onDelete={onDelete}
      >
        <div style={{ padding: '9px 0' }}><div className="cw-sep" /></div>
      </BlockFrame>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = e.currentTarget;

    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      // Split at the caret: what is after it moves into the new block.
      const sel = window.getSelection();
      let rest = '';
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const after = range.cloneRange();
        after.selectNodeContents(el);
        after.setStart(range.endContainer, range.endOffset);
        const frag = after.extractContents();
        const tmp = document.createElement('div');
        tmp.appendChild(frag);
        rest = tmp.innerHTML;
      }
      onChangeHtml(el.innerHTML);
      // An empty list item on Enter exits the list instead of adding another.
      if (!el.textContent?.trim() && ['bullet', 'number', 'todo'].includes(block.type)) {
        onChangeType('p');
        return;
      }
      onEnter(rest);
      return;
    }

    if (e.key === 'Backspace') {
      const empty = !el.textContent?.length;
      if (empty) {
        e.preventDefault();
        if (block.type !== 'p') { onChangeType('p'); return; }
        onBackspaceEmpty();
        return;
      }
      if (atStart(el) && block.type !== 'p') { e.preventDefault(); onChangeType('p'); }
      return;
    }

    if (e.key === 'ArrowUp' && atStart(el)) { e.preventDefault(); onFocusPrev(); return; }
    if (e.key === 'ArrowDown' && atEnd(el)) { e.preventDefault(); onFocusNext(); return; }

    if (e.key === 'Escape' && slashOpen) { onSlash(false); return; }

    // Inline formatting inside a block.
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : e.key.toLowerCase() === 'i' ? 'italic' : 'underline');
      onChangeHtml(el.innerHTML);
    }
  };

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const text = el.textContent ?? '';

    // Markdown prefixes convert the block and swallow the prefix.
    const shortcut = MARKDOWN.find((m) => text.startsWith(m.prefix));
    if (shortcut && block.type !== 'code') {
      el.innerHTML = text.slice(shortcut.prefix.length);
      onChangeType(shortcut.type);
      onChangeHtml(el.innerHTML);
      placeCaretAtEnd(el);
      return;
    }

    // A slash command is a trailing "/word" token at a word boundary, not a
    // block whose entire text is "/" — people type it mid-sentence too.
    const slash = text.match(SLASH_TOKEN);
    if (slash) { setSlashQuery(slash[1]); onSlash(true); }
    else if (slashOpen) onSlash(false);

    onChangeHtml(el.innerHTML);
  };

  const Tag = TAG_FOR[block.type];

  return (
    <BlockFrame
      editable={editable} dragging={dragging} over={over}
      onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      onChangeType={onChangeType} onDuplicate={onDuplicate} onDelete={onDelete}
      slash={slashOpen ? (
        <SlashMenu
          query={slashQuery}
          onPick={(t) => {
            // Remove the "/query" the user typed, then convert the block.
            const el = ref.current;
            if (el) {
              el.textContent = (el.textContent ?? '').replace(SLASH_TOKEN, '').trimEnd();
              onChangeHtml(el.innerHTML);
            }
            onChangeType(t);
            onSlash(false);
            setSlashQuery('');
          }}
          onClose={() => onSlash(false)}
        />
      ) : undefined}
      marker={
        block.type === 'bullet' ? <span className="cw-be-dot">•</span>
          : block.type === 'number' ? <span className="cw-be-index">{number}.</span>
            : block.type === 'todo' ? (
              <input
                type="checkbox"
                checked={Boolean(block.checked)}
                disabled={!editable}
                onChange={onToggleCheck}
                aria-label="Toggle to-do"
                className="cw-be-check"
              />
            ) : null
      }
    >
      <Tag
        ref={ref as any}
        className={`cw-be-block cw-be-${block.type}`}
        contentEditable={editable}
        suppressContentEditableWarning
        data-placeholder={placeholder ?? PLACEHOLDER[block.type]}
        data-checked={block.type === 'todo' && block.checked ? 'true' : undefined}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onBlur={(e: React.FocusEvent<HTMLDivElement>) => onChangeHtml(e.currentTarget.innerHTML)}
      />
    </BlockFrame>
  );
}

/** Hover rail: drag handle, insert button and the block menu. */
function BlockFrame({
  editable, dragging, over, marker, children, slash,
  onDragStart, onDragOver, onDrop, onDragEnd, onChangeType, onDuplicate, onDelete,
}: {
  editable: boolean;
  dragging: boolean;
  over: boolean;
  marker?: React.ReactNode;
  children: React.ReactNode;
  /** The block menu, rendered by the row so it can reach the caret. */
  slash?: React.ReactNode;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onChangeType: (t: BlockType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="cw-be-row"
      data-dragging={dragging}
      data-over={over}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      {editable && (
        <div className="cw-be-rail" contentEditable={false}>
          <Menu
            align="start"
            width={210}
            trigger={({ ref, onClick }) => (
              <button
                type="button"
                ref={ref as any}
                className="cw-be-handle"
                aria-label="Block options"
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
                onDragEnd={onDragEnd}
                onClick={onClick}
              ><GripVertical size={13} /></button>
            )}
            items={[
              ...BLOCK_TYPES.map((t) => ({
                label: `Turn into ${t.label.toLowerCase()}`,
                icon: t.icon,
                onSelect: () => onChangeType(t.type),
              })),
              'separator' as const,
              { label: 'Duplicate', icon: <Copy size={14} />, onSelect: onDuplicate },
              { label: 'Delete', icon: <Trash2 size={14} />, onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      )}

      <div className="cw-be-content">
        {marker && <span className="cw-be-marker" contentEditable={false}>{marker}</span>}
        <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
          {children}
          {slash}
        </div>
      </div>
    </div>
  );
}

function SlashMenu({ query, onPick, onClose }: { query: string; onPick: (t: BlockType) => void; onClose: () => void }) {
  const [cursor, setCursor] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BLOCK_TYPES;
    return BLOCK_TYPES.filter((t) => t.label.toLowerCase().includes(q) || t.type.includes(q));
  }, [query]);

  useEffect(() => { setCursor(0); }, [query]);

  // The menu is driven from the block's own keystrokes, so it listens rather
  // than stealing focus — typing keeps flowing into the block behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
      // Consume the key outright. This listener is capture-phase on document,
      // above React's root, so stopping propagation here keeps the block's own
      // Enter handler from ALSO splitting the block and leaving a stray
      // paragraph behind the converted one.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, matches.length - 1));
      if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0));
      if (e.key === 'Enter' && matches[cursor]) onPick(matches[cursor].type);
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [cursor, matches, onPick, onClose]);

  if (!matches.length) return null;

  return (
    <div className="cw-be-slash">
      <div className="cw-pop-label">Blocks</div>
      {matches.map((t, i) => (
        <button
          key={t.type}
          type="button"
          className="cw-opt"
          data-active={i === cursor}
          onMouseEnter={() => setCursor(i)}
          onMouseDown={(e) => { e.preventDefault(); onPick(t.type); }}
        >
          <span style={{ color: 'var(--cw-ink-3)', display: 'inline-flex' }}>{t.icon}</span>
          <span style={{ flex: 1 }}>{t.label}</span>
          <span className="cw-opt-hint">{t.hint}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================ Helpers

const TAG_FOR: Record<BlockType, any> = {
  p: 'div', h1: 'div', h2: 'div', h3: 'div',
  bullet: 'div', number: 'div', todo: 'div',
  quote: 'div', code: 'div', divider: 'div',
};

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  p: '',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  quote: 'Quote',
  code: 'Code',
};

/** A trailing "/word" at a word boundary — what opens the block menu. */
const SLASH_TOKEN = /(?:^|\s)\/([A-Za-z]*)$/;

const MARKDOWN: { prefix: string; type: BlockType }[] = [
  { prefix: '### ', type: 'h3' },
  { prefix: '## ', type: 'h2' },
  { prefix: '# ', type: 'h1' },
  { prefix: '- ', type: 'bullet' },
  { prefix: '* ', type: 'bullet' },
  { prefix: '1. ', type: 'number' },
  { prefix: '[] ', type: 'todo' },
  { prefix: '[ ] ', type: 'todo' },
  { prefix: '> ', type: 'quote' },
  { prefix: '```', type: 'code' },
  { prefix: '---', type: 'divider' },
];

function atStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  return r.toString().length === 0;
}

function atEnd(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return r.toString().length === 0;
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
