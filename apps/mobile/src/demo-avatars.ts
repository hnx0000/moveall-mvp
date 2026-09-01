import type { ImageSourcePropType } from "react-native";
import profileDoyun from "../assets/images/profiles/profile-doyun.jpg";
import profileHarin from "../assets/images/profiles/profile-harin.jpg";
import profileJun from "../assets/images/profiles/profile-jun.jpg";
import profileMinji from "../assets/images/profiles/profile-minji.jpg";
import profileTaeo from "../assets/images/profiles/profile-taeo.jpg";
import profileYuna from "../assets/images/profiles/profile-yuna.jpg";

export const demoAvatarSources: Partial<Record<string, ImageSourcePropType>> = {
  "demo-friend-1": profileMinji,
  "demo-friend-2": profileJun,
  "demo-friend-3": profileDoyun,
  "demo-friend-4": profileYuna,
  "demo-friend-private": profileHarin,
  "demo-friend-6": profileTaeo,
};
