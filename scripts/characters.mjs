import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import {
  characters,
  plannedCharacters,
  characterCatalogVersion,
  characterPhotoStyle,
  characterUserId,
  characterPostId,
  buildCharacterImagePrompt,
  buildCharacterTextPrompt,
  generateCharacterText,
} from "../packages/contracts/dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const collection = join(root, "개발자료 보관함", "가상인물 리스트");
const folderName = (character, index) =>
  `${String(index + 1).padStart(2, "0")}_${character.id}_${character.name}_${character.sportLabel}`;
const characterFolder = (character, index) =>
  join(collection, "active", folderName(character, index));
async function write(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}
async function markdown(path, text) {
  await write(path, await format(text, { parser: "markdown" }));
}

async function docs() {
  await mkdir(collection, { recursive: true });
  const manifest = [];
  for (const [index, character] of characters.entries()) {
    const folder = characterFolder(character, index);
    await write(
      join(folder, "character.json"),
      JSON.stringify(
        { version: characterCatalogVersion, status: "active", ...character },
        null,
        2,
      ) + "\n",
    );
    await markdown(
      join(folder, "README.md"),
      `# ${character.name} · ${character.sportLabel}\n\n> ${character.concept}\n\n| 항목 | 설정 |\n|---|---|\n| 나이 | ${character.age}세 · 성인 |\n| 성별 | ${character.gender === "female" ? "여성" : "남성"} |\n| 계정 이름 | ${character.handle} (기획용, 실제 계정 아님) |\n| 대표 색상 | ${character.palette.join(" · ")} |\n| 앱 ID | ${characterUserId(character.id)} |\n\n## 프로필 소개\n\n${character.bio}\n\n## 고정 외형\n\n${character.appearance}\n\n## 말투\n\n${character.voice.rules.map((rule) => `- ${rule}`).join("\n")}\n\n**피할 표현:** ${character.voice.avoid.join(" · ")}\n\n## 촬영 목록\n\n| 파일 | 장면 | 비율 |\n|---|---|---|\n| profile | 얼굴이 잘 보이는 프로필 | 1:1 |\n${character.scenes.map((scene) => `| ${scene.id} | ${scene.title} | 4:5 |`).join("\n")}\n\n## 작업 순서\n\n1. prompts/profile.md의 전체 프롬프트로 프로필 한 장 생성.\n2. 확정 프로필을 그록에 참조 이미지로 첨부하고 prompts/feed-01.md부터 한 장씩 생성.\n3. 얼굴·머리·체형·장비 일관성을 확인하고 assets에 지정 이름으로 저장.\n4. 루트에서 pnpm characters:assets 실행 후 앱 재시작.\n\n이 문서와 character.json은 자동 생성된 사본입니다. 설정 수정은 packages/contracts/src/character-catalog.ts에서 하고 pnpm characters:docs를 실행하세요.\n`,
    );
    for (const sceneId of ["profile", ...character.scenes.map((scene) => scene.id)]) {
      await markdown(
        join(folder, "prompts", `${sceneId}.md`),
        `# ${character.name} · ${sceneId}\n\n아래 전체 내용을 그록에 붙여 넣으세요.${sceneId === "profile" ? "" : " 확정한 프로필을 참조 이미지로 함께 첨부하세요."}\n\n\`\`\`text\n${buildCharacterImagePrompt(character.id, sceneId)}\n\`\`\`\n`,
      );
    }
    await markdown(
      join(folder, "voice-and-feed.md"),
      `# ${character.name} · 말투와 피드\n\n## 피드 문구\n\n${character.scenes.map((scene) => `### ${scene.id} · ${scene.title}\n\n${scene.captions.map((caption, i) => `${i + 1}. ${caption}`).join("\n")}`).join("\n\n")}\n\n## 댓글 초안\n\n${character.voice.comments.map((text) => `- ${text}`).join("\n")}\n\n## 답글 초안\n\n${character.voice.replies.map((text) => `- ${text}`).join("\n")}\n\n댓글·답글은 말투 샘플입니다. 실제 상대 글과 맞는지 확인해서 사용하세요. 자동 전송하지 않습니다.\n`,
    );
    await markdown(
      join(folder, "prompts", "text-generation.md"),
      `# ${character.name} · 새 캡션 작성용\n\n첫 장면 기준 예시입니다. 다른 장면이나 상대 글은 characters:generate의 prompt 명령으로 지정하세요.\n\n\`\`\`text\n${buildCharacterTextPrompt({ characterId: character.id, kind: "caption", sceneId: "feed-01" })}\n\`\`\`\n`,
    );
    await markdown(
      join(folder, "assets", "README.md"),
      `# ${character.name} 이미지 저장 위치\n\n그록에서 확정한 사진을 이 폴더에 넣으세요.\n\n- profile.jpg — 프로필 1장, 1:1\n- feed-01.jpg — ${character.scenes[0].title}, 4:5\n- feed-02.jpg — ${character.scenes[1].title}, 4:5\n- feed-03.jpg — ${character.scenes[2].title}, 4:5\n\n확장자는 jpg, jpeg, png, webp 중 하나입니다. 같은 이름에 여러 확장자를 동시에 두지 마세요. 원본/재시도 이미지는 다른 하위 폴더에 보관하세요.\n\n루트에서 pnpm characters:assets를 실행하면 확인된 파일만 앱 assets/images/characters/${character.id}에 복사하고 정적 이미지 매핑을 갱신합니다. 앱에 이미 반영된 파일은 이 폴더에서 빠져도 자동 삭제하지 않습니다. 아직 생성한 사진이 없으면 텍스트 피드와 기본 아바타가 표시됩니다.\n`,
    );
    manifest.push({
      id: character.id,
      name: character.name,
      userId: characterUserId(character.id),
      folder: `active/${folderName(character, index)}`,
      images: ["profile", ...character.scenes.map((scene) => scene.id)],
    });
  }
  for (const character of plannedCharacters) {
    await markdown(
      join(collection, "planned", `${character.id}_${character.name}`, "README.md"),
      `# ${character.name} · ${character.sportLabel} (추가 예정)\n\n${character.age}세 성인 여성.\n\n${character.concept}\n\n현재 앱 피드에는 등록되지 않은 확장 초안입니다. 정식 추가 시 고정 외형·프로필·장면 3개·말투를 완성하고 활성 카탈로그에 등록하세요.\n`,
    );
  }
  await write(
    join(collection, "manifest.json"),
    JSON.stringify(
      {
        version: characterCatalogVersion,
        profileCount: 6,
        feedImageCount: 18,
        characters: manifest,
      },
      null,
      2,
    ) + "\n",
  );
  await markdown(
    join(collection, "00_PHOTO_DIRECTION.md"),
    `# 공통 촬영 디렉션\n\n${characterPhotoStyle}\n\n## 일관성 체크\n\n- 프로필 1장 확정 후 같은 참조 이미지를 각 피드 생성에 첨부.\n- 얼굴 골격, 눈코입, 피부 톤, 머리 길이와 체형을 유지.\n- 프로필은 얼굴이 가려지지 않는 1:1 중앙 구도.\n- 피드는 4:5 세로, 운동복 필수. 수영은 선수용 수영복, 다이빙은 전신 잠수복.\n- 실제 종목에 맞는 장비와 현실적인 손·발·관절·자전거 구조 확인.\n- 촬영 전·운동 중·운동 후를 구분하고 캡션과 사진이 일치하는지 확인.\n- 인위적인 화보보다 휴대폰 스냅, 운동 후 홍조와 잔머리, 자연스러운 피부 결.\n`,
  );
  await markdown(
    join(collection, "README.md"),
    `# GROOV · 운동 인플루언서 캐릭터 컬렉션\n\n**활성 6명 · 프로필 6장 · 피드 사진 18장 · 확장 초안 2명**\n\n외형, 운동 종목, 촬영 장면, 말투, 앱 피드를 하나의 설정에서 관리합니다. 이미지는 그록에서 생성하고, 이 프로젝트는 기획과 문구 생성·앱 연결을 담당합니다.\n\n| 캐릭터 | 나이 | 종목 | 대표 색 | 기획 폴더 |\n|---|---|---|---|---|\n${characters.map((c, i) => `| ${c.name} | ${c.age} | ${c.sportLabel} | ${c.palette.join("·")} | [설정 열기](active/${folderName(c, i)}/README.md) |`).join("\n")}\n\n## 폴더 구성\n\n\`\`\`text\n가상인물 리스트/\n  README.md                 전체 인덱스\n  00_PHOTO_DIRECTION.md     공통 촬영 기준\n  PROCESS.md                앱 연결과 운영 절차\n  manifest.json             파일 목록\n  active/                   활성 캐릭터 6명\n    01_seoa_윤서아_수영/\n      README.md             캐릭터 설정 카드\n      character.json        프로그램용 설정 사본\n      voice-and-feed.md     캡션·댓글·답글 예시\n      prompts/              복사해서 쓰는 완성 프롬프트\n      assets/               확정 사진을 넣는 곳\n        참고사진/           기존 인스타 감성 사진(앱 자동 반영 제외)\n  planned/                  배수빈·정유나 확장 초안\n  추가후보/                 아직 설정에 연결하지 않은 인물\n  배경/                     공용 배경 이미지\n\`\`\`\n\n## 바로 시작\n\n1. 캐릭터 폴더의 prompts/profile.md를 그록에 붙여 넣어 프로필 확정.\n2. 프로필을 참조 이미지로 첨부하고 feed-01~03.md로 피드 생성.\n3. assets에 profile.jpg, feed-01.jpg, feed-02.jpg, feed-03.jpg 저장.\n4. 프로젝트 루트에서 pnpm characters:assets 실행 후 앱 재시작.\n\n## 설정을 수정할 때\n\n원본은 packages/contracts/src/character-catalog.ts입니다. 수정 후 pnpm characters:docs를 실행하면 폴더 문서와 프롬프트를 다시 생성합니다. assets의 사진은 건드리지 않습니다.\n\n앱은 같은 원본을 읽어 데모 피드를 생성합니다. 세부 구조와 명령은 [PROCESS.md](PROCESS.md)를 참고하세요.\n\n## 기존 사진 합본\n\n기존 사진은 각 인물의 assets/참고사진에 기획 참고용으로 보관합니다. 이 폴더의 사진은 자동 반영하지 않으며, 검수 후 profile 또는 feed-01~03 파일명으로 확정한 이미지만 앱에 연결합니다.\n`,
  );
  console.info(`캐릭터 문서와 이미지 프롬프트 24개 생성: ${collection}`);
}

