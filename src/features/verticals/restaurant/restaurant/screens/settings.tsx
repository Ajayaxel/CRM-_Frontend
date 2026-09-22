'use client';

/**
 * Settings — Figma 148:411, 148:927, 148:1231, 148:1641, 148:2066, 148:2652,
 * 148:3160 and 179:3463, each with a dark twin.
 *
 * The frames draw eight sub-pages behind one left rail. Five have a real API
 * behind them and three do not, and this screen does not pretend otherwise:
 *
 *   General               POST /restaurant/settings/general          ✓
 *   Billing & receipt     POST /restaurant/settings/billing          ✓
 *   Users & roles         /restaurant/users, /restaurant/roles       ✓
 *   Tables & rooms        /restaurant/seating-plan/*                 ✓
 *   Payments              GET /restaurant/settings/get-payments      ✓ read-only
 *   Integrations & devices  RstDevice exists; NO service, NO routes  ✗
 *   Security & backup       no model, no routes                      ✗
 *   Online ordering         RstPlatformConfig exists; no routes       ✗
 *
 * A settings form that accepts input and quietly discards it is worse than an
 * absent one — the user believes the setting took effect. The three unbacked
 * sections therefore render what is missing and what building it would need,
 * rather than a disabled-looking form.
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Armchair, CreditCard, HardDrive, Plug, Receipt, Settings2, ShieldCheck, Truck, Users,
} from 'lucide-react';
import { RestaurantPage } from '../ui/page-shell';
import { Card, EmptyState, Field, Skeleton, Status } from '../ui/kit';
import { LoadFailed } from '../ui/load-state';
import { apiErrorMessage } from '@/lib/api';
import { people, seating, settings as settingsApi } from '../restaurant-client';

type SectionKey =
  | 'general' | 'billing' | 'people' | 'payments'
  | 'tables' | 'devices' | 'security' | 'online';

const SECTIONS: { key: SectionKey; label: string; icon: any; backed: boolean }[] = [
  { key: 'general', label: 'General settings', icon: Settings2, backed: true },
  { key: 'billing', label: 'Billing & receipt', icon: Receipt, backed: true },
  { key: 'people', label: 'User & role management', icon: Users, backed: true },
  { key: 'payments', label: 'Payment settings', icon: CreditCard, backed: true },
  { key: 'tables', label: 'Table & room configuration', icon: Armchair, backed: true },
  { key: 'devices', label: 'Integrations & devices', icon: Plug, backed: false },
  { key: 'security', label: 'Security & backup', icon: ShieldCheck, backed: false },
  { key: 'online', label: 'Online ordering & delivery', icon: Truck, backed: false },
];

export function RestaurantSettings() {
  const [section, setSection] = useState<SectionKey>('general');

  return (
    <RestaurantPage title="Settings" subtitle="How this restaurant bills, seats and staffs itself.">
      <div className="rst-settings">
        <nav className="rst-settings-nav" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              className={`rst-settings-tab${section === s.key ? ' is-on' : ''}`}
              onClick={() => setSection(s.key)}
              aria-current={section === s.key}
            >
              <s.icon size={15} aria-hidden />
              <span>{s.label}</span>
              {!s.backed && <em title="No API behind this yet">•</em>}
            </button>
          ))}
        </nav>

        <div className="rst-settings-body">
          {section === 'general' && <GeneralSection />}
          {section === 'billing' && <BillingSection />}
          {section === 'people' && <PeopleSection />}
          {section === 'payments' && <PaymentsSection />}
          {section === 'tables' && <TablesSection />}
          {section === 'devices' && (
            <NotWired
              icon={Plug}
              title="Integrations & devices"
              has="An RstDevice table exists — printers, KDS displays and scanners can be stored."
              missing="No service and no controller read or write it, so there is nothing to call."
              needs={['A devices module (list, pair, test-connection)', 'A third-party integrations model — the designs show accounting, delivery and stock systems, none of which is modelled']}
            />
          )}
          {section === 'security' && (
            <NotWired
              icon={ShieldCheck}
              title="Security & backup"
              has="Platform-level auth already covers login, sessions and roles."
              missing="Nothing restaurant-specific exists: no PIN-login model, no per-tenant session policy, no backup schedule or restore path."
              needs={['A PIN credential on the restaurant user', 'Session policy fields (auto-logout, max attempts)', 'A backup runner — the designs show schedule, retention, last-run status and a restore wizard']}
            />
          )}
          {section === 'online' && (
            <NotWired
              icon={HardDrive}
              title="Online ordering & delivery"
              has="RstPlatformConfig and RstDeliveryOrder exist as tables."
              missing="Neither has a service or controller, so aggregator credentials cannot be stored or read, and the KDS cannot tell you which partner a ticket came from."
              needs={['A platform-config module (connect, disconnect, per-partner keys)', 'A channel field on the KDS query — see the note on the Online orders board']}
            />
          )}
        </div>
      </div>
    </RestaurantPage>
  );
}

/* ── General ─────────────────────────────────────────────────────────────── */

