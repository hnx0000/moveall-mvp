import AsyncStorage from "@react-native-async-storage/async-storage";
type Place = { id: string; name: string; coordinate: [number, number] };
let queue: Promise<unknown> = Promise.resolve();
export function savedPlaceAction(userId: string, action: string, payload: Record<string, unknown>) {
  const operation = queue.then(async () => {
    const key = `groov-saved-places-v1:${userId}`;
    let places: Place[] = JSON.parse((await AsyncStorage.getItem(key)) ?? "[]");
    if (action === "place-save") {
      const coordinate = payload.coordinate;
      if (
        typeof payload.name !== "string" ||
        !payload.name.trim() ||
        payload.name.length > 60 ||
        !Array.isArray(coordinate) ||
        coordinate.length !== 2 ||
        !coordinate.every((value) => typeof value === "number" && Number.isFinite(value)) ||
        Math.abs(coordinate[0]) > 180 ||
        Math.abs(coordinate[1]) > 90
      )
        throw new Error("위치 이름과 좌표를 확인해 주세요.");
      if (places.length >= 200) throw new Error("위치는 최대 200개까지 저장할 수 있습니다.");
      places = [
        ...places,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: payload.name.trim(),
          coordinate: coordinate as [number, number],
        },
      ];
    }
    if (action === "place-remove") places = places.filter((place) => place.id !== payload.placeId);
    if (action !== "place-list") await AsyncStorage.setItem(key, JSON.stringify(places));
    return places;
  });
  queue = operation.catch(() => {});
  return operation;
}
