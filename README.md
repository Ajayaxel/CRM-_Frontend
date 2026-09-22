# BMN CRM Frontend Architecture (@bmn/web)

High-performance, multi-tenant Next.js 15 web application for BMN CRM, architected with a **5-Tier Feature Layer**, **React Atomic Design Components**, and **5 Web Portals**.

---

## 🏗️ Architecture Overview

```
apps/web/src/
├── app/                  # Next.js App Router (Thin Page Routing Layer)
├── components/           # React Atomic Design System (Atoms, Molecules, Organisms, Templates)
│   ├── atoms/            # Basic UI building blocks (StatusBadge, Buttons, Icons)
│   ├── molecules/        # Grouped atomic elements (Field, Modal, PageHeader, Segmented)
│   ├── organisms/        # Complex UI components (Sidebar, Topbar, CommandPalette, RolePermissionsEditor)
│   └── templates/        # Page layout templates
├── features/             # 5-Tier Business Logic Layer
│   ├── foundation/       # Auth, Audit, Branding, Onboarding, Subscription, Accounts
│   ├── platform/         # Automation, Calendar, Communication, Omni, Events, Group, Reports, Settings
│   ├── capabilities/     # Accounting, Billing, CRM (Leads, Contacts, Tasks), Documents, HR, POS
│   ├── verticals/        # 15 Industry OS Vertical Groups (Education, Healthcare, Hotel, Solar, Real Estate, etc.)
│   └── experiences/      # Customer Portal, Vendor Portal, Agent Portal, Portal Admin
└── lib/                  # API Client (Axios), Verticals Registry, Utils
```

---

## 🌟 5-Tier Feature System (`src/features/`)

### 1. 🛡️ Foundation (`src/features/foundation/`)
- **`auth`**: Login, Registration, MFA verification, Password reset, Invitation acceptance.
- **`audit`**: Audit log tables & system activity tracking.
- **`branding`**: Tenant white-label branding, logo, and theme configuration.
- **`onboarding`**: Tenant signup wizard and setup flow.
- **`subscription`**: Self-serve plans (`STARTER`, `GROWTH`, `PROFESSIONAL`), feature flags & quota banners.
- **`accounts`**: Multi-organization seat management & switcher.

### 2. ⚡ Platform (`src/features/platform/`)
- **`automation`**: Workflow triggers & automation engine.
- **`calendar`**: Shared event calendar and scheduler views.
- **`communication`**: Omnichannel notifications.
- **`omni`**: WhatsApp, Meta, SMS, live chat, bot automations, and broadcasts interface.
- **`custom-fields`**: Dynamic form field builder & schema viewer.
- **`events`**: Platform event handlers.
- **`group`**: Holding group multi-company financial comparisons.
- **`platform`**: Super Admin Console interface.
- **`reports`**: Analytics dashboards & financial statement viewers.
- **`settings`**: Organization settings, API keys, email templates.

### 3. 💼 Capabilities (`src/features/capabilities/`)
- **`accounting`**: General Ledger, Chart of Accounts (COA), Trial Balance.
- **`billing`**: Invoices, Receipts, Supplier bills, Payment allocations.
- **`crm`**: Sales Pipeline boards, Lead management, Contacts, Task drawers.
- **`documents`**: Document Studio, PDF generation & templates.
- **`hr`**: Employee register, Payroll processing, Payslips.
- **`pos`**: Counter POS terminal UI, product grids, receipt printing.

### 4. 🏢 Verticals — 15 Industry OS Groups (`src/features/verticals/`)
Each vertical contains isolated screens, components, clients, and types:
- 🎓 **`education/`**: Academics, Admissions, Students, Exams, Fees, OBE, Certificates, Alumni, Placements, RMS.
- 🏥 **`healthcare/`**: Practice EMR, Dental charts, Derma procedures, Optometry exams, Diagnostic Lab, Pharmacy.
- 🏨 **`hotel/`**: Front desk grid, Room reservations, Housekeeping, Folio billing.
- ☀️ **`solar/`**: Proposal builder, CAD canvas, Inverter telemetry.
- 🏡 **`realestate/`**: Property listings, Lease contracts, Maintenance, Complaints.
- 🍽️ **`restaurant/`**: Table seating layout, Kitchen Display System (KDS), Menu modifiers.
- 🛍️ **`retail/`**: Product catalogue, Variant stock, Shopify sync, Used Car, Vehicle Rental.
- 💼 **`consulting/`**: PMO workspace, Project boards, Timesheets, Deliverables.
- 🌍 **`study-abroad/`**: University matcher, Application pipeline, Visa tracker.
- ✈️ **`travel/`**: Itinerary packages, Booking board, Passport verification.
- 🏢 **`coworking/`**: Space inventory, Desk booking, Visitor check-in.
- 🛡️ **`insurance/`**: Policy broking, Quote builder, Claims tracker, Commission.
- ⚖️ **`legal/`**: Matter management, Hearing calendar, Trust account.
- 🐔 **`poultry/`**: Farming integration, Feed dispatch, Batch live tracker.
- 🤝 **`agency/`**: Client accounts, Retainer billing, Deliverable approvals.

### 5. 📱 Experiences (`src/features/experiences/`)
- **`portal`**: Student & Client self-service portal.
- **`portal-admin`**: Portal user account management.
- **`vendorportal`**: Maintenance vendor work order portal.
- **`agentportal`**: Sub-agent & referral partner portal.

---

## 🎨 React Atomic Design System (`src/components/`)

Component architecture follows **Atomic Design**:
- **Atoms (`src/components/atoms/`)**: Atomic UI building blocks (`StatusBadge`, `Button`, `Icon`, `Spinner`).
- **Molecules (`src/components/molecules/`)**: Bonded atomic elements (`FormField`, `Modal`, `PageHeader`, `SegmentedControl`).
- **Organisms (`src/components/organisms/`)**: Complex UI sections (`Sidebar`, `Topbar`, `CommandPalette`, `RolePermissionsEditor`).
- **Templates (`src/components/templates/`)**: Reusable page layout frames.

---

## 🌐 Web Portals & URLs

| Portal | Audience | Web URL |
| :--- | :--- | :--- |
| **Main CRM App** | Staff, Counsellors, Managers, Owners | `http://localhost:3400/` (Login: `/login`) |
| **Student & Client Portal** | Students, Clients, Solar Buyers | `http://localhost:3400/portal/login` |
| **Consultant & PMO Workspace** | Developers, PMs, QA | `http://localhost:3400/consultant/verticals` |
| **Super Admin Console** | Platform Owners | `http://localhost:3400/platform/login` |
| **Self-Serve Signup** | New Business Owners | `http://localhost:3400/register` |

---

## 🛠️ Local Development

```bash
# Start Web Development Server
npm run dev

# Run TypeScript Check
npx tsc --noEmit

# Build Production Bundle
npm run build
```
