/**
 * The hospitality console uses the platform design-system kit rather than a
 * second copy of it — same reasoning as the coworking console, and the same
 * single import path to change the day the kit moves out of features/insurance.
 */
export {
  Avatar, BarList, Badge, Card, DataTable, Drawer, EmptyState, EntityIcon,
  Field, FilterChips, FormSection, Modal, SectionTitle, Segmented,
  Skeleton, StatCard, Status, Toolbar, TONE, humanStatus, useIsNarrow,
} from '@/features/verticals/insurance/insurance/ui/kit';
export type { DataTableColumn, Tone } from '@/features/verticals/insurance/insurance/ui/kit';
export { PageHead, fmtDate, money, toDateInput } from '@/features/verticals/coworking/coworking/ui/common';
