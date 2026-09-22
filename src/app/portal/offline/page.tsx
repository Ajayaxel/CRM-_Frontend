export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2,#f5f5f4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface,#fff)', border: '1px solid var(--line-soft,#e7e5e4)', borderRadius: 18, width: 440, maxWidth: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>📡</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '12px 0 6px' }}>You're offline</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3,#78716c)' }}>This portal needs a connection to load fresh data. Reconnect and try again — pages you've already opened stay available.</p>
      </div>
    </div>
  );
}
