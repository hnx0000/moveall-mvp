import AsyncStorage from "@react-native-async-storage/async-storage";
import { courseStorageKey, readCourse, type MapCourse } from "./map-state";

type Library = { courses: MapCourse[]; selected: MapCourse | null };
const listeners = new Set<(userId: string, library: Library) => void>();
let queue: Promise<unknown> = Promise.resolve();
export async function loadCourseLibrary(userId: string): Promise<Library> {
  const raw = await AsyncStorage.getItem(courseStorageKey(userId));
  if (!raw) return { courses: [], selected: null };
  const data = JSON.parse(raw) as Library;
  return {
    courses: data.courses.map(readCourse),
    selected: data.selected ? readCourse(data.selected) : null,
  };
}
export function watchCourses(listener: (userId: string, library: Library) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function changeCourseLibrary(userId: string, action: string, input: unknown) {
  const operation = queue.then(async () => {
    const library = await loadCourseLibrary(userId);
    if (action === "course-use") library.selected = readCourse(input);
    if (action === "course-save") {
      if (library.courses.length >= 100) throw new Error("최대 100개 코스까지 저장할 수 있습니다.");
      library.courses.unshift({
        ...readCourse(input),
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    }
    if (action === "course-remove") {
      library.courses = library.courses.filter((c) => c.id !== input);
      if (library.selected?.id === input) library.selected = null;
    }
    await AsyncStorage.setItem(courseStorageKey(userId), JSON.stringify(library));
    listeners.forEach((listener) => listener(userId, library));
    return library;
  });
  queue = operation.catch(() => {});
  return operation;
}
