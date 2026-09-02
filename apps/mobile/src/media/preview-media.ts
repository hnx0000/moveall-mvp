// Preview artwork stays on this device. Live accounts use private signed media uploads.
const cache = new Map<string, string>();
const prefix = "groov-preview-media:";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("groov-preview-media-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("이미지 저장소를 열지 못했습니다. 브라우저 저장 공간을 확인해 주세요."));
  });
}
export async function savePreviewImage(id: string, uri: string): Promise<string> {
  const key = prefix + id;
  if (typeof indexedDB !== "undefined") {
    const blob = await (await fetch(uri)).blob();
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("images", "readwrite");
        tx.objectStore("images").put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () =>
          reject(new Error("이미지를 저장하지 못했습니다. 기기의 저장 공간을 확인해 주세요."));
      });
    } finally {
      db.close();
    }
  }
  cache.set(key, uri);
  return key;
}
export async function hydratePreviewImages(items: { mediaUrl?: string }[]) {
  const missing = items
    .map((item) => item.mediaUrl)
    .filter((key): key is string => Boolean(key?.startsWith(prefix) && !cache.has(key)));
  if (!missing.length || typeof indexedDB === "undefined") return;
  const db = await database();
  try {
    await Promise.all(
      missing.map(
        (key) =>
          new Promise<void>((resolve, reject) => {
            const request = db.transaction("images").objectStore("images").get(key);
            request.onsuccess = () => {
              if (request.result instanceof Blob)
                cache.set(key, URL.createObjectURL(request.result));
              resolve();
            };
            request.onerror = () => reject(new Error("저장한 이미지를 읽지 못했습니다."));
          }),
      ),
    );
  } finally {
    db.close();
  }
}
export function previewImageUri(uri: string | undefined) {
  return uri?.startsWith(prefix) ? cache.get(uri) : uri;
}
export async function deletePreviewImage(uri: string | undefined) {
  if (!uri?.startsWith(prefix)) return;
  const cached = cache.get(uri);
  if (cached?.startsWith("blob:")) URL.revokeObjectURL(cached);
  cache.delete(uri);
  if (typeof indexedDB === "undefined") return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").delete(uri);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
