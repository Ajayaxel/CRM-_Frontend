/**
 * The coworking console uses the platform design-system kit rather than a
 * second copy of it. Re-exported through one module so a screen imports from
 * `../ui/kit` like every other feature, and so the day the kit moves out of
 * features/insurance there is exactly one import path to change.
 */
export {
  Avatar, BarChart, BarList, Badge, Card, DataTable, Drawer, EmptyState, EntityIcon,
  Field, FilterChips, FormSection, Modal, QuickActions, SectionTitle, Segmented,
  Skeleton, Sparkline, StatCard, Status, Stepper, Timeline, Toolbar,
  TONE, humanStatus, useIsNarrow,
} from '@/features/verticals/insurance/insurance/ui/kit';
export type { DataTableColumn, Tone } from '@/features/verticals/insurance/insurance/ui/kit';
