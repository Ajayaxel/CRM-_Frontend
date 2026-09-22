import {
  Banknote,
  Sun,
  ReceiptText,
  Layers3,
  Shirt,
  HardHat as HardHatIcon,
  LayoutDashboard,
  Users2,
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  CheckSquare,
  Calendar,
  BarChart3,
  UserCog,
  UserCheck,
  User,
  Compass,
  Users,
  Luggage,
  FileCheck,
  Building2,
  Contact,
  Globe,
  Handshake,
  FolderOpen,
  FileType2,
  MessagesSquare,
  Plug,
  Building,
  FolderKanban,
  Briefcase,
  Wrench,
  HardHat,
  Receipt,
  FileText,
  Award,
  BookMarked,
  PartyPopper,
  LifeBuoy,
  Gauge,
  Megaphone,
  Workflow,
  Waypoints,
  Bot,
  Share2,
  ShoppingBag,
  Blocks,
  LineChart,
  Wallet,
  Sparkles,
  Palette,
  Stethoscope,
  CalendarClock,
  Clock,
  Target,
  ListChecks,
  Grid3x3,
  ClipboardList,
  Layers,
  Eye,
  Glasses,
  FlaskConical,
  TestTube,
  Scale,
  Gavel,
  Pill,
  Package,
  PackagePlus,
  Car,
  Landmark,
  CalendarDays,
  Key,
  Shield,
  ShieldCheck,
  RefreshCw,
  LayoutGrid,
  Inbox,
  Columns3,
  Bug,
  Lightbulb,
  Flag,
  GanttChartSquare,
  Rocket,
  Activity as ActivityIcon,
  Search as SearchIcon,
  UserRoundCheck,
  type LucideIcon,
  Armchair,
  DoorOpen,
  FileSignature,
  ScanLine,
  Map,
  ChefHat,
  Soup,
  Settings,
  Truck,
  Percent,
  ConciergeBell,
  Ruler,
  Calculator,
  Ban,
  ListTree,
  SlidersHorizontal,
  UtensilsCrossed,
  PackageCheck, Bell, ShoppingCart, Boxes, Store, GitBranch, PackageOpen, Lock, Bird, Route, HandCoins, Database,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  section: string;
  vertical?: string; // OrgVertical key — shown only for this org vertical; omit = all
  verticals?: string[]; // shown for any of these org verticals (e.g. the healthcare group)
  /**
   * Hidden for these verticals. For a generic entry that a vertical REPLACES with
   * its own routed page (Leads → /insurance/leads), listing the one exception here
   * keeps the entry working for every other vertical — present and future — which
   * an allow-list of "every vertical except X" would silently break.
   */
  excludeVerticals?: string[];
  /**
   * A PRODUCT the organisation must hold, distinct from the vertical it runs.
   *
   * Vertical and product are different entitlements: a restaurant runs the
   * restaurant application because of what it IS, and holds Omni because of
   * what it BOUGHT. The backend enforces both; this keeps the sidebar from
   * offering a link that answers 403.
   */
  product?: 'CRM' | 'OMNI' | 'ERP' | 'PRACTICE';
}

/** The products a tenant holds, as `/auth/me` reports them. */
export type OrgProducts = string[] | undefined;

/**
 * The single vertical predicate. The sidebar and the command palette must agree
 * exactly — the palette can never be a back door to a page the nav hides — so
 * they both call this rather than each re-implementing the rule.
 */
export function navMatchesVertical(item: NavItem, vertical: string): boolean {
  if (item.vertical && item.vertical !== vertical) return false;
  if (item.verticals && !item.verticals.includes(vertical)) return false;
  if (item.excludeVerticals?.includes(vertical)) return false;
  return true;
}

/**
 * Does the organisation hold the PRODUCT this entry needs?
 *
 * Hiding is a courtesy, never the control — `EntitlementsGuard` refuses the API
 * whatever the sidebar shows, so typing the URL meets the same 403. This exists
 * so the nav does not advertise a page the organisation cannot use.
 */
export function navMatchesProducts(item: NavItem, products: OrgProducts): boolean {
  if (!item.product) return true;
  if (!products) return false;          // unknown entitlement is not an entitlement
  return products.includes(item.product);
}

// Who runs the PMO. The consultant workspace manages OUR delivery of the
// verticals, so it belongs to the verticals that do engagement work — never to
// a tenant that merely uses one of the products.
export const OPERATOR_VERTICALS = ['CONSULTING', 'DIGITAL_AGENCY'];

// The five healthcare verticals share the Practice/EHR surface.
export const HEALTHCARE_VERTICALS = ['CLINIC', 'DENTAL', 'DERMATOLOGY', 'OPTOMETRY', 'DIAGNOSTIC_LAB'];