async function names(path) {
  try {
    return await readdir(path);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function imageFile(folder, stem) {
  const matches = (await names(folder)).filter((name) =>
    new RegExp(`^${stem}\\.(jpg|jpeg|png|webp)$`, "i").test(name),
  );
  if (matches.length > 1) throw new Error(`중복 이미지: ${folder}/${stem}`);
  if (!matches.length) return undefined;
  const path = join(folder, matches[0]);
  const data = await readFile(path);
  const ext = matches[0].split(".").pop().toLowerCase();
  const valid =
    ext === "png"
      ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : ext === "webp"
        ? data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP"
        : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (!valid) throw new Error(`확장자와 파일 내용이 맞지 않습니다: ${path}`);
  return { path, ext };
}
async function assets() {
  const imports = [],
    avatars = [],
    feeds = [],
    copies = [];
  let count = 0;
  // Validate the entire batch before copying any files or changing the asset registry.
  for (const [index, character] of characters.entries()) {
    for (const stem of ["profile", ...character.scenes.map((scene) => scene.id)]) {
      const source = await imageFile(join(characterFolder(character, index), "assets"), stem);
      const destination = join(root, "apps/mobile/assets/images/characters", character.id);
      const existing = await imageFile(destination, stem);
      if (source && existing && source.ext !== existing.ext)
        throw new Error(
          `${character.id}/${stem}: 기존 앱 이미지와 같은 확장자를 사용하세요 (${existing.ext}).`,
        );
      const selected = source ?? existing;
      if (!selected) continue;
      if (source)
        copies.push({ from: source.path, to: join(destination, `${stem}.${source.ext}`) });
      const variable = `characterImage${count++}`;
      imports.push(
        `import ${variable} from "../assets/images/characters/${character.id}/${stem}.${selected.ext}";`,
      );
      const key =
        stem === "profile" ? characterUserId(character.id) : characterPostId(character.id, stem);
      (stem === "profile" ? avatars : feeds).push(`${JSON.stringify(key)}: ${variable},`);
    }
  }
  for (const copy of copies) {
    await mkdir(dirname(copy.to), { recursive: true });
    await copyFile(copy.from, copy.to);
  }
  await write(
    join(root, "apps/mobile/src/character-assets.generated.ts"),
    await format(
      `// Generated by pnpm characters:assets. Do not edit by hand.\nimport type { ImageSourcePropType } from "react-native";\n${imports.join("\n")}\nexport const characterAvatarSources: Partial<Record<string, ImageSourcePropType>> = {${avatars.join("\n")}};\nexport const characterFeedSources: Partial<Record<string, ImageSourcePropType>> = {${feeds.join("\n")}};\n`,
      { parser: "typescript" },
    ),
  );
  console.info(
    `앱 이미지 연결: ${count}/24장 (프로필 ${avatars.length}/6, 피드 ${feeds.length}/18). 사진이 없는 캐릭터는 텍스트와 기본 아바타로 표시됩니다.`,
  );
}

const [command, ...args] = process.argv.slice(2);
if (command === "docs") await docs();
else if (command === "assets") await assets();
else if (command === "text" || command === "prompt" || command === "image") {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (
      !["--character", "--kind", "--scene", "--variant", "--facts"].includes(key) ||
      args[index + 1] === undefined
    )
      throw new Error(`잘못된 옵션: ${key}`);
    options[key.slice(2)] = args[index + 1];
  }
  const input = {
    characterId: options.character,
    kind: options.kind ?? "caption",
    sceneId: options.scene,
    variant: options.variant === undefined ? 0 : Number(options.variant),
    facts: options.facts,
  };
  console.info(
    command === "image"
      ? buildCharacterImagePrompt(input.characterId, input.sceneId)
      : command === "prompt"
        ? buildCharacterTextPrompt(input)
        : generateCharacterText(input),
  );
} else {
  throw new Error(
    "사용법: characters.mjs docs | assets | text/prompt/image --character seoa --kind caption --scene feed-01 [--variant 1] [--facts 내용]",
  );
}
