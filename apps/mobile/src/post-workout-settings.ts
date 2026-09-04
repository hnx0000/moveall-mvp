import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPostWorkoutPreference } from "./post-workout-preference";

export const postWorkoutSettings = createPostWorkoutPreference(AsyncStorage);
