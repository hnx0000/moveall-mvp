import AsyncStorage from "@react-native-async-storage/async-storage";
import { authStorageKey } from "../../config/runtime";
import { createActiveWorkoutStore } from "./active-workout-recovery";
export const activeWorkouts = createActiveWorkoutStore(
  AsyncStorage,
  `${authStorageKey}:active-workout-v1`,
);
