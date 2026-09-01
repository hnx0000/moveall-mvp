import type { MediaKind, MediaUploadTicket } from "@moveall/contracts";
import { randomUUID } from "node:crypto";
import { AppError } from "../domain/errors.js";

export type UploadRequest = {
  userId: string;
  kind: MediaKind;
  contentType: string;
};

export interface MediaStorage {
  readonly provider: "disabled" | "supabase";
  readonly bucket: string;
  createUploadTicket(request: UploadRequest): Promise<Omit<MediaUploadTicket, "mediaId">>;
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
