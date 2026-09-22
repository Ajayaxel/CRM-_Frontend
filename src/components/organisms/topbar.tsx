'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Sun, Moon, Bell, Plus, LogOut, User as UserIcon, Building2 } from 'lucide-react';
import { useAuth, useAuthStore } from '@/features/foundation/auth';
import { api, apiErrorMessage } from '@/lib/api';
import { shellCopy } from '@/lib/shell-copy';
import { useTheme } from '@/lib/theme';
import { initials } from '@/lib/utils';
import { SetupChip } from '@/features/foundation/onboarding';
import { useCommandPalette, usePaletteHint } from '@/components/organisms/command-palette';

interface OrgSeat {
  organizationId: string;
  name: string;
  slug: string;
  vertical: string;
  logoUrl: string | null;
  roleName: string;
  current: boolean;
}

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const palette = useCommandPalette();
  const paletteHint = usePaletteHint();

  // Sibling accounts by email — only fetched while the menu is open.
  const { data: organizations } = useQuery<OrgSeat[]>({
    queryKey: ['auth-organizations'],
    queryFn: async () => (await api.get('/auth/organizations')).data,
    enabled: open,
  });

  const switchCompany = async (org: OrgSeat) => {
    if (switchingId) return;
    setSwitchingId(org.organizationId);
    try {
      const res = await api.post('/auth/switch-organization', { organizationId: org.organizationId });
      useAuthStore.getState().setAuth(res.data.accessToken, res.data.user);
      // Deliberate full reload: resets every React Query cache, the nav
      // vertical, and all in-memory state for the new company.
      window.location.href = '/dashboard';
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setSwitchingId(null);
    }
  };

  const iconBtn: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 11,
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--ink-2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line-soft)',
        padding: '14px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* One search affordance: this control *is* the palette trigger, so the
          app never shows two competing search boxes. */}
      <div style={{ flex: 1, maxWidth: 420 }}>
        <button
          type="button"
          className="ds-topbar-search"
          onClick={palette.open}
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="ds-topbar-search-label">
            {shellCopy(user?.organization?.vertical).searchPlaceholder}
          </span>
          <kbd className="ds-kbd">{paletteHint}</kbd>
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SetupChip />
        <button onClick={toggle} title="Toggle theme" style={iconBtn}>
          {theme === 'dark' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
        </button>

        <button style={{ ...iconBtn, position: 'relative' }} title="Notifications">
          <Bell size={18} strokeWidth={1.8} />
          <span
            style={{
              position: 'absolute',
              top: 9,
              right: 10,
              width: 7,
              height: 7,
              borderRadius: 99,
              background: 'var(--gold)',
              border: '1.5px solid var(--surface)',
            }}
          />
        </button>

        <Link
          href="/leads?new=1"
          className="btn-primary"
          style={{ height: 42, padding: '0 16px' }}
        >
          <Plus size={17} strokeWidth={2} />
          New Lead
        </Link>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, padding: 3, border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                background: 'var(--navy)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {initials(user?.firstName, user?.lastName)}
            </span>
          </button>

          {open && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
              <div
                className="card"
                style={{ position: 'absolute', right: 0, zIndex: 20, marginTop: 8, width: 220, padding: '4px 0', boxShadow: 'var(--shadow-3)' }}
              >
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.email}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{user?.organization.name}</div>
                </div>
                {organizations && organizations.length > 1 && (
                  <div style={{ borderBottom: '1px solid var(--line-soft)', padding: '4px 0' }}>
                    <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                      Switch company
                    </div>
                    {organizations.map((org) => (
                      <button
                        key={org.organizationId}
                        onClick={() => {
                          if (!org.current) void switchCompany(org);
                        }}
                        disabled={org.current || switchingId !== null}
                        style={{
                          ...menuItem,
                          cursor: org.current || switchingId ? 'default' : 'pointer',
                          opacity: switchingId && switchingId !== org.organizationId ? 0.5 : 1,
                        }}
                      >
                        <Building2 size={16} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {org.name}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-3)' }}>
                            {switchingId === org.organizationId ? 'Switching…' : org.roleName}
                          </span>
                        </span>
                        {org.current && (
                          <span
                            aria-label="Current company"
                            style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--gold)', flexShrink: 0 }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    router.push('/settings/profile');
                  }}
                  style={menuItem}
                >
                  <UserIcon size={16} /> My profile
                </button>
                <button onClick={logout} style={{ ...menuItem, color: 'var(--danger)' }}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const menuItem: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 8,
  padding: '9px 16px',
  fontSize: 13,
  color: 'var(--ink)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
};
