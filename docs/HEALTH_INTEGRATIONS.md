# Health Connect / HealthKit 연동 경계

## 1차 허브

- Android: Health Connect
- iOS: HealthKit
- Garmin, Galaxy Watch, COROS 등의 개별 연결은 우선 각 플랫폼 허브로 동기화된 기록을 가져온다.

`createPlatformHealthAdapter()`는 플랫폼별 어댑터를 선택한다. 웹은 Mock 어댑터, Android는 `GroovHealthConnect`, iOS는 `GroovHealthKit` 네이티브 브리지를 사용한다. 네이티브 브리지가 없는 Expo Go에서는 `native-build-required` 상태를 반환하므로 앱이 권한 창을 가장하지 않는다.

## 요청 데이터 최소화

GROOV가 현재 화면과 기록 계산에 사용하는 운동 세션, 심박, 걸음, 거리, 칼로리, 고도, 운동 경로만 요청한다. 수면, 생식 건강, 의료 기록 등 현재 기능과 무관한 데이터는 요청하지 않는다.

권한은 사용자가 연결 버튼을 누른 시점에 요청하고, 매 동기화 전에 다시 확인한다. 일부 권한을 거부해도 허용된 데이터와 수동 입력 기능은 계속 동작해야 한다.

## 네이티브 구현 대기 항목

외부 계정과 실기기 빌드가 준비되면 다음 메서드를 각 네이티브 모듈에 연결한다.

- `isAvailable`
- `requestPermissions`
- `startWorkout`
- `readLiveSample`
- `stopWorkout`
- `readWorkouts`

HealthKit은 앱 식별자와 Apple Developer entitlement 승인이 필요하고, Health Connect는 Play Console의 Health apps declaration, 개인정보 처리방침 링크와 권한 근거 화면이 필요하다. 이 단계는 실제 운영 식별자와 개발자 계정이 정해진 뒤 진행한다.

## 안전 규칙

- 센서 값은 의료 판단에 사용하지 않는다.
- 출처를 `wearable`로 저장하고 원본 제공자와 동기화 시각을 추적한다.
- 같은 제공자의 세션 ID를 기준으로 중복 가져오기를 방지한다.
- 다이빙 수심과 다이내믹은 지원 기기가 확인되기 전까지 수동 입력을 유지한다.
