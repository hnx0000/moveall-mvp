import type { AuthorizationCodeLoginInput } from "@moveall/contracts";
import { AppError } from "../domain/errors.js";

export type NaverIdentity = {
  subject: string;
  email: string;
  displayName: string;
};

export type NaverCodeExchanger = (
  input: AuthorizationCodeLoginInput,
  clientId?: string,
  clientSecret?: string,
) => Promise<NaverIdentity>;

export const exchangeNaverAuthorizationCode: NaverCodeExchanger = async (
  input,
  clientId,
  clientSecret,
) => {
  if (!clientId || !clientSecret) {
    throw new AppError(
      503,
      "NAVER_AUTH_NOT_CONFIGURED",
      "네이버 로그인이 아직 연결되지 않았습니다. 운영자에게 문의해 주세요.",
    );
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
      ...(input.state ? { state: input.state } : {}),
    });
    const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenBody,
    });
    if (!tokenResponse.ok) throw new Error("Naver token exchange failed");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Naver access token missing");

    const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Naver profile request failed");
    const payload = (await profileResponse.json()) as {
      resultcode?: string;
      response?: { id?: string; email?: string; nickname?: string; name?: string };
    };
    const profile = payload.response;
    const email = profile?.email?.toLowerCase();
    if (payload.resultcode !== "00" || !profile?.id || !email) {
      throw new AppError(
        400,
        "NAVER_EMAIL_REQUIRED",
        "네이버 계정의 이메일 제공 동의가 필요합니다.",
      );
    }
    const nickname = profile.nickname ?? profile.name ?? email.split("@")[0]!;
    return {
      subject: profile.id,
      email,
      displayName: nickname.trim().slice(0, 30) || "GROOV 사용자",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "NAVER_LOGIN_FAILED",
      "네이버 계정 인증에 실패했습니다. 다시 시도해 주세요.",
    );
  }
};
