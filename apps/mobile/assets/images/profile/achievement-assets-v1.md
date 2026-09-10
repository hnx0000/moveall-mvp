# 달성메달 이미지 제작 기록

방식: 내장 이미지 생성 도구, 각각 1회 생성. 생성본 1254×1254, 투명 배경. 중앙 아이콘·잠금 표시·진행 막대는 앱의 실제 데이터로 별도 표시한다.

- 주황 금속: [achievement-copper-v1.png](./achievement-copper-v1.png)
- 짙은 금속: [achievement-graphite-v1.png](./achievement-graphite-v1.png)
- 저장 폴더: `apps/mobile/assets/images/profile/` (저장소 기준)

## 공통 프롬프트

Use case: product-mockup.
Asset type: standalone transparent raster medal coin base for a fitness profile achievement UI, intended to display around 52 pixels.
Primary request: Create exactly one circular metal medal coin, not a set or a UI. This is a NEW image.
Composition/framing: square 1024 x 1024 canvas, straight front view with absolutely no perspective tilt, perfect circular silhouette centered in canvas occupying 90% of width and height, about 5% clear margin on every side.
Style/medium: photorealistic premium embossed polished metal with a strong double bevel concentric rim that remains readable at small size. Tiny restrained laurel relief only around the outer lower left and lower right perimeter, never across the middle.
CENTER MUST BE EMPTY: leave the large flat circular central field entirely blank for an icon that will be added later by application code. Only gentle metal surface texture may appear in the center.
Scene/backdrop: genuine transparent alpha background. Nothing behind the coin. No baked-in checkerboard, white or black backdrop.
Constraints: one coin only; no ribbon, no text, no letters, no numbers, no sport symbols, no lock, no crown, no progress bars, no UI, no mockup, no watermark, no external cast shadow beyond a very short subtle edge halo. Entire coin visible, no cropping.

## 주황 금속 — 공통 프롬프트 뒤에 추가

Subject/color/material: luminous burnt-orange copper medal coin, polished warm orange copper, bright amber highlights on the upper-left bevel and thin rim, subtly darker orange brown on the lower-right. Center flat and gently textured warm orange copper. Match the mood of a premium small luminous copper achievement medallion on a dark fitness UI; elegant realistic metallic depth and controlled highlights. Keep the laurel relief tiny and close to the edge.

## 짙은 금속 — 공통 프롬프트 뒤에 추가

Subject/color/material: dark graphite metal medal coin, subtle brushed metal, silver-gray beveled rim highlights on the upper-left, dark charcoal blank center. Concentric polished double bevel border and tiny restrained laurel relief near the lower-left/lower-right perimeter. Match the mood of a premium small inactive dark gunmetal achievement medallion on a dark fitness UI; elegant realistic metallic depth and controlled silver highlights, with the center staying distinctly dark.
