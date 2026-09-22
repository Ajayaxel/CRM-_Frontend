/**
 * E6 — the installer's offline mutation queue.
 *
 * Crews work on roofs with no signal. Every action a crew takes is written to IndexedDB
 * first and replayed to the API when the connection returns, so a tick, a photo or a
 * sign-off is never lost because the phone dropped to no bars mid-job.
 *
 * Ordering matters: checklist ticks must land before the completion that depends on
 * them, so the queue is strictly FIFO and stops at the first item that fails for a
 * reason worth retrying.
 */

const DB_NAME = 'bmn-installer';
const DB_VERSION = 1;
const QUEUE = 'queue';
const CACHE = 'cache';

export type QueuedOp =
  | { kind: 'tick'; checklistItemId: string; done: boolean; note?: string }
  | { kind: 'complete'; workOrderId: string; safetySignedBy: string; report: string; photos: string[] };

export interface QueuedItem {
  id: string;
  op: QueuedOp;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function enqueue(op: QueuedOp): Promise<QueuedItem> {
  const item: QueuedItem = { id: newId(), op, queuedAt: Date.now(), attempts: 0 };
  await tx(QUEUE, 'readwrite', (s) => s.put(item));
  return item;
}

export async function pending(): Promise<QueuedItem[]> {
  const all = await tx<QueuedItem[]>(QUEUE, 'readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function pendingCount(): Promise<number> {
  return (await pending()).length;
}

async function remove(id: string) {
  await tx(QUEUE, 'readwrite', (s) => s.delete(id));
}
async function markFailed(item: QueuedItem, error: string) {
  await tx(QUEUE, 'readwrite', (s) => s.put({ ...item, attempts: item.attempts + 1, lastError: error }));
}

/** Cache the work-order list so the app opens with real data offline. */
export async function cacheWorkOrders(projectKey: string, data: unknown) {
  await tx(CACHE, 'readwrite', (s) => s.put({ key: `wo:${projectKey}`, data, at: Date.now() }));
}
export async function readCachedWorkOrders<T>(projectKey: string): Promise<{ data: T; at: number } | null> {
  const row = await tx<any>(CACHE, 'readonly', (s) => s.get(`wo:${projectKey}`));
  return row ? { data: row.data as T, at: row.at } : null;
}

export interface FlushResult { sent: number; failed: number; remaining: number; errors: string[] }

/**
 * Replay the queue. `send` performs one API call and must throw to signal failure.
 *
 * A 4xx means the server rejected the operation outright — retrying forever would jam
 * the queue behind a permanently bad item, so it is dropped and reported. Anything
 * else (offline, 5xx) is left in place to try again.
 */
export async function flush(send: (op: QueuedOp) => Promise<void>): Promise<FlushResult> {
  const items = await pending();
  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      await send(item.op);
      await remove(item.id);
      sent++;
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? 'Sync failed';
      if (typeof status === 'number' && status >= 400 && status < 500) {
        // Permanently rejected — drop it rather than block everything behind it.
        await remove(item.id);
        failed++;
        errors.push(Array.isArray(msg) ? msg.join('; ') : String(msg));
        continue;
      }
      await markFailed(item, String(msg));
      // Still offline or the server is down: stop, keep order, try again later.
      break;
    }
  }
  return { sent, failed, remaining: await pendingCount(), errors };
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);
