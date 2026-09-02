import type { AuthorizationCodeLoginInput } from "@moveall/contracts";
import { AppError } from "../domain/errors.js";

export type KakaoIdentity = {
  subject: string;
  email: string;
  displayName: string;
};

export type KakaoCodeExchanger = (
  input: AuthorizationCodeLoginInput,
  clientId?: string,
  clientSecret?: string,
) => Promise<KakaoIdentity>;

export const exchangeKakaoAuthorizationCode: KakaoCodeExchanger = async (
  input,
  clientId,
  clientSecret,
) => {
  if (!clientId) {
    throw new AppError(
      503,
      "KAKAO_AUTH_NOT_CONFIGURED",
      "카카오 로그인이 아직 연결되지 않았습니다. 운영자에게 문의해 주세요.",
    );
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    if (clientSecret) tokenBody.set("client_secret", clientSecret);
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: tokenBody,
    });
    if (!tokenResponse.ok) throw new Error("Kakao token exchange failed");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Kakao access token missing");

    const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) throw new Error("Kakao profile request failed");
    const profile = (await profileResponse.json()) as {
      id?: number | string;
      properties?: { nickname?: string };
      kakao_account?: {
        email?: string;
        is_email_valid?: boolean;
        is_email_verified?: boolean;
        profile?: { nickname?: string };
      };
    };
    const email = profile.kakao_account?.email?.toLowerCase();
    if (
      profile.id === undefined ||
      !email ||
      profile.kakao_account?.is_email_valid === false ||
      profile.kakao_account?.is_email_verified === false
    ) {
      throw new AppError(
        400,
        "KAKAO_EMAIL_REQUIRED",
        "카카오 계정의 이메일 제공 동의가 필요합니다.",
      );
    }
    const nickname =
      profile.kakao_account?.profile?.nickname ??
      profile.properties?.nickname ??
      email.split("@")[0]!;
    return {
      subject: String(profile.id),
      email,
      displayName: nickname.trim().slice(0, 30) || "GROOV 사용자",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      401,
      "KAKAO_LOGIN_FAILED",
      "카카오 계정 인증에 실패했습니다. 다시 시도해 주세요.",
    );
  }
};
