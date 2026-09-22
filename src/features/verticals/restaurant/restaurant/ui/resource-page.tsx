'use client';

/**
 * The shape almost every Restaurant management screen takes.
 *
 * The Laravel app has an Index/Create/Edit trio per domain — cuisines,
 * kitchens, services, discounts, suppliers, units, floors, zones, customers,
 * users, roles. Fifteen near-identical screens written out longhand would drift
 * from each other within a week, and the differences that matter (which columns,
 * which fields, which endpoint) would be buried in fifteen copies of the same
 * table-and-drawer scaffolding.
 *
 * So the scaffolding lives here and each screen declares only what is actually
 * different. What it deliberately does NOT do is guess: every caller passes its
 * own columns, its own form fields and its own mutations, because the write
 * contracts differ per domain in ways the parity work documented at length —
 * absent-key rules, required flags, and vocabularies that disagree between
 * create and edit on the same screen.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { RestaurantPage } from './page-shell';
import { Card, DataTable, Drawer, EmptyState, Skeleton } from './kit';
import type { DataTableColumn } from './kit';
import { LoadFailed } from './load-state';
import { apiErrorMessage } from '@/lib/api';
import type { Paginated } from '../restaurant-client';

export interface ResourceField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'multiselect' | 'date' | 'time' | 'lines' | 'image';
  options?: { label: string; value: string; group?: string }[];
  required?: boolean;
  /** Shown under the input — use it for a source quirk the user would not guess. */
  hint?: string;
  /**
   * The create contract accepts this key and the update contract rejects it.
   * `forbidNonWhitelisted` turns an echoed key into a 422 rather than ignoring
   * it, so such a field is rendered — and sent — only when creating.
   */
  createOnly?: boolean;
  /**
   * The mirror: only the update contract stores this key. A customer's `email`
   * is the case — `StoreCustomerRequest` has no rule for it, so create accepts
   * the key, discards the value and answers 201, while update stores it. A
   * field shown on create would take an address and lose it silently.
   */
  updateOnly?: boolean;
  /**
   * What a NEW record starts this field at. Without it a checkbox starts unticked
   * and a text field empty, which lies whenever the server applies its own
   * default — menu create forces `is_online_visibility` and `is_menu_status`
   * to true whatever the payload said, so showing them off would be wrong
   * before the user touched anything.
   */
  createDefault?: unknown;
  /**
   * For `type: 'lines'` — the columns of one repeating row. A purchase carries
   * `items: [{ingredient_id, quantity, unit_cost}]`, validated with
   * `@ValidateNested({each:true})`, and there is no way to express that as a
   * flat field.
   */
  lineFields?: { name: string; label: string; type?: 'text' | 'number' | 'select'; options?: { label: string; value: string }[] }[];
  /**
   * Send each line's `id` alongside its declared columns.
   *
   * Opt-in, because the nested contracts disagree: `OptionValueDto` declares
   * `id` and uses it to UPDATE the existing value in place, while
   * `PurchaseItemDto` has no `id` at all and `forbidNonWhitelisted` turns one
   * into a 422. Sending it always would break purchases.
   *
   * Never sending it is worse than it sounds. Measured against the running
   * target: re-submitting an option set's two values WITHOUT their ids left
   * FOUR rows — the values were duplicated, not replaced — so a form missing
   * this flag would double an option set on every save.
   */
  lineKeepId?: boolean;
  /**
   * Sent, never rendered.
   *
   * For a key the write contract needs but the user has no business editing —
   * a menu item's `image_path`, which an absent key CLEARS, and its `options`,
   * which the option writer PRUNES the values of when re-submitted without
   * them. Both must go back exactly as they came, and neither is a control.
   */
  hidden?: boolean;
}

/**
 * A repeating row editor for a nested array field.
 *
 * Deliberately dumb: it adds, edits and removes rows and computes nothing. A
 * purchase's total is recomputed server-side from the lines whatever the client
 * sends — `total` is accepted by the validator and then OVERWRITTEN — so a
 * running total drawn here would be the client's opinion of a number the server
 * owns, and the two would disagree the moment a rounding rule changed.
 */
