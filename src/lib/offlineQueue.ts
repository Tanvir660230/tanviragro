export type OfflineMutationType = "weight-log" | "health-event" | "consumption" | "cost-entry";

export interface WeightLogPayload {
  type: "weight-log";
  cattle_id: string;
  weight_kg: number;
  recorded_at: string;
  notes?: string | null;
  girth_cm?: number | null;
  length_cm?: number | null;
}

export interface HealthEventPayload {
  type: "health-event";
  cattle_id: string;
  event_type: "vaccine" | "checkup" | "deworming" | "treatment" | "other";
  title: string;
  scheduled_at: string;
  notes?: string | null;
}

export interface ConsumptionPayload {
  type: "consumption";
  item_id: string;
  qty: number;
  cattle_id: string | null;
  notes?: string | null;
  recorded_at: string;
}

export interface CostEntryPayload {
  type: "cost-entry";
  cattle_id: string | null;
  category: string;
  amount: number;
  date: string;
  notes?: string | null;
}

export type OfflineMutationPayload =
  | WeightLogPayload
  | HealthEventPayload
  | ConsumptionPayload
  | CostEntryPayload;

export interface QueuedMutation {
  id: string;
  payload: OfflineMutationPayload;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
  createdAt: number;
  businessId?: string;
}

const DB_NAME = "tanvir-agro-offline";
const STORE = "mutations";
const VERSION = 2;

// In-memory store fallback for Node.js / SSR / Jest environments
const memoryQueue: Map<string, QueuedMutation> = new Map();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB is only available in browser environments."));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enqueue a new mutation for background or immediate synchronization
 */
export async function enqueue(
  payload: OfflineMutationPayload,
  businessId?: string
): Promise<QueuedMutation> {
  const mutation: QueuedMutation = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    payload,
    status: "pending",
    retryCount: 0,
    createdAt: Date.now(),
    businessId,
  };

  if (!isBrowser()) {
    memoryQueue.set(mutation.id, mutation);
    return mutation;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(mutation);
    tx.oncomplete = () => resolve(mutation);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueued(): Promise<QueuedMutation[]> {
  if (!isBrowser()) {
    return Array.from(memoryQueue.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const items = (req.result as QueuedMutation[]) || [];
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateMutationStatus(
  id: string,
  status: "pending" | "syncing" | "failed",
  errorMsg?: string
): Promise<void> {
  if (!isBrowser()) {
    const item = memoryQueue.get(id);
    if (item) {
      item.status = status;
      if (status === "failed") {
        item.retryCount += 1;
        item.lastError = errorMsg;
      }
      memoryQueue.set(id, item);
    }
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as QueuedMutation | undefined;
      if (!item) {
        resolve();
        return;
      }
      item.status = status;
      if (status === "failed") {
        item.retryCount += 1;
        item.lastError = errorMsg;
      }
      store.put(item);
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueued(id: string): Promise<void> {
  if (!isBrowser()) {
    memoryQueue.delete(id);
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countQueued(): Promise<number> {
  if (!isBrowser()) {
    return memoryQueue.size;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue(): Promise<void> {
  if (!isBrowser()) {
    memoryQueue.clear();
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

