import type { MediaKind, MediaUploadTicket } from "@moveall/contracts";
import { randomUUID } from "node:crypto";
import { AppError } from "../domain/errors.js";

export type UploadRequest = {
  userId: string;
  kind: MediaKind;
  contentType: string;
};

export type StoredObjectMetadata = {
  contentType: string | null;
  byteSize: number | null;
};

export interface MediaStorage {
  readonly provider: "disabled" | "supabase";
  readonly bucket: string;
  createUploadTicket(request: UploadRequest): Promise<Omit<MediaUploadTicket, "mediaId">>;
  createDownloadUrl(objectPath: string): Promise<string | null>;
  inspectObject(objectPath: string): Promise<StoredObjectMetadata | null>;
  removeObject(objectPath: string): Promise<void>;
}

export class DisabledMediaStorage implements MediaStorage {
  readonly provider = "disabled" as const;
  readonly bucket = "";

  async createUploadTicket(): Promise<never> {
    throw new AppError(
      503,
      "MEDIA_STORAGE_NOT_CONFIGURED",
      "사진·영상 저장소가 아직 연결되지 않았습니다.",
    );
  }

  async createDownloadUrl(): Promise<null> {
    return null;
  }

  async inspectObject(): Promise<null> {
    return null;
  }

  async removeObject(): Promise<void> {}
}

export class SupabaseMediaStorage implements MediaStorage {
  readonly provider = "supabase" as const;

  constructor(
    private readonly projectUrl: string,
    private readonly serviceRoleKey: string,
    readonly bucket: string,
  ) {}

  async createUploadTicket(request: UploadRequest): Promise<Omit<MediaUploadTicket, "mediaId">> {
    const objectPath = `${request.userId}/${request.kind}/${randomUUID()}.${extensionFor(request.contentType)}`;
    const endpoint = `${this.storageUrl}/object/upload/sign/${this.bucket}/${objectPath}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.headers,
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; message?: string };
    if (!response.ok || !payload.url) {
      throw new AppError(
        502,
        "MEDIA_UPLOAD_TICKET_FAILED",
        "업로드 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return {
      objectPath,
      signedUploadUrl: payload.url.startsWith("http")
        ? payload.url
        : `${this.storageUrl}${payload.url.startsWith("/") ? "" : "/"}${payload.url}`,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
  }

  async inspectObject(objectPath: string): Promise<StoredObjectMetadata | null> {
    const response = await fetch(`${this.storageUrl}/object/${this.bucket}/${objectPath}`, {
      method: "HEAD",
      headers: this.headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new AppError(502, "MEDIA_INSPECTION_FAILED", "업로드 파일 검증에 실패했습니다.");
    }
    const byteSize = Number(response.headers.get("content-length"));
    const declaredType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
    const content = await fetch(`${this.storageUrl}/object/${this.bucket}/${objectPath}`, {
      headers: { ...this.headers, range: "bytes=0-63" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!content.ok || !content.body) {
      throw new AppError(502, "MEDIA_INSPECTION_FAILED", "업로드 파일 검증에 실패했습니다.");
    }
    const reader = content.body.getReader();
    const prefix = new Uint8Array(64);
    let length = 0;
    try {
      while (length < prefix.length) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const bytes = chunk.value.subarray(0, prefix.length - length);
        prefix.set(bytes, length);
        length += bytes.length;
      }
    } finally {
      await reader.cancel();
    }
    const detectedType = detectMediaContentType(prefix.subarray(0, length));
    return {
      contentType: detectedType === declaredType ? detectedType : null,
      byteSize: Number.isFinite(byteSize) && byteSize >= 0 ? byteSize : null,
    };
  }

  async removeObject(objectPath: string): Promise<void> {
    const response = await fetch(`${this.storageUrl}/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers,
      body: JSON.stringify({ prefixes: [objectPath] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 404) {
      throw new AppError(502, "MEDIA_DELETE_FAILED", "미디어 파일 삭제에 실패했습니다.");
    }
  }

  async createDownloadUrl(objectPath: string): Promise<string | null> {
    const response = await fetch(`${this.storageUrl}/object/sign/${this.bucket}/${objectPath}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ expiresIn: 15 * 60 }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signedPath = payload.signedURL ?? payload.signedUrl;
    if (!response.ok || !signedPath) return null;
    return signedPath.startsWith("http")
      ? signedPath
      : `${this.storageUrl}${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
  }

  private get storageUrl(): string {
    return `${this.projectUrl.replace(/\/$/, "")}/storage/v1`;
  }

  private get headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
      "content-type": "application/json",
    };
  }
}

export function detectMediaContentType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
  ) {
    return "image/png";
  }
  const ascii = new TextDecoder("ascii").decode(bytes);
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (
    ascii.slice(4, 8) === "ftyp" &&
    ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(ascii.slice(8, 12))
  ) {
    return "video/mp4";
  }
  return null;
}

function extensionFor(contentType: string): string {
  return (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
    }[contentType] ?? "bin"
  );
}
