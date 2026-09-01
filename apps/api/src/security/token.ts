import { jwtVerify, SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../domain/errors.js";

export class TokenService {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async signAccessToken(userId: string, sessionId: string): Promise<string> {
    return new SignJWT({ sid: sessionId, token_use: "access" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const result = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
      if (
        !result.payload.sub ||
        typeof result.payload.sid !== "string" ||
        result.payload.token_use !== "access"
      ) {
        throw new Error("Missing access token claims");
      }
      return { userId: result.payload.sub, sessionId: result.payload.sid };
    } catch {
      throw new AppError(401, "AUTH_INVALID", "인증 정보가 유효하지 않습니다.");
    }
  }

  createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}
