import type { MediaKind } from "@moveall/contracts";
import * as ImageManipulator from "expo-image-manipulator";
import { ApiError, api } from "../api/client";
import type { AttemptStage } from "../api/mutation-attempt";

export async function uploadMediaAsset(input: {
  token: string;
  uri: string;
  kind: MediaKind;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  byteSize: number;
  stage?: AttemptStage;
  isCurrent?: () => boolean;
}): Promise<{ mediaId: string; objectPath: string }> {
  const stage: AttemptStage = input.stage ?? (async (_name, action) => action());
  const check = () => {
    if (input.isCurrent && !input.isCurrent())
      throw new ApiError("계정이 변경되어 업로드를 중지했습니다.", "OPERATION_CANCELLED");
  };
  check();
  let uploadUri = input.uri;
  if (input.contentType !== "video/mp4") {
    const format =
      input.contentType === "image/png"
        ? ImageManipulator.SaveFormat.PNG
        : input.contentType === "image/webp"
          ? ImageManipulator.SaveFormat.WEBP
          : ImageManipulator.SaveFormat.JPEG;
    const sanitized = await stage("media-sanitized", () =>
      ImageManipulator.manipulateAsync(input.uri, [], {
        compress: 0.92,
        format,
      }),
    );
    check();
    uploadUri = sanitized.uri;
  }
  const body = await stage("media-body", async () => {
    const source = await fetch(uploadUri);
    if (!source.ok) throw new ApiError("선택한 파일을 읽지 못했습니다.", "MEDIA_READ_FAILED");
    return source.blob();
  });
  check();
  const ticketState = await stage("media-generation", async () => ({ value: 0 }));
  const suffix = String(ticketState.value);
  const ticket = await stage("media-ticket-" + suffix, () =>
    api.createMediaUploadTicket(input.token, {
      kind: input.kind,
      contentType: input.contentType,
      byteSize: body.size,
    }),
  );
  check();
  await stage("media-upload-" + suffix, async () => {
    const marker = await stage("media-put-marker-" + suffix, async () => ({ started: false }));
    if (marker.started) {
      try {
        await api.completeMediaUpload(input.token, ticket.mediaId);
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "MEDIA_VALIDATION_FAILED") throw error;
      }
    }
    check();
    if (Date.parse(ticket.expiresAt) <= Date.now()) {
      ticketState.value += 1;
      throw new ApiError(
        "업로드 시간이 만료되었습니다. 다시 누르면 새 업로드로 준비합니다.",
        "MEDIA_TICKET_EXPIRED",
      );
    }
    marker.started = true;
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
  });
  check();
  const completed = await stage("media-complete-" + suffix, () =>
    api.completeMediaUpload(input.token, ticket.mediaId),
  );
  return { mediaId: completed.id, objectPath: completed.objectPath };
}