function LineEditor({
  rows, columns, onChange,
}: {
  rows: Record<string, unknown>[];
  columns: { name: string; label: string; type?: 'text' | 'number' | 'select'; options?: { label: string; value: string }[] }[];
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  const set = (i: number, key: string, value: unknown) =>
    onChange(rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)));

  return (
    <div className="rst-lines">
      {rows.length > 0 && (
        <div className="rst-line rst-line-head">
          {columns.map((c) => <span key={c.name}>{c.label}</span>)}
          <span aria-hidden />
        </div>
      )}
      {rows.map((row, i) => (
        <div className="rst-line" key={i}>
          {columns.map((c) => (c.type === 'select' ? (
            <select
              key={c.name}
              // The column heading names the cell visually, but it is a
              // sibling, not a label — so each control carries its own,
              // including which row it belongs to.
              aria-label={`${c.label}, line ${i + 1}`}
              value={String(row[c.name] ?? '')}
              onChange={(e) => set(i, c.name, e.target.value)}
            >
              <option value="">—</option>
              {(c.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              key={c.name}
              type={c.type === 'number' ? 'number' : 'text'}
              aria-label={`${c.label}, line ${i + 1}`}
              value={String(row[c.name] ?? '')}
              onChange={(e) => set(i, c.name, e.target.value)}
            />
          )))}
          <button
            type="button"
            className="btn-ghost btn-sm rst-danger"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => onChange(rows.filter((_, n) => n !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => onChange([...rows, Object.fromEntries(columns.map((c) => [c.name, '']))])}
      >
        <Plus size={13} /> Add line
      </button>
    </div>
  );
}

export function ResourcePage<T extends { id: string }>({
  title, subtitle, icon, queryKey, load, columns, fields,
  create, update, remove, toggle, toForm, loadOne, canWrite = true, children, emptyTitle,
  singular, omitSelfOption, page, search,
}: {
  title: string;
  /** Drawer titles. Defaults to `title` minus a trailing `s`, which is wrong
   *  for anything that does not pluralise that way — "Branches" became
   *  "Branche". Pass it explicitly when the naive rule does not hold. */
  singular?: string;
  subtitle: string;
  icon: LucideIcon;
  queryKey: string[];
  load: () => Promise<T[]>;
  columns: DataTableColumn<T>[];
  fields: ResourceField[];
  create?: (body: Record<string, unknown>) => Promise<unknown>;
  update?: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
  /**
   * A per-row switch backed by its own endpoint. Cuisines and kitchens each
   * have a `PATCH …/toggle-status` that takes no body, and for cuisines it is
   * the only thing that can change the flag at all.
   */
  toggle?: {
    header?: string;
    value: (row: T) => boolean;
    call: (row: T) => Promise<unknown>;
  };
  /**
   * Select fields whose options must drop the row being edited — a category
   * cannot be its own parent, and the source's edit screen excludes it with
   * `whereKeyNot($category->id)`. Named rather than inferred so `fields` stays
   * a literal array the offline contract gate can read.
   *
   * Note it excludes SELF only, exactly as the source does. A category can
   * still be made a child of its own child; reproducing that is deliberate.
   */
  omitSelfOption?: string[];
  /**
   * Fetch the full row before opening the edit drawer.
   *
   * Several list endpoints carry a summary and the detail lives only on `show`:
   * a menu's index has `menu_items_count` and no items, a purchase's has no
   * lines, and a menu item's has options WITHOUT their values — which matters,
   * because the option writer PRUNES, so re-submitting an option with no values
   * deletes every value it had.
   *
   * Hydrating the whole list instead would be one request per row on every page
   * load. This fetches exactly the row being edited, at the moment it is opened.
   */
  loadOne?: (row: T) => Promise<T>;
  /**
   * For an endpoint that PAGINATES. Four of them do — menu items and orders at
   * ten, customers and cash movements at fifteen — and they ignore `per_page`,
   * so `page` is the only lever there is.
   *
   * A screen that read `data` off a paginator and rendered it showed the first
   * page of any number of rows with nothing on screen to say so: fifteen
   * customers out of two hundred, looking exactly like a restaurant with
   * fifteen customers. Pass this instead of `load` and the pager below is real.
   */
  page?: (n: number) => Promise<Paginated<T>>;
  /**
   * Client-side search, the way every Laravel list screen has one.
   *
   * Only correct when the WHOLE list is in hand, so it is ignored for a
   * paginated source — filtering one page of many and calling it a search is
   * how a row that exists looks like a row that does not.
   */
  search?: { placeholder?: string; match: (row: T, q: string) => boolean };
  /** Row → form values. Defaults to reading each field's name off the row. */
  toForm?: (row: T) => Record<string, unknown>;
  canWrite?: boolean;
  children?: React.ReactNode;
  emptyTitle?: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  /**
   * The detail fetch failed, so the form holds only what the LIST knew.
   *
   * Saving from that state is precisely the data loss `loadOne` exists to
   * prevent — a menu item would go back without its recipe, its taxes and its
   * option values. A warning is not enough when the button next to it still
   * works, so Save is disabled outright until the row can be read.
   */
  const [hydrateFailed, setHydrateFailed] = useState(false);

  const [pageNo, setPageNo] = useState(1);
  const [query, setQuery] = useState('');

  const paged = useQuery({
    queryKey: [...queryKey, 'page', pageNo],
    queryFn: () => page!(pageNo),
    enabled: !!page,
    placeholderData: (prev) => prev,
  });
  const plain = useQuery({ queryKey, queryFn: load, enabled: !page });

  const isLoading = page ? paged.isLoading : plain.isLoading;
  const error = page ? paged.error : plain.error;
  const allRows: T[] = page ? (paged.data?.data ?? []) : (plain.data ?? []);
  const lastPage = paged.data?.last_page ?? 1;
  const total = paged.data?.total;

  // Search is deliberately not applied to a paginated source — see the prop.
  const rows = useMemo(() => {
    if (page || !search || !query.trim()) return allRows;
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => search.match(r, q));
  }, [allRows, page, search, query]);

  const blank = (f: ResourceField) => (f.createDefault !== undefined
    ? f.createDefault
    : f.type === 'checkbox' ? false
    : (f.type === 'multiselect' || f.type === 'lines') ? [] : '');

  const build = (row: T) => (toForm ? toForm(row) : Object.fromEntries(
    fields.map((f) => [f.name, (row as Record<string, unknown>)[f.name] ?? blank(f)])));

  const open = async (row: T | 'new') => {
    setFailure(null);
    setEditing(row);
    if (row === 'new') {
      setHydrateFailed(false);
      setForm(Object.fromEntries(fields.map((f) => [f.name, blank(f)])));
      return;
    }
    // Show what the list already knows first, so the drawer is never blank,
    // then replace it with the detail. A hydration failure leaves the summary
    // on screen and says so rather than opening a form over missing data.
    setForm(build(row));
    setHydrateFailed(false);
    if (!loadOne) return;
    setHydrating(true);
    try {
      setForm(build(await loadOne(row)));
    } catch (e) {
      setHydrateFailed(true);
      setFailure(`${apiErrorMessage(e)} — this ${one.toLowerCase()} could not be read in full, so saving is disabled: what was not read would be discarded. Close and reopen to try again.`);
    } finally {
      setHydrating(false);
    }
  };

  /**
   * AN EMPTY CONTROL SENDS `null`, AND STILL SENDS ITS KEY.
   *
   * This is Laravel's `ConvertEmptyStringsToNull`, which runs as global
   * middleware in the source and makes `""` unreachable by any validator: a
   * blank input arrives as `null`, `nullable` accepts it, and the column is
   * cleared. Nest has no such middleware, so an untranslated `""` reaches
   * `@IsEmail`, `@IsNumber`, `@IsDateString` or `@IsIn` and fails there — a
   * branch whose email was blank could not be saved at all, and a discount
   * whose scope was left on its placeholder came back `Type is invalid.` for a
   * field nobody had touched.
   *
   * Dropping the key instead would be wrong, and the branch contracts prove it:
   * `branch.create.omitting-a-nullable-field-is-a-500` and
   * `branch.update.omitting-is-active-is-a-500` are PARITY scenarios — the
   * source 500s when a nullable key is absent, and accepts the same field sent
   * explicitly as null (`branch.create.explicit-nulls-are-accepted`). So the
   * key goes, carrying null.
   *
   * Required fields are converted too, exactly as the middleware does: a blank
   * one must produce the server's own "is required" message rather than a
   * client-side guess at it.
   *
   * Arrays are untouched — the middleware only rewrites empty strings, so an
   * unpicked multiselect stays `[]`.
   */
  const payload = (mode: 'create' | 'update') => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (mode === 'update' && f.createOnly) continue;
      if (mode === 'create' && f.updateOnly) continue;
      const v = form[f.name];
      if (f.type === 'lines') {
        // Each cell is coerced by its own declared type, the same way a
        // top-level field is — the nested validators are just as strict
        // (`quantity` is `@IsInt`, `unit_cost` is `@IsNumber`).
        out[f.name] = (Array.isArray(v) ? v : []).map((row) => {
          const r = row as Record<string, unknown>;
          const cell: Record<string, unknown> = {};
          if (f.lineKeepId && r.id) cell.id = r.id;
          for (const lf of f.lineFields ?? []) {
            const cv = r[lf.name];
            cell[lf.name] = lf.type === 'number' && cv !== '' && cv != null ? Number(cv) : (cv === '' ? null : cv);
          }
          return cell;
        });
        continue;
      }
      if (v === '') { out[f.name] = null; continue; }
      out[f.name] = f.type === 'number' && v != null ? Number(v) : v;
    }
    return out;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing === 'new') return create?.(payload('create'));
      if (editing) return update?.(editing.id, payload('update'));
      return undefined;
    },
    // The list is refetched rather than patched: the server applies its own
    // defaults and normalisations, and a screen that shows what it SENT rather
    // than what was stored is how a create/edit divergence goes unnoticed.
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      setEditing(null);
    },
    onError: (e) => setFailure(apiErrorMessage(e)),
  });

  const destroy = useMutation({
    mutationFn: async (id: string) => remove?.(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      setEditing(null);
    },
    onError: (e) => setFailure(apiErrorMessage(e)),
  });

  const flip = useMutation({
    mutationFn: async (row: T) => toggle?.call(row),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey }); },
    onError: (e) => setFailure(apiErrorMessage(e)),
  });

  const one = singular ?? title.replace(/s$/, '');
  const writable = canWrite && (create || update || remove);

  // Appended, not merged into the caller's list: the switch is an action, and
  // a screen that also renders a read-only status column would show the same
  // fact twice with only one of them clickable.
  const shownColumns: DataTableColumn<T>[] = toggle && canWrite
    ? [...columns, {
        key: '__toggle',
        header: toggle.header ?? 'Active',
        width: 110,
        render: (row: T) => (
          <button
            type="button"
            role="switch"
            aria-checked={toggle.value(row)}
            aria-label={`Toggle ${one.toLowerCase()} status`}
            className={`rst-switch${toggle.value(row) ? ' is-on' : ''}`}
            disabled={flip.isPending}
            onClick={(e) => { e.stopPropagation(); flip.mutate(row); }}
          >
            <span className="rst-switch-knob" />
          </button>
        ),
      }]
    : columns;

  return (
    <RestaurantPage
      title={title}
      subtitle={subtitle}
      actions={writable && create ? (
        <button className="btn-primary btn-sm" onClick={() => open('new')}>
          <Plus size={14} /> New
        </button>
      ) : undefined}
    >
      {children}

      {search && !page && (
        <div className="rst-listsearch">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={search.placeholder ?? `Search ${title.toLowerCase()}`}
            aria-label={`Search ${title.toLowerCase()}`}
          />
          {query.trim() && (
            <span className="rst-listsearch-count">
              {rows.length} of {allRows.length}
            </span>
          )}
        </div>
      )}

      <Card pad={0}>
        {error ? (
          <LoadFailed what={title.toLowerCase()} />
        ) : isLoading ? (
          <Skeleton rows={5} height={44} />
        ) : (
          <DataTable
            rows={rows}
            columns={shownColumns}
            rowKey={(r) => r.id}
            onRowClick={writable && (update || remove) ? (r) => open(r) : undefined}
            empty={(
              <EmptyState
                icon={icon}
                // "No results" and "none exist" are different facts, and a
                // search that hides everything must not read as an empty table.
                title={query.trim()
                  ? `Nothing matches “${query.trim()}”`
                  : emptyTitle ?? `No ${title.toLowerCase()} yet`}
                compact
              />
            )}
          />
        )}
      </Card>

      {page && lastPage > 1 && (
        <div className="rst-pager">
          <button
            className="btn-ghost btn-sm"
            disabled={pageNo <= 1 || paged.isFetching}
            onClick={() => setPageNo((n) => Math.max(1, n - 1))}
          >
            <ChevronLeft size={14} aria-hidden /> Previous
          </button>
          <span className="rst-pager-at">
            Page {pageNo} of {lastPage}
            {total != null && ` · ${total} in total`}
          </span>
          <button
            className="btn-ghost btn-sm"
            disabled={pageNo >= lastPage || paged.isFetching}
            onClick={() => setPageNo((n) => Math.min(lastPage, n + 1))}
          >
            Next <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      )}

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new'
          ? `New ${one}`
          : `${update ? 'Edit' : 'Delete'} ${one}`}
        actions={(
          <>
            {editing !== 'new' && editing && remove && (
              <button
                className="btn-ghost btn-sm rst-danger"
                disabled={destroy.isPending}
                onClick={() => destroy.mutate(editing.id)}
              >
                {destroy.isPending ? 'Deleting…' : 'Delete'}
              </button>
            )}
            {(editing === 'new' ? create : update) && (
              <button
                className="btn-primary btn-sm"
                disabled={save.isPending || hydrating || hydrateFailed}
                onClick={() => save.mutate()}
              >
                {save.isPending ? 'Saving…' : hydrating ? 'Loading…' : 'Save'}
              </button>
            )}
          </>
        )}
      >
        {/* The server's message, verbatim. Restaurant validation bodies carry
            Laravel's own wording and a rewritten one would be less useful. */}
        {failure && <div className="rst-formerror" role="alert">{failure}</div>}
        {/* A row that can be deleted but not updated gets no form. Rendering
            editable inputs behind a drawer with no Save is an invitation to
            type into something that cannot be stored. */}
        {editing !== 'new' && editing && !update ? (
          <p className="ds-caption">
            This {one.toLowerCase()} cannot be edited — only deleted.
          </p>
        ) : (
        <div className="rst-form">
          {fields.filter((f) => (
            !f.hidden
            && !(f.createOnly && editing !== 'new') && !(f.updateOnly && editing === 'new')
          )).map((raw) => {
            const f = (omitSelfOption?.includes(raw.name) && editing !== 'new' && editing)
              ? { ...raw, options: (raw.options ?? []).filter((o) => o.value !== editing.id) }
              : raw;
            // `multiselect` and `lines` hold MANY controls. A <label> may name
            // exactly one, and nesting a <label> inside another is invalid —
            // which is also one of the things React lists as a hydration
            // mismatch cause. Those render as a group with the caption as a
            // heading; single-control fields stay real labels.
            const many = f.type === 'multiselect' || f.type === 'lines';
            const Wrap = many ? 'div' : 'label';
            return (
            <Wrap
              key={f.name}
              className="rst-field"
              {...(many ? { role: 'group', 'aria-label': f.label } : {})}
            >
              <span className="rst-field-label">
                {f.label}{f.required && <em aria-hidden> *</em>}
              </span>
              {f.type === 'textarea' ? (
                <textarea
                  value={String(form[f.name] ?? '')}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  rows={3}
                />
              ) : f.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={!!form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                />
              ) : f.type === 'lines' ? (
                <LineEditor
                  rows={Array.isArray(form[f.name]) ? (form[f.name] as Record<string, unknown>[]) : []}
                  columns={f.lineFields ?? []}
                  onChange={(next) => setForm({ ...form, [f.name]: next })}
                />
              ) : f.type === 'multiselect' ? (
                // Checkboxes rather than a <select multiple>: these are short,
                // closed vocabularies (seven order types, seven weekdays) and
                // the server rejects the whole array on one bad member, so the
                // user should be able to see every choice at once.
                (() => {
                  const picked = Array.isArray(form[f.name]) ? (form[f.name] as string[]) : [];
                  const toggleOne = (value: string, on: boolean) => setForm({
                    ...form,
                    [f.name]: on ? [...picked, value] : picked.filter((v) => v !== value),
                  });
                  const box = (o: { label: string; value: string }) => (
                    <label key={o.value} className="rst-check">
                      <input
                        type="checkbox"
                        checked={picked.includes(o.value)}
                        onChange={(e) => toggleOne(o.value, e.target.checked)}
                      />
                      <span>{o.label}</span>
                    </label>
                  );
                  const opts = f.options ?? [];
                  // Grouped when the caller says so. A role carries 275
                  // permissions; a flat wrap of 275 checkboxes is a list nobody
                  // can find anything in.
                  if (!opts.some((o) => o.group)) {
                    return <span className="rst-checks">{opts.map(box)}</span>;
                  }
                  const groups = new Map<string, typeof opts>();
                  for (const o of opts) {
                    const g = o.group ?? 'Other';
                    groups.set(g, [...(groups.get(g) ?? []), o]);
                  }
                  return (
                    <span className="rst-checkgroups">
                      {[...groups.entries()].map(([g, list]) => {
                        const all = list.every((o) => picked.includes(o.value));
                        return (
                          <span key={g} className="rst-checkgroup">
                            <span className="rst-checkgroup-head">
                              <strong>{g}</strong>
                              <button
                                type="button"
                                className="btn-ghost btn-sm"
                                onClick={() => setForm({
                                  ...form,
                                  [f.name]: all
                                    ? picked.filter((v) => !list.some((o) => o.value === v))
                                    : [...new Set([...picked, ...list.map((o) => o.value)])],
                                })}
                              >
                                {all ? 'None' : 'All'}
                              </button>
                            </span>
                            <span className="rst-checks">{list.map(box)}</span>
                          </span>
                        );
                      })}
                    </span>
                  );
                })()
              ) : f.type === 'image' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="https://... or choose file below"
                      value={String(form[f.name] ?? '')}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <label className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0, whiteSpace: 'nowrap' }}>
                      <span>Choose file</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setForm({ ...form, [f.name]: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {form[f.name] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <img
                        src={String(form[f.name])}
                        alt="Preview"
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border, #e5e7eb)', background: '#f9fafb' }}
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <button
                        type="button"
                        className="btn-ghost btn-sm rst-danger"
                        onClick={() => setForm({ ...form, [f.name]: '' })}
                      >
                        Remove image
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : f.type === 'select' ? (
                <select
                  value={String(form[f.name] ?? '')}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number'
                    : f.type === 'date' ? 'date'
                    : f.type === 'time' ? 'time' : 'text'}
                  value={String(form[f.name] ?? '')}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
              {f.hint && <span className="rst-field-hint">{f.hint}</span>}
            </Wrap>
            );
          })}
        </div>
        )}
      </Drawer>
    </RestaurantPage>
  );
}
