import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

let preparedFile: { uri: string; file: globalThis.File } | null = null;
export async function prepareStudioExport(uri: string) {
  if (Platform.OS !== "web") return;
  const blob = await (await fetch(uri)).blob();
  preparedFile = {
    uri,
    file: new globalThis.File([blob], `GROOV-${Date.now()}.png`, { type: "image/png" }),
  };
}

export async function exportStudioImage(uri: string) {
  if (Platform.OS !== "web") {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("이 기기에서는 공유 창을 열 수 없습니다.");
    let fileUri = uri;
    if (uri.startsWith("data:")) {
      const file = new File(Paths.cache, `groov-${Date.now()}.png`);
      file.write(uri.split(",")[1]!, { encoding: "base64" });
      fileUri = file.uri;
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: "image/png",
      dialogTitle: "GROOV 기록 공유",
      UTI: "public.png",
    });
    return;
  }
  const file = preparedFile?.uri === uri ? preparedFile.file : null;
  if (!file) throw new Error("공유 이미지를 다시 만들어 주세요.");
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "GROOV 기록" });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
