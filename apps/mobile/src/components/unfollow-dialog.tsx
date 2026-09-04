import { CenterDialog } from "./ui";

export function UnfollowDialog({
  visible,
  busy = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <CenterDialog
      visible={visible}
      title="팔로우를 취소할까요?"
      message="확인하면 이 계정의 팔로우가 취소됩니다."
      confirmLabel={busy ? "취소 중…" : "팔로우 취소"}
      cancelLabel="유지하기"
      busy={busy}
      danger
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
