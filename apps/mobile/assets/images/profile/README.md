# Profile artwork — 2026-09-11

Generated with the built-in image generation tool, one call per asset, no retries.
Both outputs were visually inspected. KEEP GOING has actual alpha transparency.
Used only in the local app; no shared-site publication was performed.

## Assets

- [Medal texture v3](medal-texture-v3.png) — 2172 × 724. Current background: wider upper-left torn-paper patch with a rising lower edge; lower-left and right remain nearly black. Built-in edit, one call, visually inspected; patch approximately 40% wide and 70% high at far left. No person, scene or UI.
- [Medal texture v2](medal-texture-v2.png) — 2172 × 724. Archived paper/tape texture; all runner and scene imagery removed. Built-in image edit, one call.
- [Medal collage](medal-collage-v1.png) — 2172 × 724. Rendered at reduced opacity behind the existing medal interface.
- [KEEP GOING](keep-going-v1.png) — 1514 × 1039, transparent. Rendered beside the existing goal title.

## Exact upper-left patch edit prompt (v3)

```text
Use case: precise-object-edit
Asset type: standalone 3:1 landscape medal cabinet background texture for a mobile interface.
Input images: Image 1 is the EDIT TARGET texture. Image 2 is a supporting composition reference only: use its red annotation solely to understand the upper-left patch boundary, and discard all screenshot UI, lettering, symbols, circles, and red ink.
Primary request: Edit Image 1 by replacing its narrow full-height brighter charcoal stripe on the left with a wider torn-paper PATCH anchored to the TOP-LEFT corner only. The patch must occupy about 30–35% of total canvas width and reach about 55–60% of total canvas height at the far left. Its irregular lower torn edge rises toward the right, reaching roughly 30–40% canvas height at its right endpoint; its irregular right edge continues up to the top. This is a broad upper-left corner patch with a sloping torn bottom, leaving the entire lower-left corner exposed as near-black background. Make this new placement clearly different from the original full-height stripe.
Style/material: preserve the tactile distressed paper collage aesthetic, fine fibers and subtle scratches. Patch is muted light charcoal gray, distinctly lighter than the nearly black underlying paper but dark enough for white interface labels to remain readable. Its torn boundary has delicate natural paper fibers, without a thick white outline. Optional existing tiny tape may be retained only as a subtle muted detail near the top edge.
Invariants: preserve the landscape 3:1 ratio, flat front-facing texture composition, near-black fine paper-grain background across the rest of the image, and dark visual mood. Lower-left and all right areas must remain nearly black. Output only the clean full-bleed background texture.
Avoid: full-height left stripe, bright pale paper, people, scenery, recognizable objects, medals, UI, circles, icons, lettering, logos, watermark, borders, red annotation, screenshot content. Generate exactly one edited image.
```

## Exact texture-only edit prompt (v2)

```text
Use case: precise-object-edit
Asset type: wide abstract paper texture background for a mobile profile card.
Input images: Image 1 is the edit target.
Primary request: Remove EVERY recognizable person and every scene, background scene, or photograph implication from the supplied image. Completely erase the runner and ALL photo/contact-sheet frames and borders in the upper and right areas, including walls, rails, sky, landscape, and all identifiable objects. Seamlessly replace those areas with subtle abstract charcoal paper fibers and fine grain continuous with the existing dark paper surface. The finished image must read entirely as abstract paper texture.
Composition/framing: Preserve the original wide approximately 3:1 framing. Preserve the calm, dark central and lower negative space.
Color palette: near-black #0B0D0C with restrained charcoal tonal variation.
Materials/textures: Keep the existing torn charcoal paper texture and irregular torn edge along the left unchanged, and keep the small muted beige tape at upper left unchanged. Retain subdued paper fibers, fine grain and natural creases without introducing any recognizable imagery.
Constraints: Change only the photographic/scene elements and fill their former areas seamlessly. Preserve the left paper collage, tape, overall darkness, understated texture character, wide framing, and quiet center/lower area. No people or body parts, no silhouettes, no scenery, no photo panels or borders, no architecture, no objects except the retained small tape, no illustrations, no symbols, no text, no logos, no watermark. Produce one edited image only.
```

## Exact background prompt (v1, archived)

```text
Use case: stylized-concept
Asset type: wide background for a small black achievement-medal panel in a sports app, approximately 3:1 landscape.
Primary request: dark editorial sports collage. Charcoal torn paper texture on the left quarter, held by a small beige masking-tape strip at its top. A faint monochrome photograph/contact-sheet image of an adult runner toward the upper right, blended into near-black #0B0D0C.
Composition/framing: extra wide horizontal canvas, approximately 3:1. Central and lower areas mostly calm near-black negative space for overlay medal circles and white text.
Style/medium: restrained gritty sports zine aesthetic; realistic paper fibers and grain, subtle torn edges; photographic detail faint and low contrast.
Color palette: nearly black #0B0D0C and charcoal gray, small muted beige tape only.
Constraints: no words, no letters, no numbers, no logos, no interface, no medal illustrations, no colorful texture, no large bright areas.
```

## Exact sticker prompt

```text
Use case: ads-marketing
Asset type: transparent PNG typographic sticker displayed at 70x48 pixels beside a sports goal title.
Primary request: exact words "KEEP" above "GOING" in bright orange #FF5A32 hand-painted dry-brush lettering.
Text (verbatim): "KEEP" on the first line, "GOING" on the second line. K-E-E-P and G-O-I-N-G, no other text.
Style/medium: compact two-line forward-leaning slanted sports graffiti composition, rough brush edges, bold legible lettering with expressive dry-brush texture.
Composition/framing: closely framed orange lettering with a small safe margin, landscape composition approximately 70:48, both words fully visible.
Background: genuinely transparent surrounding background, PNG with actual alpha transparency; no white or colored backdrop, no checkerboard drawn into the image.
Constraints: only these two words, no extra words, no underline, no shadow, no decorative objects.
```
