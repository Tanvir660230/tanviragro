const DB_NAME = "tanvir-agro-offline";
const STORE = "mutations";
const VERSION = 1;

export type WeightLogPayload = {
  type: "weight-log";
  cattle_id: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
  girth_cm: number | null;
  length_cm: number | null;
};

export type ConsumptionPayload = {
  type: "consumption";
  item_id: string;
  qty: number;
  cattle_id: string | null;
  notes: string | null;
  recorded_at: string;
};

export type QueuedMutation = (WeightLogPayload | ConsumptionPayload) & {
  id: string;
  createdAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(
  payload: WeightLogPayload | ConsumptionPayload
): Promise<void> {
  const db = await openDB();
  const record: QueuedMutation = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueued(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedMutation[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueued(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countQueued(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
