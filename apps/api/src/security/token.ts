import { jwtVerify, SignJWT } from "jose";
import { AppError } from "../domain/errors.js";

export class TokenService {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async sign(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(this.secret);
  }

  async verify(token: string): Promise<string> {
    try {
      const result = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
      if (!result.payload.sub) throw new Error("Missing subject");
      return result.payload.sub;
    } catch {
      throw new AppError(401, "AUTH_INVALID", "인증 정보가 유효하지 않습니다.");
    }
  }
}
