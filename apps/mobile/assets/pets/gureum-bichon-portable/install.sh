#!/usr/bin/env bash
set -euo pipefail

pet_id="gureum-bichon"
expected_hash="7a83ef2d0b7c63dcd1244c5c0452aa7085ecbf37845114129ac0bd9a62f3c0c8"
package_dir="$(cd "$(dirname "$0")" && pwd)"
sheet="$package_dir/spritesheet.webp"
manifest="$package_dir/pet.json"
codex_root="${CODEX_HOME:-$HOME/.codex}"
pets_root="$codex_root/pets"
target="$pets_root/$pet_id"
stamp="$(date +%Y%m%d-%H%M%S)"
backup="$pets_root/$pet_id.backup-$stamp"
staging="$pets_root/.$pet_id.installing-$$"

if command -v shasum >/dev/null 2>&1; then
  actual_hash="$(shasum -a 256 "$sheet" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  actual_hash="$(sha256sum "$sheet" | awk '{print $1}')"
else
  echo "A SHA-256 utility (shasum or sha256sum) is required." >&2
  exit 1
fi

if [[ "$actual_hash" != "$expected_hash" ]]; then
  echo "spritesheet.webp failed SHA-256 verification." >&2
  exit 1
fi

mkdir -p "$pets_root"
rm -rf "$staging"
mkdir "$staging"
cp "$manifest" "$staging/pet.json"
cp "$sheet" "$staging/spritesheet.webp"

if [[ -e "$target" ]]; then
  mv "$target" "$backup"
  echo "Existing pet backed up to: $backup"
fi
mv "$staging" "$target"

echo "Gureum Bichon installed successfully."
echo "Location: $target"
echo "Restart Codex if the pet list is already open."