// Grouped to mirror the BMN Connect CRM design (Overview / Sales / Academics / Workspace / Admin).
export const NAV_ITEMS: NavItem[] = [
  // /dashboard resolves to the tenant's own dashboard, so this single entry is
  // correct for every vertical and INSURANCE does not need a second one beside it.
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview', excludeVerticals: ['HOTEL'] },

  // Insurance runs its own Leads screen (kanban + convert-to-client), so the
  // generic one steps aside there and stays exactly as it was everywhere else.
  { label: 'Leads', href: '/leads', icon: Users2, permission: 'lead.view', section: 'Sales', excludeVerticals: ['INSURANCE', 'COWORKING', 'HOTEL'] },
  { label: 'Admissions', href: '/admissions', icon: ClipboardCheck, permission: 'admission.view', section: 'Sales', vertical: 'INSTITUTE' },

  { label: 'Applications', href: '/applications', icon: ClipboardCheck, section: 'Study Abroad', vertical: 'STUDY_ABROAD' },
  { label: 'Universities', href: '/universities', icon: GraduationCap, section: 'Study Abroad', vertical: 'STUDY_ABROAD' },
  { label: 'Program Match', href: '/study-match', icon: Sparkles, section: 'Study Abroad', vertical: 'STUDY_ABROAD' },

  { label: 'Accounts', href: '/accounts', icon: Briefcase, section: 'Digital Agency', vertical: 'DIGITAL_AGENCY' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, section: 'Digital Agency', vertical: 'DIGITAL_AGENCY' },
  { label: 'Finance & ERP', href: '/erp-finance', icon: Landmark, section: 'Digital Agency', vertical: 'DIGITAL_AGENCY' },
  { label: 'Accounting', href: '/accounting', icon: Receipt, permission: 'accounting.view', section: 'Digital Agency', vertical: 'DIGITAL_AGENCY' },

  // Both carried no permission at all, so the sidebar offered them to every seat
  // in a consulting tenant including Viewer — and the API agreed, because it was
  // unguarded too. consulting.view is the read key; the write keys are enforced
  // per route on the controller.
  // The client workspace — the screen the consulting product is actually about.
  // First in the section because every other consulting screen is something you
  // reach THROUGH a company: its issues, its meetings, its strategy.
  { label: 'Companies', href: '/companies', icon: Building2, permission: 'consulting.company.view', section: 'Consulting', vertical: 'CONSULTING' },
  { label: 'Engagements', href: '/engagements', icon: Briefcase, permission: 'consulting.view', section: 'Consulting', vertical: 'CONSULTING' },
  { label: 'Proposals', href: '/proposals', icon: FileText, permission: 'consulting.view', section: 'Consulting', vertical: 'CONSULTING' },
  // Delivery and time, as screens rather than as a panel you have to expand an
  // engagement to reach. Both read paged, filtered list endpoints — the totals
  // and the overdue test are computed by the API, not by the browser.
  { label: 'Milestones', href: '/milestones', icon: Flag, permission: 'consulting.view', section: 'Consulting', vertical: 'CONSULTING' },
  { label: 'Timesheets', href: '/timesheets', icon: Clock, permission: 'consulting.view', section: 'Consulting', vertical: 'CONSULTING' },

  // Consultant work management — the PMO surface over the sub-verticals.
  //
  // The pm.* permission alone is not enough of a gate: the seeded Owner and
  // Admin roles carry every pm.* key in EVERY vertical, so an insurance broker
  // signing in as their own owner was shown Projects, Issues, Features and
  // Milestones — our build backlog, inside their product. This is an operator
  // surface, so it is scoped to the verticals that run engagements. The
  // permission still applies on top; both must pass.
  { label: 'Consultant', href: '/consultant', icon: LayoutGrid, permission: 'pm.vertical.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Product Lines', href: '/consultant/verticals', icon: Columns3, permission: 'pm.vertical.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'My Work', href: '/consultant/my-work', icon: Inbox, permission: 'pm.task.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Projects', href: '/consultant/projects', icon: FolderKanban, permission: 'pm.project.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Tasks', href: '/consultant/tasks', icon: ListChecks, permission: 'pm.task.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Issues', href: '/consultant/issues', icon: Bug, permission: 'pm.issue.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Features', href: '/consultant/features', icon: Lightbulb, permission: 'pm.feature.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Milestones', href: '/consultant/milestones', icon: Flag, permission: 'pm.milestone.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Timeline', href: '/consultant/timeline', icon: GanttChartSquare, permission: 'pm.milestone.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Calendar', href: '/consultant/calendar', icon: CalendarDays, permission: 'pm.milestone.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Developers', href: '/consultant/team', icon: Users, permission: 'pm.vertical.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Documents', href: '/consultant/documents', icon: FolderOpen, permission: 'pm.document.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Deployments', href: '/consultant/deployments', icon: Rocket, permission: 'pm.deployment.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Activity', href: '/consultant/activity', icon: ActivityIcon, permission: 'pm.vertical.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Reports', href: '/consultant/reports', icon: BarChart3, permission: 'pm.report.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },
  { label: 'Search', href: '/consultant/search', icon: SearchIcon, permission: 'pm.vertical.view', section: 'Consultant', verticals: OPERATOR_VERTICALS },

  { label: 'Matters', href: '/matters', icon: Scale, section: 'Legal', vertical: 'LEGAL' },
  { label: 'Court Dates', href: '/court-dates', icon: Gavel, section: 'Legal', vertical: 'LEGAL' },

  { label: 'Drug Catalogue', href: '/drugs', icon: Pill, section: 'Pharmacy', vertical: 'PHARMACY' },
  { label: 'Stock & Expiry', href: '/stock', icon: PackagePlus, section: 'Pharmacy', vertical: 'PHARMACY' },
  { label: 'Counter', href: '/counter', icon: ShoppingBag, section: 'Pharmacy', vertical: 'PHARMACY' },

  { label: 'Inventory', href: '/inventory', icon: Car, section: 'Used Car', vertical: 'USED_CAR' },
  { label: 'Test Drives', href: '/test-drives', icon: CalendarClock, section: 'Used Car', vertical: 'USED_CAR' },
  { label: 'Trade-ins & Finance', href: '/car-deals', icon: Landmark, section: 'Used Car', vertical: 'USED_CAR' },

  { label: 'Fleet', href: '/fleet', icon: Car, section: 'Rental Car', vertical: 'CAR_RENTAL' },
  { label: 'Rentals', href: '/rentals', icon: CalendarDays, section: 'Rental Car', vertical: 'CAR_RENTAL' },

  { label: 'Dashboard', href: '/travel/dashboard', icon: LayoutDashboard, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'UAE Resident Profiles', href: '/travel/uae-profiles', icon: User, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'KSA Traveler Profiles', href: '/travel/ksa-profiles', icon: UserCheck, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Qatar Traveler Profiles', href: '/travel/qatar-profiles', icon: UserCheck, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Kerala Traveler Profiles', href: '/travel/kerala-profiles', icon: UserCheck, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Ayurveda & Wellness', href: '/travel/ayurveda', icon: Compass, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Student Migration', href: '/travel/student-migration', icon: GraduationCap, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Expat Travel Management', href: '/travel/expats', icon: Briefcase, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Family Travel Accounts', href: '/travel/family', icon: Users, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Quotes Engine', href: '/travel/quotes', icon: FileText, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Bookings Pipeline', href: '/travel/bookings', icon: Luggage, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Tour Packages', href: '/travel/packages', icon: Package, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Departure Calendar', href: '/travel/calendar', icon: CalendarDays, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Visa Platform', href: '/travel/visa', icon: FileCheck, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Religious Tourism', href: '/travel/pilgrimage', icon: Compass, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'MICE & Groups', href: '/travel/mice', icon: Building, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'B2B Agent Network', href: '/travel/b2b', icon: Users, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Suppliers & Payables', href: '/travel/suppliers', icon: Handshake, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Passport & Docs Vault', href: '/travel/documents', icon: Shield, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Corporate Travel', href: '/travel/corporate', icon: Building2, section: 'Travel', vertical: 'TRAVEL' },
  { label: 'Regional Compliance', href: '/travel/compliance', icon: ShieldCheck, section: 'Travel', vertical: 'TRAVEL' },

  { label: 'Queue', href: '/queue', icon: ListChecks, section: 'Practice', verticals: HEALTHCARE_VERTICALS },
  { label: 'Appointments', href: '/appointments', icon: CalendarClock, section: 'Practice', verticals: HEALTHCARE_VERTICALS },
  { label: 'Patients', href: '/patients', icon: Users, section: 'Practice', verticals: HEALTHCARE_VERTICALS },
  { label: 'Odontogram', href: '/odontogram', icon: Grid3x3, section: 'Practice', vertical: 'DENTAL' },
  { label: 'Treatment Plans', href: '/treatment-plans', icon: ClipboardList, section: 'Practice', vertical: 'DENTAL' },
  { label: 'Procedures', href: '/procedures', icon: Sparkles, section: 'Practice', vertical: 'DERMATOLOGY' },
  { label: 'Packages', href: '/packages', icon: Layers, section: 'Practice', vertical: 'DERMATOLOGY' },
  { label: 'Eye Exams', href: '/eye-exams', icon: Eye, section: 'Practice', vertical: 'OPTOMETRY' },
  { label: 'Optical Shop', href: '/optical-shop', icon: Glasses, section: 'Practice', vertical: 'OPTOMETRY' },
  { label: 'Test Catalogue', href: '/lab-tests', icon: FlaskConical, section: 'Practice', vertical: 'DIAGNOSTIC_LAB' },
  { label: 'Lab Orders', href: '/lab-orders', icon: TestTube, section: 'Practice', vertical: 'DIAGNOSTIC_LAB' },
  { label: 'Providers', href: '/providers', icon: Stethoscope, section: 'Practice', verticals: HEALTHCARE_VERTICALS },

  { label: 'Agents', href: '/agent', icon: Contact, permission: 'realestate.view', section: 'Agent Portal', vertical: 'REAL_ESTATE' },
  { label: 'Listings', href: '/agent/properties', icon: Building, permission: 'realestate.view', section: 'Agent Portal', vertical: 'REAL_ESTATE' },
  { label: 'Lead Match', href: '/agent/leads', icon: Sparkles, permission: 'realestate.sales', section: 'Agent Portal', vertical: 'REAL_ESTATE' },
  { label: 'Tenants', href: '/agent/tenants', icon: Users2, permission: 'realestate.view', section: 'Agent Portal', vertical: 'REAL_ESTATE' },

  { label: 'Solar Projects', href: '/solar', icon: Sun, section: 'Solar', vertical: 'SOLAR' },
  { label: 'Installer App', href: '/installer', icon: HardHatIcon, section: 'Solar', vertical: 'SOLAR' },
  { label: 'Reports', href: '/solar/reports', icon: BarChart3, section: 'Solar', vertical: 'SOLAR' },
  { label: 'Finance & ERP', href: '/erp-finance', icon: Landmark, section: 'Solar', vertical: 'SOLAR' },
  { label: 'Accounting', href: '/accounting', icon: Receipt, permission: 'accounting.view', section: 'Solar', vertical: 'SOLAR' },

  // Insurance broking — real routed pages, grouped by what the broker is doing
  // (was a single tabbed console at /insurance).
  { label: 'Leads', href: '/insurance/leads', icon: Users2, permission: 'lead.view', section: 'Sales', vertical: 'INSURANCE' },
  { label: 'Clients', href: '/insurance/clients', icon: Contact, section: 'Sales', vertical: 'INSURANCE' },
  { label: 'Quotes', href: '/insurance/quotes', icon: FileText, section: 'Sales', vertical: 'INSURANCE' },
  { label: 'Policies', href: '/insurance/policies', icon: Shield, section: 'Operations', vertical: 'INSURANCE' },
  { label: 'Renewals', href: '/insurance/renewals', icon: RefreshCw, section: 'Operations', vertical: 'INSURANCE' },
  { label: 'Claims', href: '/insurance/claims', icon: Award, section: 'Operations', vertical: 'INSURANCE' },
  { label: 'Commission', href: '/insurance/commission', icon: Wallet, section: 'Finance', vertical: 'INSURANCE' },
  // Premium held for insurers is a different question from brokerage earned,
  // and a broker who collects has to answer both.
  { label: 'Premium', href: '/insurance/premium', icon: Banknote, section: 'Finance', vertical: 'INSURANCE' },
  // Hospitality reads the same documents through Folios, which knows about
  // rooms and stays. The generic ledger of every commercial document the
  // business has ever raised is not the front desk's screen.
  { label: 'Invoices', href: '/invoices', icon: FileText, section: 'Finance', excludeVerticals: ['HOTEL'] },
  { label: 'Reports', href: '/insurance/reports', icon: BarChart3, section: 'Finance', vertical: 'INSURANCE' },
  { label: 'Finance & ERP', href: '/erp-finance', icon: Landmark, section: 'Finance', vertical: 'INSURANCE' },
  { label: 'Accounting', href: '/accounting', icon: Receipt, permission: 'accounting.view', section: 'Finance', vertical: 'INSURANCE' },
  { label: 'Insurers', href: '/insurance/insurers', icon: Building2, section: 'Administration', vertical: 'INSURANCE' },
  { label: 'Products', href: '/insurance/products', icon: Package, section: 'Administration', vertical: 'INSURANCE' },
  { label: 'Agents', href: '/insurance/agents', icon: Handshake, section: 'Administration', vertical: 'INSURANCE' },
  { label: 'Executives', href: '/insurance/executives', icon: UserRoundCheck, section: 'Administration', vertical: 'INSURANCE' },

  // ---- Coworking Space OS (BNO Connect) ----------------------------------
  // Ordered the way the day runs: the floor plan is the home screen, the desk
  // works bookings and the front desk, sales works the pipeline, and the
  // inventory lives under Administration where it is set up once.
  { label: 'Overview', href: '/coworking', icon: LayoutGrid, permission: 'coworking.view', section: 'Overview', vertical: 'COWORKING' },
  { label: 'Floor plan', href: '/coworking/floor-plan', icon: Map, permission: 'coworking.view', section: 'Operations', vertical: 'COWORKING' },
  { label: 'Bookings', href: '/coworking/bookings', icon: CalendarDays, permission: 'coworking.view', section: 'Operations', vertical: 'COWORKING' },
  { label: 'Front desk', href: '/coworking/front-desk', icon: DoorOpen, permission: 'coworking.frontdesk', section: 'Operations', vertical: 'COWORKING' },
  { label: 'Leads', href: '/coworking/leads', icon: Users2, permission: 'coworking.sales', section: 'Sales', vertical: 'COWORKING' },
  { label: 'Site visits', href: '/coworking/site-visits', icon: CalendarClock, permission: 'coworking.sales', section: 'Sales', vertical: 'COWORKING' },
  { label: 'Quotations', href: '/coworking/quotations', icon: FileText, permission: 'coworking.sales', section: 'Sales', vertical: 'COWORKING' },
  { label: 'Customers', href: '/coworking/customers', icon: Contact, permission: 'coworking.view', section: 'Sales', vertical: 'COWORKING' },
  { label: 'Contracts', href: '/coworking/contracts', icon: FileSignature, permission: 'coworking.view', section: 'Members', vertical: 'COWORKING' },
  { label: 'Memberships', href: '/coworking/memberships', icon: Users, permission: 'coworking.view', section: 'Members', vertical: 'COWORKING' },
  { label: 'Renewals', href: '/coworking/renewals', icon: RefreshCw, permission: 'coworking.view', section: 'Members', vertical: 'COWORKING' },
  { label: 'Billing', href: '/coworking/billing', icon: Receipt, permission: 'coworking.finance', section: 'Finance', vertical: 'COWORKING' },
  { label: 'Reports', href: '/coworking/reports', icon: BarChart3, permission: 'coworking.view', section: 'Finance', vertical: 'COWORKING' },
  { label: 'Accounting', href: '/accounting', icon: Landmark, permission: 'accounting.view', section: 'Finance', vertical: 'COWORKING' },
  { label: 'Spaces', href: '/coworking/spaces', icon: Armchair, permission: 'coworking.manage', section: 'Administration', vertical: 'COWORKING' },
  { label: 'Plans', href: '/coworking/plans', icon: Package, permission: 'coworking.manage', section: 'Administration', vertical: 'COWORKING' },
  { label: 'Services', href: '/coworking/services', icon: PackagePlus, permission: 'coworking.manage', section: 'Administration', vertical: 'COWORKING' },

  // ---- Poultry Farming OS -------------------------------------------------
  // Ordered the way the integration day runs: the calendar says which farm
  // needs what, feed is the morning's first question, pickups close cycles,
  // the supply and stall desks sell the output, and the money desk settles.
  { label: 'Overview', href: '/poultry', icon: LayoutGrid, permission: 'poultry.view', section: 'Overview', vertical: 'POULTRY' },
  // The cockpit first: a manager with forty farms opens the day on the three
  // things that are wrong, not on a list of forty.
  { label: 'Daily task', href: '/poultry/daily-task', icon: ClipboardCheck, permission: 'poultry.view', section: 'Overview', vertical: 'POULTRY' },
  { label: 'Control board', href: '/poultry/control-board', icon: Bird, permission: 'poultry.view', section: 'Overview', vertical: 'POULTRY' },
  { label: 'Daily farm live', href: '/poultry/daily', icon: ClipboardList, permission: 'poultry.field', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Field operations', href: '/poultry/field-ops', icon: PackageOpen, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Farm profitability', href: '/poultry/farm-profitability', icon: Landmark, permission: 'poultry.view', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Cycle closing', href: '/poultry/cycle-closing', icon: Lock, permission: 'poultry.finance', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Farms', href: '/poultry/farms', icon: Map, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Cycle calendar', href: '/poultry/calendar', icon: CalendarDays, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Batches', href: '/poultry/batches', icon: Package, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Feed', href: '/poultry/feed', icon: Truck, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Pickups', href: '/poultry/pickups', icon: PackageCheck, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Alerts', href: '/poultry/alerts', icon: Bell, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Chick purchases', href: '/poultry/chicks', icon: ShoppingCart, permission: 'poultry.view', section: 'Inventory', vertical: 'POULTRY' },
  { label: 'Medicine & materials', href: '/poultry/inventory', icon: Boxes, permission: 'poultry.view', section: 'Inventory', vertical: 'POULTRY' },
  { label: 'Party supply', href: '/poultry/parties', icon: Users2, permission: 'poultry.supply', section: 'Sales', vertical: 'POULTRY' },
  { label: 'Dispatch trail', href: '/poultry/dispatch-trail', icon: Route, permission: 'poultry.view', section: 'Sales', vertical: 'POULTRY' },
  { label: 'Receivables', href: '/poultry/receivables', icon: HandCoins, permission: 'poultry.supply', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Stalls', href: '/poultry/stalls', icon: Store, permission: 'poultry.stall', section: 'Sales', vertical: 'POULTRY' },
  { label: 'Outlet day', href: '/poultry/outlet-day', icon: Scale, permission: 'poultry.stall', section: 'Sales', vertical: 'POULTRY' },
  { label: 'Farmers', href: '/poultry/farmers', icon: UserRoundCheck, permission: 'poultry.view', section: 'Operations', vertical: 'POULTRY' },
  { label: 'Suppliers', href: '/poultry/suppliers', icon: Contact, permission: 'poultry.view', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Settlements', href: '/poultry/settlements', icon: Handshake, permission: 'poultry.finance', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Expenses', href: '/poultry/expenses', icon: Receipt, permission: 'poultry.view', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Money desk', href: '/poultry/money', icon: Landmark, permission: 'poultry.finance', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Reports', href: '/poultry/reports', icon: BarChart3, permission: 'poultry.view', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Accounting', href: '/accounting', icon: Landmark, permission: 'accounting.view', section: 'Finance', vertical: 'POULTRY' },
  { label: 'Company setup', href: '/poultry/company-setup', icon: ClipboardCheck, permission: 'poultry.view', section: 'Administration', vertical: 'POULTRY' },
  { label: 'Inventory migration', href: '/poultry/stock-migration', icon: Database, permission: 'poultry.manage', section: 'Administration', vertical: 'POULTRY' },
  { label: 'Settings', href: '/poultry/settings', icon: Settings, permission: 'poultry.manage', section: 'Administration', vertical: 'POULTRY' },

  // Restaurant. These six are the left rail drawn inside every JUSTPOS frame in
  // the POS Figma file — shipped as nav rather than rebuilt inside the page, so
  // a restaurant user gets one sidebar and it filters on permissions like every
  // other vertical's. The captain floor app is deliberately absent: it is a
  // standalone tablet surface reached from Tables, not a console page.
  //
  // Permission ids are the ported ones (apps/api/src/restaurant/**), not this
  // repo's `<module>.<action>` house style — renaming them would unguard routes.
  { label: 'Restaurant', href: '/restaurant', icon: ChefHat, section: 'Restaurant', vertical: 'RESTAURANT' },
  // `sales.orders.create`, not `orders.create` — the latter is in no catalogue,
  // so this entry was hidden from every restaurant user including a full-permission owner.
  { label: 'Order', href: '/restaurant/order', icon: ShoppingBag, permission: 'sales.orders.create', section: 'Restaurant', vertical: 'RESTAURANT' },
  { label: 'Tables', href: '/restaurant/tables', icon: Armchair, permission: 'seating-plans.tables.view', section: 'Seating', vertical: 'RESTAURANT' },
  { label: 'Kitchen display', href: '/restaurant/kds', icon: Soup, permission: 'kitchen-view.view', section: 'Restaurant', vertical: 'RESTAURANT' },
  { label: 'Online orders', href: '/restaurant/online-orders', icon: Truck, permission: 'pos-captain-app.kitchen-view.view', section: 'Restaurant', vertical: 'RESTAURANT' },
  { label: 'Menu overview', href: '/restaurant/menu', icon: Layers3, permission: 'menu-items.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Inventory', href: '/restaurant/inventory', icon: Package, permission: 'inventory.ingredients.view', section: 'Inventory', vertical: 'RESTAURANT' },
  // There is no admin reports permission in the catalogue — only the mobile and
  // captain ones, which gate different endpoints. This screen reads the ORDER
  // list, so that is what it must be allowed to read.
  { label: 'Reports', href: '/restaurant/reports', icon: BarChart3, permission: 'sales.orders.view', section: 'Restaurant', vertical: 'RESTAURANT' },
  { label: 'Branches', href: '/restaurant/branches', icon: Building2, permission: 'branches.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Orders', href: '/restaurant/orders', icon: Receipt, permission: 'sales.orders.view', section: 'Restaurant', vertical: 'RESTAURANT' },
  { label: 'Customers', href: '/restaurant/customers', icon: Users, permission: 'customers.view', section: 'People', vertical: 'RESTAURANT' },
  { label: 'Discounts', href: '/restaurant/discounts', icon: Percent, permission: 'discounts.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Services', href: '/restaurant/services', icon: ConciergeBell, permission: 'services.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Floors', href: '/restaurant/floors', icon: Layers, permission: 'seating-plans.floors.view', section: 'Seating', vertical: 'RESTAURANT' },
  { label: 'Zones', href: '/restaurant/zones', icon: LayoutGrid, permission: 'seating-plans.zones.view', section: 'Seating', vertical: 'RESTAURANT' },
  { label: 'Purchases', href: '/restaurant/purchases', icon: PackagePlus, permission: 'inventory.purchases.view', section: 'Inventory', vertical: 'RESTAURANT' },
  { label: 'Suppliers', href: '/restaurant/suppliers', icon: Truck, permission: 'inventory.suppliers.view', section: 'Inventory', vertical: 'RESTAURANT' },
  { label: 'Units', href: '/restaurant/units', icon: Ruler, permission: 'inventory.units.view', section: 'Inventory', vertical: 'RESTAURANT' },
  { label: 'Cuisines', href: '/restaurant/cuisines', icon: ChefHat, permission: 'cuisines.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Kitchens', href: '/restaurant/kitchens', icon: Soup, permission: 'kitchens.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Registers', href: '/restaurant/registers', icon: Calculator, permission: 'pos.registers.view', section: 'POS', vertical: 'RESTAURANT' },
  { label: 'Sessions', href: '/restaurant/sessions', icon: Wallet, permission: 'pos.sessions.view', section: 'POS', vertical: 'RESTAURANT' },
  { label: 'Cash movements', href: '/restaurant/cash-movements', icon: Wallet, permission: 'pos.cash-movement.view', section: 'POS', vertical: 'RESTAURANT' },
  { label: 'Users', href: '/restaurant/users', icon: UserCog, permission: 'users.view', section: 'People', vertical: 'RESTAURANT' },
  { label: 'Menus', href: '/restaurant/menus', icon: CalendarClock, permission: 'menu.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Items', href: '/restaurant/items', icon: UtensilsCrossed, permission: 'menu-items.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Modifiers', href: '/restaurant/modifiers', icon: Blocks, permission: 'menu-modifiers.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Options', href: '/restaurant/options', icon: SlidersHorizontal, permission: 'menu-options.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Categories', href: '/restaurant/categories', icon: ListTree, permission: 'menu-categories.view', section: 'Menu', vertical: 'RESTAURANT' },
  { label: 'Sales reasons', href: '/restaurant/reasons', icon: Ban, permission: 'sales.reasons.view', section: 'Setup', vertical: 'RESTAURANT' },
  { label: 'Roles', href: '/restaurant/roles', icon: ShieldCheck, permission: 'user-roles.view', section: 'People', vertical: 'RESTAURANT' },
  { label: 'Settings', href: '/restaurant/settings', icon: Settings, permission: 'settings.view', section: 'Setup', vertical: 'RESTAURANT' },

  { label: 'Retail', href: '/retail', icon: Shirt, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Catalogue', href: '/retail/catalogue', icon: Layers3, section: 'Retail', vertical: 'RETAIL' },
  { label: 'POS', href: '/retail/pos', icon: ShoppingBag, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Customers & Loyalty', href: '/retail/customers', icon: Contact, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Sales & Returns', href: '/retail/sales', icon: ReceiptText, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Shopify', href: '/retail/shopify', icon: Plug, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Finance & ERP', href: '/erp-finance', icon: Landmark, section: 'Retail', vertical: 'RETAIL' },
  { label: 'Accounting', href: '/accounting', icon: Receipt, permission: 'accounting.view', section: 'Retail', vertical: 'RETAIL' },

  // The whole section carried no permission, so the sidebar offered every screen
  // to every seat in a real-estate tenant, Viewer included — and the API agreed,
  // because it was unguarded too. realestate.view is the read key; the write
  // keys are enforced per route on the controllers. Matching and Marketing sit
  // on the sales key and Documents on its own, because title deeds and KYC are
  // not what a read seat is for.
  { label: 'Properties', href: '/properties', icon: Building, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Owners', href: '/owners', icon: Contact, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Site Visits', href: '/site-visits', icon: CalendarClock, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Matching', href: '/matching', icon: Sparkles, permission: 'realestate.sales', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Leases', href: '/leases', icon: FileText, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Complaints', href: '/complaints', icon: Wrench, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Maintenance', href: '/maintenance', icon: HardHat, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  // Finance is deliberately still open: /finance is a CROSS-VERTICAL service —
  // solar, commission, consulting and the hotel folio all go through it — so it
  // needs its own key family rather than a realestate.* one. Gating the menu
  // while the API stays open would be theatre, so both wait for that work.
  { label: 'Finance', href: '/finance', icon: Receipt, section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Accounting', href: '/accounting', icon: Landmark, permission: 'accounting.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Marketing', href: '/marketing', icon: Megaphone, permission: 'realestate.sales', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Surveys', href: '/re-surveys', icon: ClipboardList, permission: 'realestate.sales', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Automation', href: '/re-workflows', icon: Workflow, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE', product: 'OMNI' },
  { label: 'Documents', href: '/re-documents', icon: FolderOpen, permission: 'realestate.document', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Property Care', href: '/nmk-care', icon: ShieldCheck, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Task Maintenance', href: '/nmk-maintenance', icon: Wrench, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Location Master', href: '/nmk-locations', icon: HardHat, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },
  { label: 'Project Consulting', href: '/nmk-consulting', icon: Building2, permission: 'realestate.view', section: 'Real Estate', vertical: 'REAL_ESTATE' },


  // Hospitality — the receptionist's primary workflow for an 11-17 room residency.
  { label: 'Front Desk', href: '/front-desk', icon: Users2, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Reservations', href: '/reservations', icon: CalendarDays, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Rooms', href: '/rooms', icon: Key, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Guests', href: '/guests', icon: Contact, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Folios', href: '/folios', icon: Receipt, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Housekeeping', href: '/housekeeping', icon: ListChecks, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench, permission: 'hotel.view', section: 'Hospitality', vertical: 'HOTEL' },

  // Role-restricted Operations.
  { label: 'POS & F&B', href: '/pos', icon: ShoppingBag, permission: 'hotel.frontdesk', section: 'Operations', vertical: 'HOTEL' },
  { label: 'Booking Engine', href: '/booking', icon: Globe, permission: 'hotel.manage', section: 'Operations', vertical: 'HOTEL' },

  // Role-restricted Management & Reporting.
  { label: 'Finance & Accounts', href: '/erp', icon: Landmark, permission: 'hotel.finance', section: 'Management', vertical: 'HOTEL' },
  { label: 'Revenue & Reports', href: '/revenue', icon: LineChart, permission: 'hotel.manage', section: 'Management', vertical: 'HOTEL' },
  { label: 'Spa & Events', href: '/spa-events', icon: Sparkles, permission: 'hotel.view', section: 'Management', vertical: 'HOTEL' },

  // Engage is the omnichannel/marketing suite. It is not part of a broker's
  // day and an insurance tenant asked for it gone; every other vertical keeps it.
  // Team Inbox survives for hospitality — a residency answers guest messages —
  // but the marketing and automation surface below it does not belong in a
  // receptionist's sidebar. Thirteen Engage entries competing with the front
  // desk is the noise this vertical was asked to lose.
  // The group tier, above the companies. Deliberately NOT vertical-scoped: a
  // group holds companies in different businesses, which is the whole reason
  // it exists. `group.view` is an owner-level grant, so nobody else sees it,
  // and a company with no group lands on the page that explains what one is.
  { label: 'Group', href: '/group', icon: Layers3, permission: 'group.view', section: 'Administration' },

  // The shared operating substrate. Not vertical-scoped: a cost centre, a stock
  // location and a purchase order mean the same thing in every business, and
  // giving each vertical its own copy is exactly what this layer replaces.
  { label: 'Cost centres', href: '/cost-centers', icon: GitBranch, permission: 'costcenter.view', section: 'Finance' },
  { label: 'Stock', href: '/core-stock', icon: Boxes, permission: 'inventory.view', section: 'Finance' },
  { label: 'Procurement', href: '/procurement', icon: PackageCheck, permission: 'procurement.view', section: 'Finance' },

  { label: 'Team Inbox', href: '/inbox', icon: MessagesSquare, section: 'Engage', excludeVerticals: ['INSURANCE'] },
  { label: 'AI Copilot', href: '/copilot', icon: Sparkles, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Audience', href: '/audience', icon: Contact, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Campaigns', href: '/campaigns', icon: Megaphone, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Journeys', href: '/journeys', icon: Workflow, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Flows', href: '/flows', icon: Waypoints, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'AI Bots', href: '/ai-bots', icon: Bot, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Social', href: '/social', icon: Share2, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Commerce', href: '/commerce', icon: ShoppingBag, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Integrations', href: '/integrations', icon: Blocks, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Insights', href: '/insights', icon: LineChart, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Admin', href: '/omni-admin', icon: Wallet, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },
  { label: 'Channels', href: '/channels', icon: Plug, section: 'Engage', excludeVerticals: ['INSURANCE', 'HOTEL'] },

  { label: 'Students', href: '/students', icon: GraduationCap, permission: 'student.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Contacts', href: '/contacts', icon: Contact, permission: 'student.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Courses', href: '/courses', icon: BookOpen, permission: 'course.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Timetable', href: '/academics', icon: CalendarClock, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Course Content', href: '/content', icon: BookOpen, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Assessments', href: '/assessments', icon: FileText, section: 'Academics', vertical: 'INSTITUTE' },
  // Examinations. The backend shipped with eleven routes and no way in — no
  // page, no nav entry and (until the RBAC fix) no permission either.
  { label: 'Examinations', href: '/exams', icon: ClipboardCheck, permission: 'exam.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Gradebook', href: '/gradebook', icon: Award, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Session Plans', href: '/session-plans', icon: CalendarClock, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'OBE', href: '/obe', icon: Target, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Automation', href: '/automation', icon: RefreshCw, permission: 'academic.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Onboarding & Access', href: '/onboarding-access', icon: ClipboardCheck, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Fees', href: '/fees', icon: Wallet, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Finance & ERP', href: '/erp-finance', icon: Landmark, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Portal Accounts', href: '/portal-accounts', icon: UserCog, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Communication', href: '/communication', icon: Megaphone, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Library', href: '/library', icon: BookMarked, permission: 'library.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Alumni', href: '/alumni', icon: GraduationCap, permission: 'alumni.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Events & Fests', href: '/campus-events', icon: PartyPopper, permission: 'event.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Request Desk', href: '/rms', icon: LifeBuoy, permission: 'rms.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Certificates', href: '/certificates', icon: Award, section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Student Success', href: '/student-success', icon: Gauge, permission: 'academic.view', section: 'Academics', vertical: 'INSTITUTE' },
  { label: 'Placements', href: '/placements', icon: Briefcase, section: 'Academics', vertical: 'INSTITUTE' },

  { label: 'Tasks', href: '/tasks', icon: CheckSquare, permission: 'task.view', section: 'Workspace' },
  { label: 'Calendar', href: '/calendar', icon: Calendar, section: 'Workspace' },
  { label: 'Documents', href: '/documents', icon: FolderOpen, permission: 'document.view', section: 'Workspace' },
  // Document templates and the people documents are about. Not under
  // 'Consulting': the eleven templates include offer letters and experience
  // certificates, which are nobody's client work.
  { label: 'Templates', href: '/document-templates', icon: FileType2, permission: 'document.view', section: 'Workspace' },
  { label: 'People', href: '/employees', icon: UserRoundCheck, permission: 'hr.view', section: 'Workspace' },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view', section: 'Workspace', verticals: ['INSTITUTE', 'STUDY_ABROAD'] },

  { label: 'Users & Roles', href: '/users', icon: UserCog, permission: 'user.view', section: 'Admin' },
  { label: 'Organization', href: '/organization', icon: Building2, permission: 'org.view', section: 'Admin' },
  { label: 'Branding', href: '/branding', icon: Palette, permission: 'org.view', section: 'Admin' },
  { label: 'Onboarding Wizard', href: '/setup-wizard', icon: Blocks, permission: 'org.view', section: 'Admin' },
  { label: 'SaaS Billing', href: '/settings/billing', icon: Wallet, permission: 'org.view', section: 'Admin' },
  { label: 'App Marketplace', href: '/marketplace', icon: Blocks, permission: 'org.view', section: 'Admin' },
  { label: 'Developer Portal', href: '/developer-hub', icon: Key, permission: 'org.view', section: 'Admin' },
  { label: 'Audit Logs', href: '/settings/audit-logs', icon: Shield, permission: 'org.view', section: 'Admin' },
];

// Render order. A section with no visible items renders nothing, so a vertical's
// own section can sit near the top without disturbing anybody else's sidebar —
// Hospitality leads for a residency because Front Desk is the home screen, and
// is simply absent everywhere it has no items.
/**
 * The sidebar renders THESE sections, in this order, and nothing else.
 *
 * A section missing from this list is invisible however many entries carry it
 * and whatever permissions the user holds — `sidebar.tsx` maps over this array,
 * so an unlisted section is never asked about. `'Restaurant'` was missing, so
 * all nine restaurant entries were unreachable from navigation for a RESTAURANT
 * tenant with every permission granted. The pages answered fine if the URL was
 * typed, which is why nothing failed and nobody noticed.
 *
 * Adding a `section` to a NavItem is therefore only half of adding it to the
 * nav. Both halves, or neither.
 */
export const NAV_SECTIONS = ['Overview', 'Hospitality', 'Restaurant', 'Menu', 'Inventory', 'Seating', 'POS', 'People', 'Setup', 'Sales', 'Operations', 'Management', 'Members', 'Finance', 'Administration', 'Study Abroad', 'Digital Agency', 'Consulting', 'Consultant', 'Legal', 'Travel', 'Practice', 'Pharmacy', 'Used Car', 'Rental Car', 'Agent Portal', 'Solar', 'Retail', 'Real Estate', 'Engage', 'Academics', 'Workspace', 'More', 'Admin'];
