/**
 * Typed access to `/api/restaurant/**`.
 *
 * TWO ENVELOPES, ON PURPOSE. The ported API answers with two different success
 * shapes and they disagree on the name of the flag (apps/api/src/restaurant/
 * common/rst-response.ts):
 *
 *   admin / tenant surface     { status: true,  message, data }
 *   captain / mobile surface   { success: true, message?, data }
 *   order writes               { success: true, message,  order }
 *
 * Released mobile clients read those keys, so the API cannot be flattened to one
 * shape and this file must not pretend it was. `unwrap` accepts either and reads
 * whichever flag is present, so a screen never has to know which surface it hit —
 * but a route that changes surface still cannot silently return `undefined`.
 *
 * Money is never formatted here. `fmtOrgMoney` resolves the org's real currency;
 * the Figma screens show USD on the phone and INR on the tablet, and neither is
 * a fact about a tenant. Tax labels come from `taxLabel()` for the same reason —
 * the designs hardcode a "Tax 5% / CGST 5% / GST 5%" stack that is not a real
 * regime anywhere, while Organization already carries country + taxRegime.
 */
import { api } from '@/lib/api';

/* ── envelopes ───────────────────────────────────────────────────────────── */

interface AdminEnvelope<T> { status: boolean; message?: string; data: T }
interface CaptainEnvelope<T> { success: boolean; message?: string; data: T }
type Envelope<T> = AdminEnvelope<T> | CaptainEnvelope<T>;

export class RestaurantApiError extends Error {
  constructor(message: string, readonly payload?: unknown) {
    super(message);
    this.name = 'RestaurantApiError';
  }
}

/**
 * Reads either envelope. A body carrying neither flag is a contract change, not
 * a value to pass along — several routes answer a bare array (the seating table
 * list does when `per_page` is absent), so that case is allowed explicitly
 * rather than by accident.
 */
function unwrap<T>(body: Envelope<T> | T): T {
  if (body && typeof body === 'object') {
    // Read as a loose record on purpose: an intersection of the two envelopes
    // declares BOTH flags, which makes `'status' in e` statically always true
    // and narrows the captain branch to `never`. The whole point is that only
    // one of the two keys is actually present at runtime.
    const e = body as Record<string, unknown>;
    const ok = 'status' in e ? e.status : 'success' in e ? e.success : undefined;
    if (ok === false) {
      throw new RestaurantApiError(
        typeof e.message === 'string' ? e.message : 'Request failed',
        body,
      );
    }
    if (ok === true) {
      // A THIRD envelope: the two order-writing routes answer
      // `{success, message, order}` — `order`, not `data`, and no `status`.
      // Reading `.data` here returns undefined and the caller sees a successful
      // write with an empty result, which is worse than an error.
      if (!('data' in e) && 'order' in e) return e.order as T;
      return e.data as T;
    }
  }
  return body as T;
}

const get = async <T>(url: string, params?: Record<string, unknown>) =>
  unwrap<T>((await api.get(url, { params })).data);
const post = async <T>(url: string, data?: unknown) => unwrap<T>((await api.post(url, data)).data);
const put = async <T>(url: string, data?: unknown) => unwrap<T>((await api.put(url, data)).data);
const patch = async <T>(url: string, data?: unknown) => unwrap<T>((await api.patch(url, data)).data);
const del = async <T>(url: string) => unwrap<T>((await api.delete(url)).data);

/**
 * The list routes answer a Laravel paginator when `per_page` is sent and a bare
 * array when it is not. Callers want rows either way.
 */
export interface Paginated<T> { data: T[]; total?: number; current_page?: number; last_page?: number; per_page?: number }
export const rows = <T>(r: Paginated<T> | T[] | null | undefined): T[] =>
  Array.isArray(r) ? r : (r?.data ?? []);

/**
 * Every page of a Laravel paginator, followed to the end.
 *
 * The list endpoints paginate at a HARDCODED ten and ignore `per_page` — that
 * is the source's behaviour and the port reproduces it. Screens that asked for
 * `per_page: 500` were not getting 500 rows on either system; they were getting
 * the first ten and believing otherwise. A restaurant with sixty menu items
 * would have shown ten, silently, with no page control to reveal it.
 *
 * `last_page` is the paginator's own answer to "how many are there", so this
 * follows it rather than guessing. The cap is a safety rail against a
 * misreported `last_page`, not a page budget: it is far above any real menu and
 * a hit is logged rather than passed off as the whole list.
 */
const RST_MAX_PAGES = 50;

export async function allPages<T>(
  fetchPage: (page: number) => Promise<Paginated<T> | T[]>,
): Promise<T[]> {
  const first = await fetchPage(1);
  if (Array.isArray(first)) return first;
  const out = [...(first.data ?? [])];
  const last = Math.min(first.last_page ?? 1, RST_MAX_PAGES);
  for (let p = 2; p <= last; p++) {
    const next = await fetchPage(p);
    out.push(...(Array.isArray(next) ? next : next.data ?? []));
  }
  if ((first.last_page ?? 1) > RST_MAX_PAGES) {
    console.warn(
      `[restaurant] paginator reported ${first.last_page} pages; stopped at ${RST_MAX_PAGES}.`,
    );
  }
  return out;
}

/**
 * FIELD NAMES ARE THE WIRE'S, NOT THE APP'S.
 *
 * The ported API answers in the SOURCE's shape — snake_case, because Laravel's
 * models serialise their columns and 87 read contracts are pinned to exactly
 * that. These interfaces used to declare `isActive`, `floorId`, `createdAt` and
 * friends, which the API has never sent: every screen reading one got
 * `undefined`, and TypeScript was happy because the lie was in the type.
 *
 * No camel-casing transform is applied on the way in, deliberately. A blanket
 * recursive rename would also rewrite keys inside payloads that are opaque
 * JSON — a notification's `data`, an item's `category_ids`, a pivot object —
 * and it would hide the wire shape from the developers who most need to see it.
 * The types tell the truth instead.
 */


