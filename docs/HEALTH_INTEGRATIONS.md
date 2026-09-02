# Health Connect / HealthKit 연동 경계

## 1차 허브

- Android: Health Connect
- iOS: HealthKit
- Garmin, Galaxy Watch, COROS 등의 개별 연결은 우선 각 플랫폼 허브로 동기화된 기록을 가져온다.

`createPlatformHealthAdapter()`는 플랫폼별 어댑터를 선택한다. Android는 `react-native-health-connect`, iOS는 `@kingstinct/react-native-healthkit`을 직접 사용하며 웹은 지원 불가 상태를 반환한다. 두 라이브러리는 Expo Go가 아니라 Health 권한이 포함된 GROOV 네이티브 개발/운영 빌드에서 검증한다.

## 요청 데이터 최소화

GROOV가 현재 화면과 기록 계산에 사용하는 운동 세션, 심박, 걸음, 거리, 칼로리, 고도, 운동 경로만 요청한다. 수면, 생식 건강, 의료 기록 등 현재 기능과 무관한 데이터는 요청하지 않는다.

권한은 사용자가 연결 버튼을 누른 시점에 요청하고, 매 동기화 전에 다시 확인한다. 일부 권한을 거부해도 허용된 데이터와 수동 입력 기능은 계속 동작해야 한다.

## 구현 범위

- 사용자가 내 정보의 `건강 앱 · 웨어러블 기록`에서 권한을 직접 요청한다.
- 최근 30일의 완료 운동을 가져와 GROOV 기록으로 저장하고, GROOV에서 완료한 운동·거리·칼로리를 건강 앱에 저장한다.
- 시작 시각과 종목이 같은 기록은 중복 저장하지 않는다.
- 운동 시간, 거리, 칼로리, 걸음, 심박, 고도 등 제공자가 허용한 값을 함께 가져온다.
- 최초 연결 뒤에는 앱이 활성화될 때 15분 간격으로 양방향 동기화하며, 수동 `지금 양방향 동기화`도 제공한다.
- 휴대폰 GPS 실시간 기록은 홈 기록기가 담당하고, 승인 시 Android foreground service/iOS background location으로 화면이 꺼진 동안에도 경로를 버퍼링한다.

Health Connect와 HealthKit은 완료된 운동을 교환하는 허브다. Apple Watch와 Galaxy Watch의 완료 기록은 각 허브를 거쳐 동기화한다. 워치의 실시간 심박·수심·다이내믹을 GROOV 화면으로 스트리밍하려면 별도 Watch 앱과 기기 세션 브리지가 필요하므로 현재 어댑터는 `liveMetrics=false`를 명시한다. Garmin/COROS 직접 동기화는 각 사업자 API 승인 전까지 휴대폰 건강 허브에 들어온 기록을 사용한다.

운영 앱 식별자는 iOS와 Android 모두 `com.longrun0000.groov`로 고정한다. HealthKit은 Apple Developer entitlement 승인이 필요하고, Health Connect는 Play Console의 Health apps declaration, 개인정보 처리방침 링크와 권한 근거 화면이 필요하다. 스토어 개발자 계정에서 식별자를 등록한 뒤 실제 기기 빌드로 최종 검증한다.

## Galaxy Watch 실시간 연동 후속 로드맵

사용자가 추후 "갤럭시워치 실시간 연동", "Wear OS 연동" 또는 이에 준하는 작업을 요청하면 아래 순서로 진행한다.

1. 현재 Health Connect 완료 기록 연동을 실제 Galaxy Watch와 Android 기기에서 검증한다.
2. GROOV Wear OS 앱을 제작한다.
3. 워치에서 운동 시작·일시정지·재시작·종료를 구현한다.
4. 심박·거리·페이스를 Wear OS Data Layer로 휴대폰 GROOV에 실시간 전송한다.
5. 연결 끊김 복구, 세션 상태 동기화 및 중복 기록 방지를 구현한다.
6. 기본 운동 연동이 안정화된 뒤 Samsung Health Sensor SDK를 이용한 삼성 전용 센서를 추가한다.

기본 운동 데이터는 Wear OS Health Services의 `ExerciseClient`를 우선 사용한다. Samsung Health Sensor SDK는 ECG, PPG, 체성분, 피부 온도 등 삼성 전용 데이터가 실제 제품 요구사항에 포함될 때 적용한다. 실시간 연동 시 워치 앱을 운동 세션의 기준으로 삼고 휴대폰 앱은 화면 표시·제어·서버 저장을 담당한다.

## 안전 규칙

- 센서 값은 의료 판단에 사용하지 않는다.
- 가져온 기록의 출처를 `wearable`로 저장한다.
- 현재는 종목과 시작 시각을 기준으로 중복을 방지한다. 출시 전에는 제공자 원본 세션 ID를 저장하는 컬럼을 추가해 중복 방지를 강화한다.
- GROOV에서 건강 앱으로 내보낸 기록 ID는 기기 저장소에 보관해 동일 기기에서 재전송하지 않는다.
- 다이빙 수심과 다이내믹은 지원 기기가 확인되기 전까지 수동 입력을 유지한다.
