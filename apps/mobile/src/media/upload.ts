import type { MediaKind } from "@moveall/contracts";
import { ApiError, api } from "../api/client";

export async function uploadMediaAsset(input: {
  token: string;
  uri: string;
  kind: MediaKind;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  byteSize: number;
}): Promise<{ mediaId: string; objectPath: string }> {
  const ticket = await api.createMediaUploadTicket(input.token, {
    kind: input.kind,
    contentType: input.contentType,
    byteSize: input.byteSize,
  });
  const source = await fetch(input.uri);
  if (!source.ok) throw new ApiError("선택한 파일을 읽지 못했습니다.", "MEDIA_READ_FAILED");
  const body = await source.blob();
  const uploaded = await fetch(ticket.signedUploadUrl, {
    method: "PUT",
    headers: {
      "content-type": input.contentType,
      "cache-control": "max-age=3600",
      "x-upsert": "false",
    },
    body,
  });
  if (!uploaded.ok) {
    throw new ApiError("사진·영상 업로드에 실패했습니다.", "MEDIA_UPLOAD_FAILED");
  }
  const completed = await api.completeMediaUpload(input.token, ticket.mediaId);
  return { mediaId: completed.id, objectPath: completed.objectPath };
}
