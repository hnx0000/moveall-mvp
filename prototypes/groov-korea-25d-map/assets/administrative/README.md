# GROOV nationwide administrative boundary assets

Pinned source snapshot: **2026-07-01**. The source contains **3,558 administrative dongs**, **256 sgg groups**, and **16 sido groups**. No outline was drawn or synthesized.

The source explicitly represents Gwangju and Jeollanam-do together as code `12`, `전남광주통합특별시`. Its pinned README records this July 2026 change as well as the Incheon district changes. The source names/codes are preserved; do not assume 17 groups or map the new codes by merely replacing the first two digits.

## Integration

- `manifest.json`: version, total counts, nationwide bbox, source provenance/SHA, shard locations, sizes, per-shard SHA, and context assets.
- `search-index.json`: `sido`, `sgg`, and `dong` arrays for local name/code search. Dong entries use `{code,statCode,name,sidoCode,sggCode,bbox}`; `code` is the 10-digit `adm_cd2`, while `statCode` is the 8-digit `adm_cd`. Names are full source names. Some sgg names concatenate city and district names, so whitespace-insensitive search is useful.
- `sido/{code}.geojson`: 16 original-feature shards. Fetch `manifest.sido.find(s => s.code === selectedCode).file` relative to the manifest directory. Every original property and coordinate is retained without simplification.
- `context/sido-coarse.geojson`, `context/sgg-coarse.geojson`: recommended fast overview/context assets (rendering only). Standard GeoJSON FeatureCollections with `id=code` and properties `{code,name,sido,sidonm,sgg?,sggnm?,dongCount}`. Use `manifest.context.sidoCoarse.file` / `sggCoarse.file`.
- `context/sido-light.geojson`, `context/sgg-light.geojson`: higher-detail display alternatives. Use `manifest.context.sidoLight.file` / `sggLight.file`.
- `context/sido.geojson`, `context/sgg.geojson`: unsimplified dissolved alternatives, keeping source coordinate values.
- `source/LICENSE-DATA`: the source's data license and required attribution. Include it with redistribution.

Suggested loading: overview uses coarse context (`sido` at zoom <=10, `sgg` below zoom 14); at zoom 14+, fetch the original selected sido shard and filter using source `sgg`/`adm_cd2`. Cache successfully fetched shards. The 16 original shards total 30.19 MB uncompressed (9.98 MB gzip estimate); load them as needed. The search index is 796 KB. The coarse contexts are 1.70 MB/3.28 MB uncompressed (677 KB/1.20 MB gzip estimates). The light contexts are 3.94 MB/8.07 MB uncompressed (1.55 MB/3.08 MB gzip estimates). Gzip sizes in the manifest are estimates of transfer size when the host enables compression, not separate `.gz` files.

Only copy the actual runtime files used by the app. The original source, builder dependencies, scripts, and unsimplified context alternatives are build/audit materials and are not required in the client bundle.

## Provenance and license

Source: https://raw.githubusercontent.com/vuski/admdongkor/7360288277dfd12d74e54b959c59bdd66f852e3a/ver20260701/HangJeongDong_ver20260701.geojson

Source SHA-256: `c01ef44a0eb00978662ba7a6240ccb1da287fb52abd85104a1758969d391132f`

Original download: 34,648,875 bytes, cached at `source/HangJeongDong_ver20260701.geojson`; subsequent builds reuse it.

License: processed data CC BY 4.0; upstream Statistics Korea SGIS boundaries require KOGL Type 1 attribution. See the pinned license: https://github.com/vuski/admdongkor/blob/7360288277dfd12d74e54b959c59bdd66f852e3a/LICENSE-DATA

Required source attribution:

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

Compact map attribution can link `통계청 SGIS · vuski/admdongkor (CC BY 4.0)` to the source/license, with the complete attribution available in the data information panel.

Changes made here: partition original features by `sido`; build name/code/bbox indices; dissolve shared borders using an unquantized TopoJSON topology; optionally simplify the dissolved contexts while retaining topology, small rings, and national extrema. Original dong shards have no geometry changes.

## Validation and coverage

Nationwide bbox: `[124.60968141530441,33.111867852754436,131.8712942504872,38.61695208067501]`.

Coverage checks include Baengnyeong/Daecheong in the west, Ulleung/Dokdo in the east, Heuksan/Chuja, and Daejeong's southern extent at Marado. No island relocation or display inset is applied.

`validation.json` records source/shard counts and island examples. `context/validation.json` records dissolved area comparisons and ring checks. Dissolving removes shared boundaries; maximum source-sum versus dissolved area difference is 0.00638% for a sgg (Yongsan), consistent with a small discrepancy in source topology. This dataset is a third-party processed statistical boundary source, not a cadastral survey.

`context/validation-light.json` confirms light contexts retain all 1,114 sido polygon parts and all 1,348 sgg polygon parts, all rings and national extrema. Effective-area simplification uses a `1e-8` square-degree threshold; rings below `5e-7` square degrees are retained. Existing zero-area rings in the source's dissolved topology are preserved rather than inventing replacement geometry.

`context/validation-coarse.json` applies the same coverage checks to rendering-only coarse contexts. These use a `1e-6` square-degree threshold and retain all rings below `5e-6` square degrees. All retained positions are exact source coordinates, and all polygon parts/rings remain present. These coarse files should not be used for detailed boundary analysis or measurement.

## Reproduce

Install the exact dependencies in this artifact directory with `pnpm install --ignore-workspace --ignore-scripts`, then run:

```sh
node build-boundaries.mjs
node build-context.mjs
node build-light-context.mjs
node build-light-context.mjs --coarse
node verify-boundaries.mjs
```

The build scripts were created via `apply_patch`. Network is used only to fetch the pinned GeoJSON, README, license, and exact TopoJSON packages when missing. The cached source is reused on subsequent builds.
