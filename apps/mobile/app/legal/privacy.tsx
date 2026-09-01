import { LegalDocumentScreen } from "../../src/legal/legal-document-screen";
import { privacySections } from "../../src/legal/policies";

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen eyebrow="PRIVACY" title="개인정보 처리방침" sections={privacySections} />
  );
}
