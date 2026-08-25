import { SportTypeSchema } from "@moveall/contracts";
import { useLocalSearchParams } from "expo-router";
import { RecordsScreen } from "../../src/profile/records-screen";

export default function SportRecordsPage() {
  const parameters = useLocalSearchParams<{ sport?: string }>();
  const sport = SportTypeSchema.safeParse(parameters.sport);
  return sport.success ? <RecordsScreen sport={sport.data} /> : <RecordsScreen />;
}
