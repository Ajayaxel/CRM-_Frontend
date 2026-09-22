'use client';

/**
 * POS sessions — `Pos/Sessions`.
 *
 * The operationally load-bearing half of this screen is OPENING a drawer.
 * Both order-writing endpoints require a `session_id`, and the till screen
 * refuses to build a cart without one — correctly, since the write could not
 * succeed. Until now nothing in the console could open a session, so that
 * refusal was a dead end: the only way to start service was to POST by hand.
 *
 * CLOSING IS NOT OFFERED, and that is not an omission. `PUT /pos/sessions/{id}`
 * is unreachable in the source — RST-PARITY-018: the route-model binder
 * resolves `PosSession` on the CENTRAL connection before the controller runs
 * and dies on a table that does not exist there, so the client sees
 * `{"message":"Server Error"}` and nothing is written. The port reproduces the
 * 500 deliberately. A Close button here could only ever fail, so the screen
 * says what is true instead: a session opened on either system stays open, no
 * declared cash is ever recorded, and no variance is ever computed. That is
 * also why `branches.cash_difference_threshold` is read by nothing.
 *
 * The register select depends on the chosen branch — `GET /pos/registers`
 * refuses without a `branch_id` — so it is a bespoke screen rather than a
 * `ResourcePage`, whose field list cannot see the form's own state.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wallet, Plus } from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, DataTable, Drawer, EmptyState, Skeleton, Status } from '../ui/kit';
import type { DataTableColumn } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import { posAdmin, pos, branches } from '../restaurant-client';
import type { RstSessionRow } from '../restaurant-client';
import { rstPrice } from '../ui/totals';

interface RegisterOption { id: string; name?: string | null }

export function RestaurantSessions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [registerId, setRegisterId] = useState('');
  const [float, setFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['rst', 'sessions', 'admin'],
    queryFn: () => posAdmin.sessions(),
  });

  const { data: branchList = [] } = useQuery({
    queryKey: ['rst', 'branches'],
    queryFn: () => branches.list(),
  });

  // Only asked for once a branch is chosen, because the endpoint requires it.
  const { data: registers = [] } = useQuery({
    queryKey: ['rst', 'pos', 'registers', branchId],
    queryFn: () => pos.registerOptions(branchId) as Promise<RegisterOption[]>,
    enabled: !!branchId,
  });

  const openSession = useMutation({
    mutationFn: () => pos.openSession({
      branch_id: branchId,
      pos_register_id: registerId,
      // `@IsNumber` — a blank field must reach the server as the number it is
      // not, so the server's own "must be a number" message is what shows.
      opening_float: float === '' ? null : Number(float),
      notes: notes === '' ? null : notes,
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['rst', 'sessions', 'admin'] });
      setOpen(false);
      setBranchId(''); setRegisterId(''); setFloat(''); setNotes('');
      toast.success('Session opened.');
    },
    onError: (e) => setFailure(apiErrorMessage(e)),
  });

  const columns: DataTableColumn<RstSessionRow>[] = [
    { key: 'counter', header: 'Counter', render: (s) => s.counter || '—' },
    { key: 'branch', header: 'Branch', render: (s) => s.branch || '—' },
    { key: 'opened_by', header: 'Opened by', render: (s) => s.opened_by || '—' },
    { key: 'opened', header: 'Opened', width: 180, render: (s) => s.opened_at || '—' },
    { key: 'float', header: 'Float', align: 'right', width: 110, render: (s) => rstPrice(s.opening_float) },
    {
      key: 'status', header: 'Status', width: 120,
      render: (s) => (
        <Status tone={(s.status ?? '').toLowerCase().startsWith('open') ? 'active' : 'neutral'}>
          {s.status ?? '—'}
        </Status>
      ),
    },
  ];

  return (
    <RestaurantPage
      title="Sessions"
      subtitle="Who opened a drawer, when, and with how much in it."
      actions={(
        <button className="btn-primary btn-sm" onClick={() => { setFailure(null); setOpen(true); }}>
          <Plus size={14} /> Open session
        </button>
      )}
    >
      <Card pad={0}>
        {error ? (
          <LoadFailed what="sessions" />
        ) : isLoading ? (
          <Skeleton rows={5} height={44} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            empty={<EmptyState icon={Wallet} title="No sessions yet" compact />}
          />
        )}
      </Card>

      <p className="ds-caption rst-footnote">
        A session cannot be closed from here, or anywhere else. The close route is unreachable on
        both systems — the model binder resolves it against the wrong database and answers
        &ldquo;Server Error&rdquo; without writing (RST-PARITY-018) — so declared cash is never
        recorded, a session stays open indefinitely, and no cash variance is calculated anywhere.
        The blanks in the closed columns are the source&rsquo;s own empty strings, not a failed
        lookup here.
      </p>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Open session"
        actions={(
          <button
            className="btn-primary btn-sm"
            disabled={openSession.isPending}
            onClick={() => openSession.mutate()}
          >
            {openSession.isPending ? 'Opening…' : 'Open'}
          </button>
        )}
      >
        {failure && <div className="rst-formerror" role="alert">{failure}</div>}
        <div className="rst-form">
          <label className="rst-field">
            <span className="rst-field-label">Branch<em aria-hidden> *</em></span>
            <select
              value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setRegisterId(''); }}
            >
              <option value="">—</option>
              {branchList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>

          <label className="rst-field">
            <span className="rst-field-label">Register<em aria-hidden> *</em></span>
            <select
              value={registerId}
              onChange={(e) => setRegisterId(e.target.value)}
              disabled={!branchId}
            >
              <option value="">{branchId ? '—' : 'Choose a branch first'}</option>
              {registers.map((r) => <option key={r.id} value={r.id}>{r.name ?? r.id}</option>)}
            </select>
            <span className="rst-field-hint">
              The register list is per branch — `GET /pos/registers` refuses without one.
            </span>
          </label>

          <label className="rst-field">
            <span className="rst-field-label">Opening float<em aria-hidden> *</em></span>
            <input type="number" value={float} onChange={(e) => setFloat(e.target.value)} />
            <span className="rst-field-hint">What is in the drawer before the first sale.</span>
          </label>

          <label className="rst-field">
            <span className="rst-field-label">Notes</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </Drawer>
    </RestaurantPage>
  );
}