/**
 * A decimal column, as it arrives.
 *
 * MySQL `decimal` serialises as a STRING through Laravel, and the port
 * reproduces that exactly — `rst-projection.ts` renders every decimal with its
 * declared scale, so `price` is `"12.00"` and `total` is `"13.20"`, never a
 * number. 87 read contracts are pinned to it.
 *
 * These were typed `number`, and the arithmetic that followed did this:
 *
 *     [{total: '12.00'}, {total: '12.00'}].reduce((s, o) => s + o.total, 0)
 *     → "012.0012.00"   → Math.round(...) → NaN
 *
 * Today's takings on the home screen and revenue, average order and top-item
 * revenue on reports all rendered `NaN` as soon as a single order existed. The
 * compiler could not see it because the type said `number`.
 *
 * The type now tells the truth, which turns every arithmetic site into a
 * compile error until it goes through `rstNum`. That is the point: the fix is
 * not a coercion sprinkled where someone remembered, it is a type that refuses
 * to be added up.
 */
export type RstDecimal = string | number | null;

/** Read a decimal column for arithmetic. Never use `+` on one directly. */
export const rstNum = (v: RstDecimal | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── seating ─────────────────────────────────────────────────────────────── */

export interface RstFloorRow { id: string; name: string; branch_id?: string | null; is_active?: boolean }
export interface RstZoneRow { id: string; name: string; floor_id?: string | null; is_active?: boolean }
export interface RstTableRow {
  id: string; name: string;
  /** A STRING column on RstTable, not an int — the create form posts it as one. */
  capacity: string | null;
  shape?: string | null; is_active?: boolean;
  floor_id?: string | null; zone_id?: string | null;
  floor?: { id: string; name: string } | null;
  zone?: { id: string; name: string } | null;
  /** Free text, constrained by the API to available|reserved|occupied|inactive. */
  status?: string | null;
  /**
   * RstTable has no "status changed at" column, so the captain grid's
   * time-in-status clock reads this. Honest for a table whose last write was
   * the status change, which is the common case.
   */
  updated_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  locked_by_user_id?: string | null;
  locked_until?: string | null;
  active_order?: Record<string, unknown> | null;
}
export interface RstMergeRow { id: string; name?: string | null; tables?: RstTableRow[] }

export const seating = {
  floors: (params?: Record<string, unknown>) =>
    get<Paginated<RstFloorRow> | RstFloorRow[]>('/restaurant/seating-plan/floors', params).then(rows),
  createFloor: (body: Partial<RstFloorRow>) => post<RstFloorRow>('/restaurant/seating-plan/floors', body),
  updateFloor: (id: string, body: Partial<RstFloorRow>) => put<RstFloorRow>(`/restaurant/seating-plan/floors/${id}`, body),
  removeFloor: (id: string) => del<unknown>(`/restaurant/seating-plan/floors/${id}`),

  zones: (params?: Record<string, unknown>) =>
    get<Paginated<RstZoneRow> | RstZoneRow[]>('/restaurant/seating-plan/zones', params).then(rows),
  createZone: (body: Partial<RstZoneRow>) => post<RstZoneRow>('/restaurant/seating-plan/zones', body),
  updateZone: (id: string, body: Partial<RstZoneRow>) => put<RstZoneRow>(`/restaurant/seating-plan/zones/${id}`, body),
  removeZone: (id: string) => del<unknown>(`/restaurant/seating-plan/zones/${id}`),

  tables: (params?: Record<string, unknown>) =>
    get<Paginated<RstTableRow> | RstTableRow[]>('/restaurant/seating-plan/tables', params).then(rows),
  table: (id: string) => get<RstTableRow>(`/restaurant/seating-plan/tables/${id}`),
  createTable: (body: Partial<RstTableRow>) => post<RstTableRow>('/restaurant/seating-plan/tables', body),
  updateTable: (id: string, body: Partial<RstTableRow>) => put<RstTableRow>(`/restaurant/seating-plan/tables/${id}`, body),
  removeTable: (id: string) => del<unknown>(`/restaurant/seating-plan/tables/${id}`),
  lockTable: (id: string, lock: boolean) => post<unknown>(`/restaurant/seating-plan/tables/${id}/lock`, { lock }),
  /**
   * Clear a table back to available with a reason. The admin PUT cannot do it —
   * it requires the whole TableRequest (name, shape, capacity) and has no
   * reason field — so this is the captain-app route built for exactly this.
   */
  cancelTable: (id: string, body: { cancellation_reason: string; clear_all_orders?: boolean }) =>
    post<RstTableRow>(`/restaurant/seating/tables/${id}/cancel`, body),
  tableFormData: () => get<Record<string, unknown>>('/restaurant/seating-plan/tables/form-data'),

  merges: (params?: Record<string, unknown>) =>
    get<Paginated<RstMergeRow> | RstMergeRow[]>('/restaurant/seating-plan/merges', params).then(rows),
  createMerge: (body: { tableIds?: string[]; [k: string]: unknown }) =>
    post<RstMergeRow>('/restaurant/seating-plan/merges', body),
  removeMerge: (id: string) => del<unknown>(`/restaurant/seating-plan/merges/${id}`),
  mergeFormData: () => get<Record<string, unknown>>('/restaurant/seating-plan/merges/form-data'),
};

/* ── menu ────────────────────────────────────────────────────────────────── */

/**
 * `itemsCount` used to be declared here and the list endpoint has never sent
 * it — `GET /menu/categories` returns id, name, parent_id, is_active, the image
 * appends and the timestamps, and nothing else. The two screens rendering it
 * have always rendered an empty string. Counting is done from the item list
 * those screens already hold; see `countByCategory`.
 */
export interface RstCategoryRow {
  id: string; name: string;
  is_active?: boolean;
  parent_id?: string | null;
}
/** A row of `menu_item_variations` — the RELATION, not the column. */
export interface RstItemVariation { id: string; name: string; price: RstDecimal }

export interface RstMenuItemRow {
  id: string; name: string; price?: RstDecimal; description?: string | null;
  image?: string | null; is_active?: boolean;
  menu_item_category_id?: string | null;
  categories?: RstCategoryRow[];
  /**
   * `variations` IS TWO DIFFERENT THINGS, decided by which endpoint answered.
   *
   * `MenuItem` declares BOTH a `varchar(255)` column named `variations`, cast
   * to `array`, AND a `hasMany` relation of the same name. Whichever is loaded
   * wins the key:
   *
   *   GET /menu/items, /menu/items/{item}   the COLUMN — `null` when unset.
   *                                         ProductController never eager-loads
   *                                         the relation.
   *   GET /get-items (captain)              the RELATION — `[]` when empty,
   *                                         because `with('variations')`.
   *
   * Verified against the running source: the admin detail answers `null` and
   * the captain list answers `[]` for the same item. Even "empty" is spelled
   * differently, so a component that treats the two as one type renders wrongly
   * on one of them.
   *
   * Typed as the union rather than resolved, because resolving it would mean
   * choosing which endpoint to be wrong about. Read it with a runtime check:
   * `Array.isArray(item.variations)`.
   */
  variations?: RstItemVariation[] | Record<string, unknown> | null;
  modifiers?: { id: string; name: string; price: RstDecimal }[];
  /** Round-tripped by the editor: an absent key CLEARS the stored image. */
  image_path?: string | null;
  /** The JSON column. `categories` is the pivot and is the reliable read. */
  category_ids?: string[] | null;
  /**
   * Recipe lines, as READ. The write contract renames both of the keys that
   * matter — `ingredient_id` becomes `ingredient` and `loss_pct` becomes
   * `lossPct` — so these cannot be sent back untouched.
   */
  ingredients?: {
    id?: string; ingredient_id?: string | null;
    quantity?: RstDecimal; loss_pct?: RstDecimal; note?: string | null;
  }[];
  /** SHOW only carries each option's `values`; the index does not. */
  options?: RstOptionRow[];
}

export interface RstItemFormData {
  categories: RstCategoryRow[];
  options: RstOptionRow[];
  option_types: { label: string; value: string }[];
}

/** `GET /menu/items/tax-assignment` — additive, no source counterpart. */
export interface RstItemTaxAssignment {
  available: { id: string; name: string; percentage: string; is_active: boolean }[];
  assigned: string[];
}

export const menu = {
  categories: (params?: Record<string, unknown>) =>
    get<Paginated<RstCategoryRow> | RstCategoryRow[]>('/restaurant/menu/categories', params).then(rows),
  createCategory: (body: Partial<RstCategoryRow>) => post<RstCategoryRow>('/restaurant/menu/categories', body),
  updateCategory: (id: string, body: Partial<RstCategoryRow>) => put<RstCategoryRow>(`/restaurant/menu/categories/${id}`, body),
  removeCategory: (id: string) => del<unknown>(`/restaurant/menu/categories/${id}`),

  items: (params?: Record<string, unknown>) =>
    get<Paginated<RstMenuItemRow> | RstMenuItemRow[]>('/restaurant/menu/items', params).then(rows),
  /** Every page. The endpoint paginates at ten and ignores `per_page`. */
  allItems: () => allPages<RstMenuItemRow>((page) =>
    get<Paginated<RstMenuItemRow> | RstMenuItemRow[]>('/restaurant/menu/items', { page })),
  item: (id: string) => get<RstMenuItemRow>(`/restaurant/menu/items/${id}`),
  searchActiveItems: (params?: Record<string, unknown>) =>
    get<Paginated<RstMenuItemRow> | RstMenuItemRow[]>('/restaurant/menu/items/search-active-items', params).then(rows),
  /**
   * The item's sales-tax assignment. ADDITIVE — the source's edit screen is
   * Inertia and eager-loads `item.taxes`; the REST surface has no equivalent,
   * and both item read contracts are PARITY_VERIFIED so neither may grow it.
   * Without this the assignment is write-only and every update clears it.
   */
  /** `GET /menu/items/form-data` — categories, shared option templates and the
   *  option-type vocabulary. Plan-capped: 403 when the item limit is reached. */
  itemsFormData: () => get<RstItemFormData>('/restaurant/menu/items/form-data'),
  itemTaxes: (itemId?: string) =>
    get<RstItemTaxAssignment>('/restaurant/menu/items/tax-assignment',
      itemId ? { item_id: itemId } : undefined),
  createItem: (body: Partial<RstMenuItemRow>) => post<RstMenuItemRow>('/restaurant/menu/items', body),
  updateItem: (id: string, body: Partial<RstMenuItemRow>) => put<RstMenuItemRow>(`/restaurant/menu/items/${id}`, body),
  removeItem: (id: string) => del<unknown>(`/restaurant/menu/items/${id}`),

  modifiers: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/menu/modifiers', params).then(rows),
  options: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/menu/options', params).then(rows),
};

/* ── orders ──────────────────────────────────────────────────────────────── */

export type RstOrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface RstOrderItemRow {
  id: string; menu_item_id?: string | null; name?: string | null;
  quantity: number; unit_price?: RstDecimal; total?: RstDecimal; line_total?: RstDecimal;
  image_path?: string | null; image_full_path?: string | null; image_url?: string | null;
  note?: string | null; status?: string | null;
}
export interface RstOrderRow {
  id: string; code?: string | null; reference_no?: string | null;
  status?: string | null;
  /**
   * `order_type`, which is the column. There was a `type` here and the wire has
   * never sent it — the reports screen grouped every order under "unknown"
   * because of it, on a chart whose whole purpose is the split.
   */
  order_type?: string | null;
  table_id?: string | null; table?: RstTableRow | null;
  customer_name?: string | null;
  subtotal?: RstDecimal; tax?: RstDecimal; total?: RstDecimal;
  tax_amount?: RstDecimal;
  discount_amount?: RstDecimal;
  payment_method?: string | null;
  payment_status?: string | null;
  kitchen_status?: string | null;
  notes?: string | null;
  branch_id?: string | null;
  customer_id?: string | null;
  customer_phone?: string | null;
  /**
   * The four relations `GET /orders` actually loads: branch, user, discount and
   * customer. `discount` is the DISCOUNT ROW, not the amount — the amount is
   * `discount_amount`, which is a different key and was easy to conflate.
   */
  branch?: RstBranchRow | null;
  user?: { id: string; name?: string | null } | null;
  discount?: { id: string; title?: string | null; value?: RstDecimal } | null;
  customer?: RstCustomerRow | null;
  created_at?: string | null;
  /**
   * Present on the SETTLE response and on the captain lists; ABSENT from
   * `GET /orders`, which loads branch, user, discount and customer — the
   * source's own relation set. Anything counting lines from the admin list gets
   * nothing, so do not add a column that depends on it.
   */
  items?: RstOrderItemRow[];
}

export interface OrderWriteItem {
  id: string; name: string; quantity: number; price: number;
}

export interface OrderWriteBody {
  /** Present means re-save: items are rebuilt and only the delta is charged. */
  order_id?: string | null;
  branch_id: string;
  /** Required by the settle path; defaults to `dine_in` on kot-and-print. */
  order_type?: string;
  /** Stored only when order_type is dine_in; discarded otherwise. */
  table_id?: string | null;
  customer_id?: string | null;
  payment_method?: string;
  discount_id?: string | null;
  /** Required on BOTH paths — an open POS session is a precondition. */
  session_id: string;
  items: OrderWriteItem[];
}

/** The `order` key of the third envelope. */
export interface OrderWriteResult { id: string; reference_no: string }

export const orders = {
  list: (params?: Record<string, unknown>) =>
    get<Paginated<RstOrderRow> | RstOrderRow[]>('/restaurant/orders', params).then(rows),
  /** Every page. The endpoint paginates at ten and ignores `per_page`. */
  allList: () => allPages<RstOrderRow>((page) =>
    get<Paginated<RstOrderRow> | RstOrderRow[]>('/restaurant/orders', { page })),
  byBranch: (params?: Record<string, unknown>) =>
    get<Paginated<RstOrderRow> | RstOrderRow[]>('/restaurant/orders/orders-by-branch', params).then(rows),
  show: (id: string) => get<RstOrderRow>(`/restaurant/orders/${id}`),
  /**
   * NOT `POST /restaurant/orders` — that route answers 500 BY DESIGN. It is
   * registered so the port reproduces the source's uncaught-error contract
   * rather than a 404, and calling it is always a mistake.
   *
   * Settle: writes the money and the transaction. Both `order_type` and
   * `payment_method` are REQUIRED here even though the shared DTO marks them
   * optional — the settle handler enforces them itself, because the source's
   * two endpoints have different rule sets.
   */
  saveAndPrint: (body: OrderWriteBody) =>
    post<OrderWriteResult>('/restaurant/orders/save-and-print', body),

  /**
   * Sends the ticket to the kitchen with the money left out. `order_type`
   * defaults to `dine_in` here and `payment_method` is nullable.
   */
  kotAndPrint: (body: OrderWriteBody) =>
    post<OrderWriteResult>('/restaurant/orders/kot-and-print', body),

  update: (id: string, body: Record<string, unknown>) => put<RstOrderRow>(`/restaurant/orders/${id}`, body),
  cancel: (id: string, body: Record<string, unknown>) => patch<RstOrderRow>(`/restaurant/orders/${id}/cancel-order`, body),
  cancelFormData: () => get<Record<string, unknown>>('/restaurant/orders/cancel-order/form-data'),
  printReceipt: (id: string) => get<{ html_content?: string; thermal_text?: string; [k: string]: unknown }>(`/restaurant/orders/${id}/print-receipt`),
  invoice: (id: string) => get<{ html_content?: string; invoice_no?: string; [k: string]: unknown }>(`/restaurant/orders/${id}/invoice`),
};

/* ── kitchen / KDS ───────────────────────────────────────────────────────── */

export const kitchen = {
  /** The in-house board. */
  view: (params?: Record<string, unknown>) => get<unknown>('/restaurant/kitchen-view', params),
  changeStatus: (body: Record<string, unknown>) =>
    patch<unknown>('/restaurant/kitchen-view/orders/change-status', body),

  /** The captain board — same tickets, aggregator columns (Swiggy / Zomato / own). */
  captainKds: (params?: Record<string, unknown>) => get<unknown>('/restaurant/captain/kds', params),
  captainChangeStatus: (id: string, body: Record<string, unknown>) =>
    patch<unknown>(`/restaurant/captain/kds/${id}/status`, body),
  captainDispatch: (id: string, body?: Record<string, unknown>) =>
    patch<unknown>(`/restaurant/captain/kds/${id}/dispatch`, body ?? {}),

  kitchens: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/kitchens', params).then(rows),
};

/* ── inventory ───────────────────────────────────────────────────────────── */

export interface RstIngredientRow {
  id: string; name: string; unit_id?: string | null;
  quantity?: RstDecimal;
  /**
   * THERE IS NO `threshold`. Not on the target model, not in
   * column-mapping.csv, and not on the source's `ingredients` table — it has
   * `stock` and `stock_movement_id` and nothing else.
   *
   * It was declared here and read by the inventory screen, so every ingredient
   * classified as "untracked" and both the "Needs attention" and "Out of stock"
   * tiles could only ever say zero. The nearest real concept is
   * `branches.low_stock_alerts`, a boolean toggle with no per-ingredient figure
   * behind it — the feature is unbuilt in the source, not lost in the port.
   */
  /** The wire sends the full unit, `symbol` and all — verified against the
   *  running target: `{id, name, symbol, type, short_name, precision}`. */
  unit?: { id: string; name: string; symbol?: string | null; type?: string | null } | null;
  /** Eager-loaded on the ingredients list, the same way suppliers carry theirs. */
  branch?: { id: string; name: string } | null;
  branch_id?: string | null;
  cost_per_unit?: RstDecimal;
  returnable?: boolean;
}

export const inventory = {
  ingredients: (params?: Record<string, unknown>) =>
    get<Paginated<RstIngredientRow> | RstIngredientRow[]>('/restaurant/inventory/ingredients', params).then(rows),
  createIngredient: (body: Partial<RstIngredientRow>) => post<RstIngredientRow>('/restaurant/inventory/ingredients', body),
  updateIngredient: (id: string, body: Partial<RstIngredientRow>) => put<RstIngredientRow>(`/restaurant/inventory/ingredients/${id}`, body),
  removeIngredient: (id: string) => del<unknown>(`/restaurant/inventory/ingredients/${id}`),
  units: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/inventory/units', params).then(rows),
  createUnit: (body: Record<string, unknown>) => post<RstUnitRow>('/restaurant/inventory/units', body),
  updateUnit: (id: string, body: Record<string, unknown>) => put<RstUnitRow>(`/restaurant/inventory/units/${id}`, body),
  removeUnit: (id: string) => del<unknown>(`/restaurant/inventory/units/${id}`),
  suppliers: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/inventory/suppliers', params).then(rows),
  createSupplier: (body: Record<string, unknown>) => post<RstSupplierRow>('/restaurant/inventory/suppliers', body),
  updateSupplier: (id: string, body: Record<string, unknown>) => put<RstSupplierRow>(`/restaurant/inventory/suppliers/${id}`, body),
  removeSupplier: (id: string) => del<unknown>(`/restaurant/inventory/suppliers/${id}`),
  purchases: (params?: Record<string, unknown>) =>
    get<Paginated<RstPurchaseRow> | RstPurchaseRow[]>('/restaurant/inventory/purchases', params).then(rows),
  purchase: (id: string) => get<RstPurchaseRow>(`/restaurant/inventory/purchases/${id}`),
  purchaseFormData: () => get<RstPurchaseFormData>('/restaurant/inventory/purchases/form-data'),
  createPurchase: (body: Record<string, unknown>) => post<RstPurchaseRow>('/restaurant/inventory/purchases', body),
  updatePurchase: (id: string, body: Record<string, unknown>) => put<RstPurchaseRow>(`/restaurant/inventory/purchases/${id}`, body),
  removePurchase: (id: string) => del<unknown>(`/restaurant/inventory/purchases/${id}`),
};

/* ── POS registers & sessions ────────────────────────────────────────────── */

export const pos = {
  registers: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/pos/register', params).then(rows),
  /**
   * `branch_id` is REQUIRED — `RegisterOptionsDto` refuses without it with
   * "Branch is required." This took no argument and could therefore only ever
   * 422; it has no callers yet, so the signature is corrected before one
   * arrives rather than after.
   */
  registerOptions: (branchId: string) =>
    get<unknown[]>('/restaurant/pos/registers', { branch_id: branchId }),
  sessions: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/pos/sessions', params).then(rows),
  openSession: (body: Record<string, unknown>) => post<unknown>('/restaurant/pos/sessions', body),
  closeSession: (id: string, body: Record<string, unknown>) => put<unknown>(`/restaurant/pos/sessions/${id}`, body),
  /**
   * ALWAYS AN EMPTY ARRAY. `GET /pos/cash-movement` is dead in the source and
   * the port preserves that, so this returns nothing however it is called. The
   * cash movements a screen actually wants are `posAdmin.cashMovements()`,
   * against `/restaurant/cash-movements` — a different route with a confusingly
   * similar name.
   */
  cashMovement: (params?: Record<string, unknown>) => get<unknown>('/restaurant/pos/cash-movement', params),
};

/* ── branches, people, settings, customers ───────────────────────────────── */

export interface RstBranchRow {
  id: string; name: string; code?: string | null;
  email?: string | null; phone?: string | null; address?: string | null;
  country_id?: string | null; currency_id?: string | null; time_zone_id?: string | null;
  registration_number?: string | null;
  order_type?: string[] | null; payment_method?: string[] | null;
  cash_difference_threshold?: RstDecimal;
  is_active?: boolean;
  /** Written by `PATCH /branches/inventory-setup`, not by create or update. */
  low_stock_alerts?: boolean;
  opening_time?: string | null; closing_time?: string | null;
}

/** What `GET /branches/form-data` returns. The message carries the source's typo. */
export interface RstBranchFormData {
  countries: { id: string; name: string; currency?: string | null }[];
  currencies: { id: string; currency: string }[];
  timezones: { id: string; name: string; label?: string | null }[];
  orderTypes: { name: string; value: string }[];
  paymentMethods: { name: string; value: string }[];
}

export const branches = {
  list: (params?: Record<string, unknown>) =>
    get<Paginated<RstBranchRow> | RstBranchRow[]>('/restaurant/branches', params).then(rows),
  searchActive: (params?: Record<string, unknown>) =>
    get<Paginated<RstBranchRow> | RstBranchRow[]>('/restaurant/branches/search-active-branches', params).then(rows),
  /**
   * 403s when the plan's branch cap is already reached — the source refuses at
   * the FORM, before anything is typed, so the screen surfaces that rather than
   * opening a drawer that cannot be saved.
   */
  formData: () => get<RstBranchFormData>('/restaurant/branches/form-data'),
  create: (body: Record<string, unknown>) => post<RstBranchRow>('/restaurant/branches', body),
  update: (id: string, body: Record<string, unknown>) => put<RstBranchRow>(`/restaurant/branches/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/branches/${id}`),
};

export const people = {
  users: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/users', params).then(rows),
  roles: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/roles', params).then(rows),
};

export const settings = {
  get: () => get<Record<string, unknown>>('/restaurant/settings'),
  updateGeneral: (body: Record<string, unknown>) => post<unknown>('/restaurant/settings/general', body),
  updateBilling: (body: Record<string, unknown>) => post<unknown>('/restaurant/settings/billing', body),
  payments: () => get<unknown>('/restaurant/settings/get-payments'),
};

export const customers = {
  list: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/customers', params).then(rows),
  search: (params?: Record<string, unknown>) =>
    get<Paginated<unknown> | unknown[]>('/restaurant/customers/search', params).then(rows),
  /** The paginator itself. `/customers` paginates at FIFTEEN and ignores
   *  `per_page`, so a screen that read `data` showed fifteen of any number. */
  page: (n: number) =>
    get<Paginated<RstCustomerRow>>('/restaurant/customers', { page: n }),
  create: (body: Record<string, unknown>) => post<RstCustomerRow>('/restaurant/customers', body),
  update: (id: string, body: Record<string, unknown>) => put<RstCustomerRow>(`/restaurant/customers/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/customers/${id}`),
};

export const restaurantApi = {
  seating, menu, orders, kitchen, inventory, pos, branches, people, settings, customers,
};

/* ── the domains the console manages ─────────────────────────────────────────
 *
 * Every shape below was read off the RUNNING API, not inferred from a model.
 * snake_case throughout, decimals as `RstDecimal`, and a relation is only typed
 * when the endpoint actually loads it — an `_id` with no object beside it means
 * the caller has to resolve the name itself.
 */

export interface RstCuisineRow {
  id: string; name: string; description?: string | null;
  /** `cuisines` and `kitchens` carry `status`, not `is_active`. Two spellings, one idea. */
  status?: boolean | null;
}
export interface RstKitchenRow {
  id: string; name: string; description?: string | null; status?: boolean | null;
  cuisines?: RstCuisineRow[];
}
export interface RstSupplierRow {
  id: string; name: string; email?: string | null; phone?: string | null;
  address?: string | null; branch_id?: string | null; branch?: RstBranchRow | null;
}
export interface RstUnitRow {
  id: string; name: string; symbol?: string | null; short_name?: string | null;
  type?: string | null; precision?: number | null;
}
export interface RstPurchaseFormData {
  branches: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  ingredients: { id: string; name: string }[];
}

/**
 * A purchase line. `quantity` is `@IsInt` on the way IN and a decimal string
 * `"3.00"` on the way OUT, so it has to be re-integered before it can be sent
 * back — see the note in the purchases screen.
 */
export interface RstPurchaseItemRow {
  id?: string; ingredient_id?: string | null;
  quantity?: RstDecimal; unit_cost?: RstDecimal;
}

export interface RstPurchaseRow {
  id: string; reference_no?: string | null; status?: string | null;
  branch_id?: string | null; supplier_id?: string | null; currency_id?: string | null;
  tax?: RstDecimal; discount?: RstDecimal; total?: RstDecimal;
  expected_date?: string | null; notes?: string | null;
  branch?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  /** SHOW only — the index carries the header and no lines. */
  items?: RstPurchaseItemRow[];
}
export interface RstServiceRow {
  id: string; name: string; description?: string | null; price?: RstDecimal;
  price_type?: string | null; duration?: string | null; is_active?: boolean;
  site_visibility?: string | null;
}
export interface RstDiscountRow {
  id: string; title?: string | null; discount_type?: string | null; value?: RstDecimal;
  is_active?: boolean; from_app?: boolean; apply_after_taxes?: boolean;
  require_passcode?: boolean; note?: string | null;
  /** All four are `required` on write, and all four come back nullable. */
  max_discount?: RstDecimal; min_spend?: RstDecimal; max_spend?: RstDecimal;
  start_date?: string | null; end_date?: string | null;
  usage_limit?: number | null; per_customer_limit?: number | null;
  times_used?: number;
  /**
   * The five JSON columns. `branch_id`, `category_id` and `product_id` are
   * arrays under singular names, and all five are null on a row written before
   * the column existed — hence the `?? []` at every read site.
   */
  branch_id?: string[] | null; category_id?: string[] | null; product_id?: string[] | null;
  order_type?: string[] | null; available_day?: string[] | null;
  /** `product_wise` | `bill_wise` — the source calls the scope `type`. */
  type?: string | null;
}
export interface RstMenuRow {
  id: string; name?: string | null; date?: string | null;
  starting_time?: string | null; ending_time?: string | null;
  is_all_day?: boolean; is_menu_status?: boolean; is_online_visibility?: boolean;
  image_url?: string | null;
  /** `withCount('menuItems')` on the INDEX only — the show route sends `menu_items`. */
  menu_items_count?: number;
  /** SHOW only. The index carries the count and no items at all. */
  menu_items?: { id: string; name?: string | null }[];
  branches?: { id: string; name: string }[];
}
export interface RstOptionValueRow {
  id: string; label?: string | null; price?: RstDecimal; price_type?: string | null;
  currency_id?: string | null;
}
export interface RstOptionRow {
  id: string; name: string; display_name?: string | null; type?: string | null;
  required?: boolean; branch_id?: string | null; values?: RstOptionValueRow[];
}
export interface RstModifierItemRow {
  id?: string; modifier_id?: string | null; name?: string | null; price?: RstDecimal;
}

export interface RstModifierRow {
  id: string; name: string; is_active?: boolean; branch_id?: string | null;
  /** The source calls a modifier's child rows `modifiers`; the READ says `items`. */
  items?: RstModifierItemRow[];
  /** The pivots, resolved to `{id, name}`. Both are CLEARED by an absent key. */
  menu_items?: { id: string; name: string }[];
  services?: { id: string; name: string }[];
}

export interface RstModifierFormData {
  branches: { id: string; name: string }[];
  menuItems: { id: string; name: string; branch_id?: string | null }[];
  services: { id: string; name: string }[];
}
export interface RstUserRow {
  id: string; name?: string | null; email?: string | null; status?: string | null;
  branch_id?: string | null; roles?: { id: string; name: string }[];
}
export interface RstRoleRow {
  id: string; name: string; guard_name?: string | null;
  permissions?: { id: string; name: string }[];
}
export interface RstCustomerRow {
  id: string; name?: string | null; first_name?: string | null; last_name?: string | null;
  email?: string | null; phone?: string | null; branch_id?: string | null;
  address?: string | null; city?: string | null; country_id?: string | null;
}
export interface RstRegisterRow {
  id: string; name: string; code?: string | null; status?: string | null;
  note?: string | null; branch_id?: string | null; branch?: RstBranchRow | null;
}
export interface RstSessionRow {
  id: string; status?: string | null; counter?: string | null;
  opened_at?: string | null; closed_at?: string | null;
  opened_by?: string | null; closed_by?: string | null;
  opening_float?: RstDecimal; declared_cash?: RstDecimal; notes?: string | null;
  branch?: string | null;
}
export interface RstCashMovementRow {
  id: string; direction?: string | null; reason?: string | null;
  amount?: RstDecimal; balance_before?: RstDecimal; balance_after?: RstDecimal;
  created_at?: string | null;
}
/**
 * THE LIST AND THE WRITE CONTRACT DISAGREE ON THE NAME OF THE NAME.
 *
 * `reasonListShape()` renames the `name` column to `reason` on the way out —
 * the source's Inertia payload does the same — while `ReasonDto` takes `name`
 * on both create and update, and `GET /sales/reasons/:id` answers with the raw
 * row, so THAT one carries `name` again. Both keys are declared because both
 * really occur; a screen must read `reason` from the list and send `name`.
 *
 * This previously declared a `type` field, which no endpoint has ever sent.
 */
export interface RstReasonRow {
  id: string;
  /** From the LIST route only. */
  reason?: string | null;
  /** From the SHOW route, and what every write contract expects. */
  name?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export const cuisines = {
  list: () => get<Paginated<RstCuisineRow> | RstCuisineRow[]>('/restaurant/cuisines').then(rows),
  create: (body: Partial<RstCuisineRow>) => post<RstCuisineRow>('/restaurant/cuisines', body),
  update: (id: string, body: Partial<RstCuisineRow>) => put<RstCuisineRow>(`/restaurant/cuisines/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/cuisines/${id}`),
  /**
   * The ONLY way to change a cuisine's status. `CuisineUpdateRequest::rules()`
   * validates `name` and `description` and nothing else, so a `status` sent to
   * PUT is dropped by `$request->validated()` and the row comes back unchanged
   * with a 200 — a silent no-op the target reproduces exactly.
   */
  toggleStatus: (id: string) => patch<RstCuisineRow>(`/restaurant/cuisines/${id}/toggle-status`),
};

export const kitchens = {
  list: () => get<Paginated<RstKitchenRow> | RstKitchenRow[]>('/restaurant/kitchens').then(rows),
  create: (body: Record<string, unknown>) => post<RstKitchenRow>('/restaurant/kitchens', body),
  update: (id: string, body: Record<string, unknown>) => put<RstKitchenRow>(`/restaurant/kitchens/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/kitchens/${id}`),
  /**
   * Unlike cuisines, `KitchenUpdateRequest` DOES accept `status`, so the edit
   * form can set it too. The source keeps both paths — a switch on the row and
   * a switch in the form — and so do we.
   */
  toggleStatus: (id: string) => patch<RstKitchenRow>(`/restaurant/kitchens/${id}/toggle-status`),
};

export const services = {
  list: () => get<Paginated<RstServiceRow> | RstServiceRow[]>('/restaurant/services').then(rows),
  create: (body: Record<string, unknown>) => post<RstServiceRow>('/restaurant/services', body),
  update: (id: string, body: Record<string, unknown>) => put<RstServiceRow>(`/restaurant/services/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/services/${id}`),
};

/**
 * What `GET /discounts/form-data` returns. Note `types` carries LOWERCASE
 * values (`amount`, `percentage`) built from `DiscountTypeConsts::LIST`, while
 * `DiscountStoreRequest` validates a hard-coded `Rule::in(['Percentage',
 * 'Amount'])`. The source's own dropdown feed therefore advertises two values
 * its own validator rejects — RST-PARITY-009 — so the console reads branches,
 * categories and products from here but does NOT read `types` from here.
 */
export interface RstDiscountFormData {
  scopes: { label: string; value: string }[];
  types: { label: string; value: string }[];
  branches: { id: string; name: string }[];
  orderTypes: { name: string; value: string }[];
  availableDays: { name: string; value: string }[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
}

export const discounts = {
  list: () => get<Paginated<RstDiscountRow> | RstDiscountRow[]>('/restaurant/discounts').then(rows),
  create: (body: Record<string, unknown>) => post<RstDiscountRow>('/restaurant/discounts', body),
  update: (id: string, body: Record<string, unknown>) => put<RstDiscountRow>(`/restaurant/discounts/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/discounts/${id}`),
  formData: () => get<RstDiscountFormData>('/restaurant/discounts/form-data'),
};

export const menus = {
  list: () => get<Paginated<RstMenuRow> | RstMenuRow[]>('/restaurant/menu/menus').then(rows),
  show: (id: string) => get<RstMenuRow>(`/restaurant/menu/menus/${id}`),
  create: (body: Record<string, unknown>) => post<RstMenuRow>('/restaurant/menu/menus', body),
  update: (id: string, body: Record<string, unknown>) => put<RstMenuRow>(`/restaurant/menu/menus/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/menu/menus/${id}`),
};

/** `GET /menu/options/form-data`. `price_types` OFFERS `Percentage`, which the
 *  write contract rejects — see the note on the options screen. */
export interface RstOptionFormData {
  branches: { id: string; name: string }[];
  types: { label: string; value: string }[];
  price_types: string[];
}

export const options = {
  list: () => get<Paginated<RstOptionRow> | RstOptionRow[]>('/restaurant/menu/options').then(rows),
  formData: () => get<RstOptionFormData>('/restaurant/menu/options/form-data'),
  create: (body: Record<string, unknown>) => post<RstOptionRow>('/restaurant/menu/options', body),
  update: (id: string, body: Record<string, unknown>) => put<RstOptionRow>(`/restaurant/menu/options/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/menu/options/${id}`),
};

export const modifiers = {
  list: () => get<Paginated<RstModifierRow> | RstModifierRow[]>('/restaurant/menu/modifiers').then(rows),
  formData: () => get<RstModifierFormData>('/restaurant/menu/modifiers/form-data'),
  create: (body: Record<string, unknown>) => post<RstModifierRow>('/restaurant/menu/modifiers', body),
  update: (id: string, body: Record<string, unknown>) => put<RstModifierRow>(`/restaurant/menu/modifiers/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/menu/modifiers/${id}`),
};

export interface RstRoleFormData {
  permissions: { id: string; name: string }[];
}

export const people2 = {
  users: () => get<Paginated<RstUserRow> | RstUserRow[]>('/restaurant/users').then(rows),
  roles: () => get<Paginated<RstRoleRow> | RstRoleRow[]>('/restaurant/roles').then(rows),
  roleFormData: () => get<RstRoleFormData>('/restaurant/roles/form-data'),
  /** Create works; update answers 500 in the source (RST-PARITY-018). */
  createRole: (body: Record<string, unknown>) => post<RstRoleRow>('/restaurant/roles', body),
  /**
   * One of only TWO user-management writes that work — create, update and patch
   * all answer 500. The first user of an organisation is protected and answers
   * 403 with Laravel's bare `{message}` body, which carries no `status` key
   * unlike every other error on that controller.
   */
  removeUser: (id: string) => del<unknown>(`/restaurant/users/${id}`),
};

export const posAdmin = {
  registers: () => get<Paginated<RstRegisterRow> | RstRegisterRow[]>('/restaurant/pos/register').then(rows),
  /** Create works. `status` is IGNORED here — a new register is always Active —
   *  and both update and delete answer 500 (RST-PARITY-018). */
  createRegister: (body: Record<string, unknown>) => post<RstRegisterRow>('/restaurant/pos/register', body),
  sessions: () => get<Paginated<RstSessionRow> | RstSessionRow[]>('/restaurant/pos/sessions').then(rows),
  cashMovements: (params?: Record<string, unknown>) =>
    get<Paginated<RstCashMovementRow> | RstCashMovementRow[]>('/restaurant/cash-movements', params).then(rows),
  /** Paginates at FIFTEEN, same trap as customers. */
  cashMovementsPage: (n: number) =>
    get<Paginated<RstCashMovementRow>>('/restaurant/cash-movements', { page: n }),
};

export interface RstReasonFormData { categories: string[] }

export const reasons = {
  list: () => get<Paginated<RstReasonRow> | RstReasonRow[]>('/restaurant/sales/reasons').then(rows),
  create: (body: Record<string, unknown>) => post<RstReasonRow>('/restaurant/sales/reasons', body),
  update: (id: string, body: Record<string, unknown>) => put<RstReasonRow>(`/restaurant/sales/reasons/${id}`, body),
  remove: (id: string) => del<unknown>(`/restaurant/sales/reasons/${id}`),
  formData: () => get<RstReasonFormData>('/restaurant/sales/reasons/form-data'),
};
