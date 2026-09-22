import { api } from '@/lib/api';
import { fmtOrgMoney } from '@/lib/org-locale';

/** Money renders through the org locale — AED for a Gulf boutique, rupees for India. */
export const money = (n?: number | null) => fmtOrgMoney(n);

export interface VariantStockRow { id: string; branchId: string; onHand: number; reserved: number; branch?: { id: string; name: string; code: string } }
export interface VariantRow {
  id: string; colour: string | null; size: string | null; sku: string | null; barcode: string | null;
  priceInr: number; active: boolean; stock: VariantStockRow[];
}
export interface StyleRow {
  id: string; name: string; category: string | null; handle: string | null; active: boolean;
  archivedAt: string | null; variants: VariantRow[];
}
export interface BranchRow { id: string; name: string; code: string; isMain: boolean }
export interface RetailCustomerRow {
  id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null;
  source: string; mergeReview: boolean; loyalty?: { pointsBalance: number; lifetimePoints: number; tier: string } | null;
  _count?: { sales: number };
}
export interface SaleLineRow { id: string; description: string; quantity: number; unitPriceInr: number; totalInr: number; variantId: string | null }
export interface SaleRow {
  id: string; code: string; source: string; status: string; externalOrderNo: string | null;
  subtotalInr: number; discountInr: number; taxInr: number; shippingInr: number; totalInr: number;
  placedAt: string; fulfillmentStatus: string | null;
  customer?: { id: string; firstName: string; lastName: string | null } | null;
  branch?: { name: string; code: string } | null;
  lines: SaleLineRow[];
  returns: { id: string; kind: string; refundInr: number; createdAt: string }[];
}
export interface ShopifyStatus {
  connected: boolean; credentialsPresent: boolean; shopDomain: string | null; status: string;
  installedAt: string | null; catalogueMaster: string; unmatchedSkus: number;
  queue: { pendingEvents: number; deadEvents: number; pendingPushes: number; deadPushes: number };
  lastImport: { status: string; startedAt: string; finishedAt: string | null; stats: Record<string, number> | null; error: string | null } | null;
  lastReconcile: { status: string; startedAt: string; finishedAt: string | null; stats: Record<string, number> | null; error: string | null } | null;
  synced: Record<string, number>;
}
export interface UnmatchedRow {
  id: string; externalVariantId: string; styleTitle: string; variantTitle: string | null;
  sku: string | null; barcode: string | null; reason: string; createdAt: string;
}
export interface LocationRow { shopifyLocationId: string; name: string; mappedBranch: { id: string; name: string; code: string } | null }

export const retailApi = {
  dashboard: () => api.get<any>('/retail/dashboard').then((r) => r.data),
  settings: () => api.get<{ earnRatePer100: number }>('/retail/settings').then((r) => r.data),
  branches: () => api.get<BranchRow[]>('/retail/branches').then((r) => r.data),
  styles: (q?: string) => api.get<StyleRow[]>(`/retail/styles${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.data),
  customers: (q?: string) => api.get<RetailCustomerRow[]>(`/retail/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.data),
  customer: (id: string) => api.get<any>(`/retail/customers/${id}`).then((r) => r.data),
  sales: (source?: string) => api.get<SaleRow[]>(`/retail/sales${source ? `?source=${source}` : ''}`).then((r) => r.data),
  shopifyStatus: () => api.get<ShopifyStatus>('/integrations/shopify/status').then((r) => r.data),
  unmatched: () => api.get<UnmatchedRow[]>('/integrations/shopify/unmatched').then((r) => r.data),
  locations: () => api.get<{ locations: LocationRow[]; branches: BranchRow[] }>('/integrations/shopify/locations').then((r) => r.data),
};

export const custName = (c?: { firstName: string; lastName: string | null } | null) =>
  c ? `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}` : 'Walk-in';

export const SALE_STATUS_META: Record<string, { fg: string; bg: string }> = {
  COMPLETED: { fg: '#1e874b', bg: 'rgba(30,135,75,.12)' },
  PENDING: { fg: '#b8791f', bg: 'rgba(230,162,60,.14)' },
  CANCELLED: { fg: '#c0392b', bg: 'rgba(192,57,43,.12)' },
  REFUNDED: { fg: '#c0392b', bg: 'rgba(192,57,43,.12)' },
  PARTIALLY_REFUNDED: { fg: '#b8791f', bg: 'rgba(230,162,60,.14)' },
};
