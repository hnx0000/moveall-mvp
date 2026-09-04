# 구름 비숑 — Codex v2 휴대용 패키지

다른 컴퓨터의 Codex에 그대로 설치할 수 있는 구름 비숑 커스텀 펫입니다.

## Windows 설치

1. ZIP 파일을 완전히 압축 해제합니다.
2. `install.cmd`를 더블클릭합니다.
3. Codex가 열려 있었다면 한 번 재시작합니다.
4. Codex의 펫 선택 화면에서 **구름 비숑**을 선택합니다.

PowerShell에서 직접 설치하려면:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

## macOS / Linux 설치

터미널에서 압축을 푼 폴더로 이동한 뒤 실행합니다.

```bash
chmod +x ./install.sh
./install.sh
```

## 설치 위치

- 기본값: 사용자 홈의 `.codex/pets/gureum-bichon`
- `CODEX_HOME` 환경 변수가 설정되어 있으면 그 아래 `pets/gureum-bichon`

기존에 같은 ID의 펫이 있으면 삭제하지 않고 날짜가 붙은 백업 폴더로 이동합니다.

## Windows에서 제거

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

제거 스크립트는 파일을 삭제하지 않고 `.codex/pets-disabled`로 옮기므로 복구할 수 있습니다.

## 패키지 검증 정보

- Codex sprite contract: v2
- Atlas: 8열 × 11행, 192×208 픽셀 셀
- Spritesheet: 1536×2288 WebP RGBA
- SHA-256: `7A83EF2D0B7C63DCD1244C5C0452AA7085ECBF37845114129AC0BD9A62F3C0C8`
- `validation.json`의 `ok` 값: `true`

패키지의 `spritesheet.webp`가 수정되거나 손상되면 설치 스크립트가 해시 검증에서 중단됩니다.
