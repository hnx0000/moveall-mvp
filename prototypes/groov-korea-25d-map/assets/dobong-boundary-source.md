# 도봉구 · 쌍문1동 경계 데이터

- 파일: `dobong-dongs.geojson`
- 내용: 도봉구 행정동 14개, 모든 원본 속성과 좌표 보존. 임의 경계 생성·왜곡·추가 단순화 없음.
- 기준일: 2026-07-01. 다운로드 확인일: 2026-09-07.
- 좌표계: WGS84 / EPSG:4326, GeoJSON `[경도, 위도]` 순서.
- 원자료: 통계청 통계지리정보서비스(SGIS) 행정동 경계.
- 가공·배포: [vuski/admdongkor](https://github.com/vuski/admdongkor).
- 고정 버전: `7360288277dfd12d74e54b959c59bdd66f852e3a`.
- [전체 원본 GeoJSON](https://raw.githubusercontent.com/vuski/admdongkor/7360288277dfd12d74e54b959c59bdd66f852e3a/ver20260701/HangJeongDong_ver20260701.geojson).
- [데이터 라이선스](https://github.com/vuski/admdongkor/blob/master/LICENSE-DATA): 가공물 CC BY 4.0, 원자료 공공누리 제1유형(출처표시).
- 재현 명령: 프로젝트 폴더에서 `node fetch-dobong-boundaries.mjs`.

지도 출처 표기에는 **통계청 SGIS · vuski/admdongkor**를 포함한다.

## 좌표 범위

도봉구 전체 bbox: `[127.00805516101765, 37.63127886172987, 127.05589253601269, 37.70107989967062]`.

쌍문1동 bbox: `[127.01254712978013, 37.64660111748124, 127.02867294278931, 37.661591467122584]`.

쌍문1동 bbox 중심: `[127.02061003628472, 37.654096292301915]`. 중심 좌표는 카메라 시작점 용도이며 관청 위치나 주소 지점이 아니다.

쌍문1동 행정기관코드 `1132066000`, 통계청 행정구역코드 `11100510`.

## 범위와 정밀도

이 데이터는 실제 공개 행정경계이며, 도로·건물 데이터와 별개다. 도봉구 14개 동 전체에 784개 좌표, 쌍문1동 경계에 68개 좌표가 포함되어 있다. 제공 원본 자체가 통계용으로 일반화된 경계이므로 필지·담장 단위 경계 정확성을 뜻하지 않는다. 높은 확대 배율의 도로·골목·건물 표현은 베이스맵의 실측 지리 피처를 사용한다. 최신 법정 경계의 측량·행정 판정 용도로 사용하지 않는다.

## 검증

- 도봉구의 14개 행정동이 모두 존재하는지 검사.
- 쌍문1동 이름과 행정기관코드의 일치를 검사.
- 모든 좌표가 서울의 경·위도 범위 안인지 검사.
- 추출 시 도형 좌표는 원본 그대로 보존하고 원본 SHA-256을 GeoJSON `source.originalSha256`에 기록.

## 출처표시

This data is derived from administrative-dong boundaries released by Statistics Korea SGIS (https://sgis.kostat.go.kr) under KOGL Type 1, modified by vuski/admdongkor (https://github.com/vuski/admdongkor), distributed under CC BY 4.0.
