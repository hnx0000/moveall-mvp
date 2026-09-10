import { useEffect, useState } from "react"; import { uiLayout } from "../theme";
import { Image } from "react-native";

// No extra gradient/branding is painted over the user's finished composition.
export function PostArtwork({ uri, label }: { uri: string; label: string }) {
  const [ratio, setRatio] = useState(9 / 16);
  useEffect(() => {
    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (active && height > 0) setRatio(width / height);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [uri]);
  return (
    <Image
      accessibilityLabel={label}
      source={{ uri }}
      resizeMode="contain"
      style={{ width: "100%", aspectRatio: ratio, borderRadius: uiLayout.photoRadius, backgroundColor: "#171513" }}
    />
  );
}
