import { Boxes } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div
        className="hidden w-1/2 flex-col justify-between p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg,#1B2C8C,#0D1854)' }}
      >
        {/* Before sign-in the realm is unknown, so the mark has to be neutral.
            This panel says "every vertical" beside a graduation cap, which told
            an insurance broker they had opened the wrong product — the same
            mistake already fixed on the customer portal's sign-in. */}
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Boxes className="h-7 w-7" />
          BMN Connect
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Turn conversations<br />into customers.
          </h1>
          <p className="mt-4 max-w-md" style={{ color: 'rgba(255,255,255,0.75)' }}>
            CRM, sales, operations and finance for your whole business —
            one login, every vertical.
          </p>
        </div>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          © {new Date().getFullYear()} BMN CRM. All rights reserved.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
