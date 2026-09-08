import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { acceptsMapMessage } from "../features/maps/map-state";
import type { MapSurfaceProps } from "./groov-map-surface.types";

export function GroovMapSurface({ kind, compact = false, state, onMessage }: MapSurfaceProps) {
  const webview = useRef<WebView>(null);
  const [channel] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Dev uses Metro's public assets; release requires the same app asset deployment.
  const host = Constants.expoConfig?.hostUri;
  const origin = process.env.EXPO_PUBLIC_MAP_ORIGIN || (__DEV__ && host ? `http://${host}` : "");
  const uri = `${origin}/groov-maps/${kind === "ranking" ? "index" : "detail"}.html?embedded=1&kind=${kind}&view=explore&compact=${compact ? 1 : 0}&channel=${channel}&v=app-map-2`;
  const send = (type: string, payload: unknown) =>
    webview.current?.injectJavaScript(
      `window.groovReceive?.(${JSON.stringify({ source: "groov-app", channel, type, payload }).replace(/</g, "\\u003c")});true;`,
    );
  useEffect(() => {
    if (ready) send("state", state);
  }, [state, ready]);
  if (!origin)
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: "#ff5733" }}>
          지도 배포 주소 설정이 필요합니다. EXPO_PUBLIC_MAP_ORIGIN을 앱 배포 주소로 설정해주세요.
        </Text>
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webview}
        source={{ uri }}
        style={{ flex: 1, backgroundColor: "#101113" }}
        geolocationEnabled
        javaScriptEnabled
        domStorageEnabled
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(`${origin}/groov-maps/`) || request.url === "about:blank")
            return true;
          if (request.isTopFrame && /^https?:/.test(request.url)) void Linking.openURL(request.url);
          return !request.isTopFrame;
        }}
        onError={() => setFailed(true)}
        onContentProcessDidTerminate={() => webview.current?.reload()}
        onMessage={async (event) => {
          let message: unknown;
          try {
            message = JSON.parse(event.nativeEvent.data);
          } catch {
            return;
          }
          if (!acceptsMapMessage(message, channel)) return;
          if (message.type === "ready") {
            setReady(true);
            setFailed(false);
            send("state", state);
            return;
          }
          try {
            const value = await onMessage(message.type, message.payload);
            if (message.payload.id) send("reply", { id: message.payload.id, value });
          } catch (error) {
            if (message.payload.id)
              send("reply", {
                id: message.payload.id,
                error: error instanceof Error ? error.message : "지도 연결 실패",
              });
          }
        }}
      />
      {failed ? (
        <Pressable
          onPress={() => {
            setFailed(false);
            webview.current?.reload();
          }}
          style={{ padding: 16, backgroundColor: "#161616" }}
        >
          <Text style={{ color: "#ff5733" }}>지도 다시 불러오기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
