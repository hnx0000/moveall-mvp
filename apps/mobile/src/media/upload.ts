import type { MediaKind } from "@moveall/contracts";
import * as ImageManipulator from "expo-image-manipulator";
import { ApiError, api } from "../api/client";

export async function uploadMediaAsset(input: {
  token: string;
  uri: string;
  kind: MediaKind;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  byteSize: number;
}): Promise<{ mediaId: string; objectPath: string }> {
  let uploadUri = input.uri;
  if (input.contentType !== "video/mp4") {
    const format =
      input.contentType === "image/png"
        ? ImageManipulator.SaveFormat.PNG
        : input.contentType === "image/webp"
          ? ImageManipulator.SaveFormat.WEBP
          : ImageManipulator.SaveFormat.JPEG;
    const sanitized = await ImageManipulator.manipulateAsync(input.uri, [], {
      compress: 0.92,
      format,
    });
    uploadUri = sanitized.uri;
  }
  const source = await fetch(uploadUri);
  if (!source.ok) throw new ApiError("선택한 파일을 읽지 못했습니다.", "MEDIA_READ_FAILED");
  const body = await source.blob();
  const ticket = await api.createMediaUploadTicket(input.token, {
    kind: input.kind,
    contentType: input.contentType,
    byteSize: body.size,
  });
  const uploaded = await fetch(ticket.signedUploadUrl, {
    method: "PUT",
    headers: {
      "content-type": input.contentType,
      "cache-control": "private, max-age=900",
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
