import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "../domain/errors.js";

export type AppleIdentity = {
  subject: string;
  email: string;
};

export type AppleTokenVerifier = (
  identityToken: string,
  allowedClientIds: string[],
) => Promise<AppleIdentity>;

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export const verifyAppleIdentityToken: AppleTokenVerifier = async (
  identityToken,
  allowedClientIds,
) => {
  if (allowedClientIds.length === 0) {
    throw new AppError(
      503,
      "APPLE_AUTH_NOT_CONFIGURED",
      "Apple 로그인이 아직 연결되지 않았습니다. 운영자에게 문의해 주세요.",
    );
  }

  try {
    const result = await jwtVerify(identityToken, appleJwks, {
      audience: allowedClientIds,
      issuer: "https://appleid.apple.com",
      algorithms: ["RS256"],
    });
    const { sub, email, email_verified: emailVerified } = result.payload;
    if (!sub || typeof email !== "string" || (emailVerified !== true && emailVerified !== "true")) {
      throw new Error("Apple identity claims are incomplete");
    }
    return { subject: sub, email: email.toLowerCase() };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "APPLE_TOKEN_INVALID",
      "Apple 계정 인증에 실패했습니다. 다시 시도해 주세요.",
    );
  }
};
