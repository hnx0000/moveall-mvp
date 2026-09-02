import { LegalDocumentScreen } from "../../src/legal/legal-document-screen";
import { accountDeletionSections } from "../../src/legal/policies";

export default function AccountDeletionScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="ACCOUNT DELETION"
      title="계정 삭제 안내"
      sections={accountDeletionSections}
    />
  );
}
