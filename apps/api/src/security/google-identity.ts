import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "../domain/errors.js";

export type GoogleIdentity = {
  subject: string;
  email: string;
  displayName: string;
};

export type GoogleTokenVerifier = (
  idToken: string,
  allowedClientIds: string[],
) => Promise<GoogleIdentity>;

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const verifyGoogleIdToken: GoogleTokenVerifier = async (idToken, allowedClientIds) => {
  if (allowedClientIds.length === 0) {
    throw new AppError(
      503,
      "GOOGLE_AUTH_NOT_CONFIGURED",
      "Google 로그인이 아직 연결되지 않았습니다. 운영자에게 문의해 주세요.",
    );
  }

  try {
    const result = await jwtVerify(idToken, googleJwks, {
      audience: allowedClientIds,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      algorithms: ["RS256"],
    });
    const { sub, email, email_verified: emailVerified, name } = result.payload;
    if (!sub || typeof email !== "string" || emailVerified !== true) {
      throw new Error("Google identity claims are incomplete");
    }

    return {
      subject: sub,
      email: email.toLowerCase(),
      displayName:
        typeof name === "string" && name.trim().length >= 2
          ? name.trim().slice(0, 30)
          : email.split("@")[0]!.slice(0, 30),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "GOOGLE_TOKEN_INVALID",
      "Google 계정 인증에 실패했습니다. 다시 시도해 주세요.",
    );
  }
};
