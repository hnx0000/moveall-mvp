import { LegalDocumentScreen } from "../../src/legal/legal-document-screen";
import { termsSections } from "../../src/legal/policies";

export default function TermsScreen() {
  return <LegalDocumentScreen eyebrow="TERMS" title="GROOV 이용약관" sections={termsSections} />;
}