function GeneralSection() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['rst', 'settings'], queryFn: () => settingsApi.get() });
  const s = (data ?? {}) as Record<string, any>;

  const [form, setForm] = useState<Record<string, string>>({});
  const val = (k: string) => form[k] ?? (s[k] ?? '') as string;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => settingsApi.updateGeneral({
      business_name: val('business_name'),
      address: val('address'),
      phone: val('phone'),
      email: val('email'),
      // These four are REQUIRED by the DTO — sending a blank would 422.
      currency: val('currency') || 'INR',
      language: val('language') || 'en',
      date_format: val('date_format') || 'd/m/Y',
      time_format: val('time_format') || '12',
      time_zone: val('time_zone') || 'Asia/Kolkata',
    }),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['rst', 'settings'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // A failed read must not leave an EMPTY form that a save would then
  // write over the real settings.
  if (error) return <Card pad={18}><LoadFailed what="the settings" /></Card>;
  if (isLoading) return <Skeleton rows={5} height={44} />;

  return (
    <Card pad={18}>
      <h2 className="ds-h3">Business information</h2>
      <p className="ds-caption rst-sub">Your core business details, as they appear across the system.</p>
      <div className="rst-form-grid">
        <Field label="Business name"><input value={val('business_name')} onChange={set('business_name')} /></Field>
        <Field label="Phone"><input value={val('phone')} onChange={set('phone')} /></Field>
        <Field label="Email"><input type="email" value={val('email')} onChange={set('email')} /></Field>
        <Field label="Address" span={2}><input value={val('address')} onChange={set('address')} /></Field>
      </div>

      <h2 className="ds-h3 rst-h-sep">Regional settings</h2>
      <p className="ds-caption rst-sub">
        These are the restaurant's own values. Money elsewhere in the product renders from the
        organisation's currency, so keep the two consistent.
      </p>
      <div className="rst-form-grid">
        <Field label="Currency" required><input value={val('currency')} onChange={set('currency')} placeholder="INR" /></Field>
        <Field label="Language" required><input value={val('language')} onChange={set('language')} placeholder="en" /></Field>
        <Field label="Date format" required><input value={val('date_format')} onChange={set('date_format')} placeholder="d/m/Y" /></Field>
        <Field label="Time format" required><input value={val('time_format')} onChange={set('time_format')} placeholder="12" /></Field>
        <Field label="Time zone" required span={2}><input value={val('time_zone')} onChange={set('time_zone')} placeholder="Asia/Kolkata" /></Field>
      </div>

      <div className="rst-form-actions">
        <button className="btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Card>
  );
}

/* ── Billing & receipt ───────────────────────────────────────────────────── */

