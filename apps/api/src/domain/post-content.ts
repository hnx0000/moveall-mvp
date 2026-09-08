import {
  hasPostContentSource,
  POST_CONTENT_REQUIRED_MESSAGE,
  type PostCreateInput,
} from "@moveall/contracts";
import { AppError } from "./errors.js";

/** Apply only to a new write, after resolving any already-successful idempotent operation. */
export function requireNewFeedContent(input: PostCreateInput) {
  if (input.contentType !== "story" && !hasPostContentSource(input))
    throw new AppError(400, "POST_INPUT_NOT_CREATED", POST_CONTENT_REQUIRED_MESSAGE);
}
