import { describe, expect, it } from "vitest";
import { detectMediaContentType } from "../src/infrastructure/media-storage.js";

describe("media file signatures", () => {
  it("recognizes supported image signatures", () => {
    expect(detectMediaContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      detectMediaContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(detectMediaContentType(new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
  });

  it("recognizes MP4 containers and rejects disguised text", () => {
    expect(detectMediaContentType(new TextEncoder().encode("1234ftypmp42"))).toBe("video/mp4");
    expect(
      detectMediaContentType(new TextEncoder().encode("<html>not an image</html>")),
    ).toBeNull();
    expect(detectMediaContentType(new Uint8Array())).toBeNull();
  });
});
