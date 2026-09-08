import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { useAuth } from "../src/auth/auth-context";
import { usePreviewApi } from "../src/api/client";
import { BodyText, PrimaryButton, Screen } from "../src/components/ui";

const LOCAL_MAP_ORIGINS = new Set(["http://127.0.0.1:8095", "http://localhost:8095"]);

// This local-only handoff owns its session checks. Never send auth tokens or a
// complete profile to the separate map prototype, including in URL parameters.
export default function MapConnect() {
  const { session, onboarding, onboardingLoading, restoring } = useAuth();
  const { targetOrigin, nonce } = useLocalSearchParams<{ targetOrigin?: string; nonce?: string }>();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const web = Platform.OS === "web" && typeof window !== "undefined";
  const localApp = web && ["http://localhost:8081", "http://127.0.0.1:8081"].includes(window.location.origin);
  const validRequest = localApp && typeof targetOrigin === "string" && LOCAL_MAP_ORIGINS.has(targetOrigin)
    && typeof nonce === "string" && /^[a-f0-9-]{36}$/i.test(nonce) && Boolean(window.opener);
  const area = onboarding?.neighborhood;
  const age = area ? Date.now() - Date.parse(area.verifiedAt) : Infinity;
  const verified = Boolean(session && !usePreviewApi && area?.district && age >= 0 && age <= 30 * 86400000);
  const busy = restoring || onboardingLoading;
  const label = area ? [area.district, area.neighborhood.trim().split(/\s+/).at(-1)?.replace(/제?\d+(?:[·.,]\d+)*동$/, "동")].filter(Boolean).join(" ") : "";
  const message = !validRequest ? "로컬 지도에서 ‘인증 동네 연결’을 눌러 열어주세요."
    : busy ? "로그인과 인증 정보를 확인하고 있습니다."
    : !session ? "먼저 앱에 로그인한 후 지도에서 연결 버튼을 다시 눌러주세요."
    : usePreviewApi ? "현재 앱은 예시 계정 모드입니다. 실제 계정 API 연결 후 인증 동네를 연결할 수 있습니다."
    : !verified ? "앱에서 동네 인증을 완료하거나 갱신한 뒤 다시 연결해주세요."
    : sent ? "연결했습니다. 지도 화면으로 돌아가세요."
    : `${label}을 로컬 지도에 연결합니다. 동네 이름과 인증 위치만 전달되며 계정 정보는 전달되지 않습니다.`;
  function connect() {
    if (!validRequest || busy || !verified || !area || !window.opener || !targetOrigin) return;
    window.opener.postMessage({ type: "groov:verified-neighborhood", nonce, area: {
      neighborhood: area.neighborhood, district: area.district, province: area.province,
      regionCode: area.regionCode, latitude: area.latitude, longitude: area.longitude, verifiedAt: area.verifiedAt,
    } }, targetOrigin);
    setSent(true);
  }
  return <Screen title="인증 동네 연결" subtitle="로컬 지도 테스트 전용">
    <View style={{ gap: 20 }}>
      <BodyText>{message}</BodyText>
      {validRequest && !busy && verified && !sent ? <PrimaryButton label={label + " 연결"} onPress={connect} /> : null}
      {validRequest && !busy && !session ? <PrimaryButton label="앱 로그인" onPress={() => router.push("/login")} /> : null}
      {validRequest && !busy && session && !usePreviewApi && !verified ? <PrimaryButton label="동네 인증 확인" onPress={() => router.push("/onboarding")} /> : null}
    </View>
  </Screen>;
}
