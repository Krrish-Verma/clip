export type Draft = {
  id: string;
  owner: string;
  mime: string;
  title: string;
  seconds: number;
  videoId?: string;
  savedAt: number;
};
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("clip-recordings", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("meta", { keyPath: "owner" });
      request.result.createObjectStore("chunks");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, done: (value: T) => void) => void,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    work(tx, (value) => {
      result = value;
    });
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Draft storage was interrupted."));
    };
  });
}
export async function saveDraft(draft: Draft, chunk?: Blob, index?: number) {
  return transaction<void>(["meta", "chunks"], "readwrite", (tx, done) => {
    tx.objectStore("meta").put(draft);
    if (chunk) tx.objectStore("chunks").put(chunk, [draft.id, index!]);
    done();
  });
}
export async function readDraft(
  owner: string,
): Promise<{ draft: Draft; blob: Blob } | null> {
  return transaction(["meta", "chunks"], "readonly", (tx, done) => {
    const meta = tx.objectStore("meta").get(owner);
    meta.onsuccess = () => {
      const draft = meta.result as Draft | undefined;
      if (!draft) {
        done(null);
        return;
      }
      const chunks = tx
        .objectStore("chunks")
        .getAll(
          IDBKeyRange.bound([draft.id, 0], [draft.id, Number.MAX_SAFE_INTEGER]),
        );
      chunks.onsuccess = () =>
        done({ draft, blob: new Blob(chunks.result, { type: draft.mime }) });
    };
  });
}
export async function deleteDraft(owner: string) {
  return transaction<void>(["meta", "chunks"], "readwrite", (tx, done) => {
    const meta = tx.objectStore("meta").get(owner);
    meta.onsuccess = () => {
      if (meta.result) {
        tx.objectStore("chunks").delete(
          IDBKeyRange.bound(
            [meta.result.id, 0],
            [meta.result.id, Number.MAX_SAFE_INTEGER],
          ),
        );
        tx.objectStore("meta").delete(owner);
      }
      done();
    };
  });
}