function BillingSection() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['rst', 'settings'], queryFn: () => settingsApi.get() });
  const s = (data ?? {}) as Record<string, any>;

  const [logo, setLogo] = useState<string | null>(null);
  const [mini, setMini] = useState<boolean | null>(null);
  const [full, setFull] = useState<boolean | null>(null);

  const save = useMutation({
    mutationFn: () => settingsApi.updateBilling({
      billing_receipt_logo: logo ?? s.billing_receipt_logo ?? '',
      show_order_items_in_mini_invoice: mini ?? Boolean(s.show_order_items_in_mini_invoice),
      show_order_items_in_full_invoice: full ?? Boolean(s.show_order_items_in_full_invoice),
    }),
    onSuccess: () => { toast.success('Receipt settings saved'); qc.invalidateQueries({ queryKey: ['rst', 'settings'] }); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  // A failed read must not leave an EMPTY form that a save would then
  // write over the real settings.
  if (error) return <Card pad={18}><LoadFailed what="the billing settings" /></Card>;
  if (isLoading) return <Skeleton rows={4} height={44} />;

  return (
    <Card pad={18}>
      <h2 className="ds-h3">Invoice template</h2>
      <p className="ds-caption rst-sub">What appears on a printed receipt.</p>
      <div className="rst-form-grid">
        <Field label="Business logo URL" span={2} hint="Shown at the top of receipts.">
          <input value={logo ?? s.billing_receipt_logo ?? ''} onChange={(e) => setLogo(e.target.value)} />
        </Field>
      </div>
      <label className="rst-toggle">
        <input type="checkbox" checked={mini ?? Boolean(s.show_order_items_in_mini_invoice)} onChange={(e) => setMini(e.target.checked)} />
        <span><strong>Show items on the mini invoice</strong><em>The short receipt handed over at the till.</em></span>
      </label>
      <label className="rst-toggle">
        <input type="checkbox" checked={full ?? Boolean(s.show_order_items_in_full_invoice)} onChange={(e) => setFull(e.target.checked)} />
        <span><strong>Show items on the full invoice</strong><em>The itemised copy.</em></span>
      </label>

      <div className="rst-form-actions">
        <button className="btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <p className="ds-caption rst-footnote">
        The designs also show tax-rate configuration, tax-inclusive pricing and a receipt footer
        message on this page. The billing endpoint accepts only the logo and the two item-visibility
        flags, so those three are not shown. Tax itself comes from the organisation's regime.
      </p>
    </Card>
  );
}

/* ── Users & roles ───────────────────────────────────────────────────────── */

function PeopleSection() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['rst', 'users'], queryFn: () => people.users() });
  const { data: roles = [] } = useQuery({ queryKey: ['rst', 'roles'], queryFn: () => people.roles() });
  const roleName = new Map((roles as any[]).map((r) => [r.id, r.name]));

  return (
    <Card pad={18}>
      <h2 className="ds-h3">Team members</h2>
      <p className="ds-caption rst-sub">View and manage staff access levels.</p>
      {isLoading ? <Skeleton rows={4} height={52} /> : (users as any[]).length === 0 ? (
        <EmptyState icon={Users} title="No restaurant users yet" compact />
      ) : (
        <ul className="rst-people">
          {(users as any[]).map((u) => (
            <li key={u.id}>
              <span className="rst-person-name">
                <strong>{u.name ?? u.firstName ?? u.email ?? 'Unnamed'}</strong>
                <em>{u.email ?? '—'}</em>
              </span>
              <Status tone="info">{roleName.get(u.roleId) ?? u.role?.name ?? 'No role'}</Status>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Payments ────────────────────────────────────────────────────────────── */

function PaymentsSection() {
  const { data, isLoading } = useQuery({ queryKey: ['rst', 'payments'], queryFn: () => settingsApi.payments() });
  const methods = Array.isArray(data) ? data : (data as any)?.methods ?? [];

  return (
    <Card pad={18}>
      <h2 className="ds-h3">Accepted payment types</h2>
      <p className="ds-caption rst-sub">The methods this restaurant can take.</p>
      {isLoading ? <Skeleton rows={3} height={40} /> : methods.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payment methods configured" compact />
      ) : (
        <ul className="rst-people">
          {methods.map((m: any, i: number) => (
            <li key={m.id ?? m.value ?? i}>
              <span className="rst-person-name">
                <strong>{m.label ?? m.name ?? String(m)}</strong>
                {m.value && <em>{m.value}</em>}
              </span>
              <Status tone={m.is_active === false ? 'neutral' : 'active'}>
                {m.is_active === false ? 'Off' : 'Accepted'}
              </Status>
            </li>
          ))}
        </ul>
      )}
      <p className="ds-caption rst-footnote">
        This list is read-only here. Payment methods are written per branch through
        <code> PATCH /restaurant/branches/payment-method</code>, and that endpoint validates against a
        different vocabulary than the order path does — a preserved source divergence. The designs'
        tip percentage, refund limits and gateway selection have no fields behind them.
      </p>
    </Card>
  );
}

/* ── Tables & rooms ──────────────────────────────────────────────────────── */

function TablesSection() {
  const { data: tables = [], isLoading } = useQuery({ queryKey: ['rst', 'tables'], queryFn: () => seating.tables() });
  const { data: zones = [] } = useQuery({ queryKey: ['rst', 'zones'], queryFn: () => seating.zones() });
  const { data: floors = [] } = useQuery({ queryKey: ['rst', 'floors'], queryFn: () => seating.floors() });

  return (
    <Card pad={18}>
      <h2 className="ds-h3">Restaurant tables</h2>
      <p className="ds-caption rst-sub">
        {tables.length} table{tables.length === 1 ? '' : 's'} across {floors.length} floor
        {floors.length === 1 ? '' : 's'} and {zones.length} zone{zones.length === 1 ? '' : 's'}.
      </p>
      {isLoading ? <Skeleton rows={3} height={40} /> : (
        <p className="ds-caption">
          Tables are created and edited on the floor view, where the room is visible while you work.
        </p>
      )}
      <div className="rst-form-actions">
        <a className="btn-secondary btn-sm" href="/restaurant/captain">Open floor view</a>
        <a className="btn-primary btn-sm" href="/restaurant/tables">Manage tables</a>
      </div>
    </Card>
  );
}

/* ── The honest empty state for an unbacked section ──────────────────────── */

function NotWired({
  icon: Icon, title, has, missing, needs,
}: { icon: any; title: string; has: string; missing: string; needs: string[] }) {
  return (
    <Card pad={18}>
      <h2 className="ds-h3">{title}</h2>
      <div className="rst-notwired">
        <Icon size={22} aria-hidden />
        <div>
          <p><strong>This section has no API behind it yet.</strong></p>
          <p className="ds-caption">{has}</p>
          <p className="ds-caption">{missing}</p>
          <p className="ds-caption rst-needs-label">Building it needs:</p>
          <ul className="ds-caption rst-needs">
            {needs.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <p className="ds-caption">
            The designs draw a full form here. Rendering one that silently discarded input would be
            worse than showing nothing — a saved-looking setting that never took effect.
          </p>
        </div>
      </div>
    </Card>
  );
}
