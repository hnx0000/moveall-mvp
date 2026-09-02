import { LegalDocumentScreen } from "../../src/legal/legal-document-screen";
import { supportSections } from "../../src/legal/policies";

export default function SupportScreen() {
  return (
    <LegalDocumentScreen eyebrow="GROOV SUPPORT" title="지원 및 문의" sections={supportSections} />
  );
}
