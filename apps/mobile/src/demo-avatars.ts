import type { ImageSourcePropType } from "react-native";
import profileDoyun from "../assets/images/people/doyun/profile.jpg";
import profileHarin from "../assets/images/people/harin/profile.jpg";
import profileJiyoung from "../assets/images/people/jiyoung/profile.jpg";
import profileJun from "../assets/images/people/jun/profile.jpg";
import profileMinji from "../assets/images/people/minji/profile.jpg";
import profileSeoa from "../assets/images/people/seoa/profile.jpg";
import profileTaeo from "../assets/images/people/taeo/profile.jpg";
import profileYuna from "../assets/images/people/yuna/profile.jpg";

export const demoAvatarSources: Partial<Record<string, ImageSourcePropType>> = {
  "demo-friend-1": profileMinji,
  "demo-friend-2": profileJun,
  "demo-friend-3": profileDoyun,
  "demo-friend-4": profileYuna,
  "demo-friend-private": profileHarin,
  "demo-friend-6": profileTaeo,
  "demo-friend-7": profileSeoa,
  "demo-friend-8": profileJiyoung,
};
