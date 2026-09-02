# GROOV Record Studio — local implementation

## Delivered

- Feed composer: photo / gallery / map background → sport-filtered workout history → portrait (9:16) editor. Text-only posts remain available.
- Real saved GPS coordinates; no synthetic fallback for historical workouts lacking coordinates. Orange route with an outline, start/end dots, and discontinuities at paused/lost-GPS segments.
- Low-label OpenFreeMap vector basemap on web, native platform map snapshot on device. Roads, parks and water remain visible. Required map credit is retained in the canvas/export.
- Map-aligned route by default, detachable route sticker for photos/maps; real metrics are independently toggled, moved, resized, rotated and recolored. Free text and sport logo are independent layers. Photo crop can be moved/pinched, without leaving blank margins.
- GROOV wordmark is fixed at top right. In-app artwork can omit it; the external image capture always restores it. External share files are prepared before the explicit share tap (browser user-activation requirement); unsupported file-sharing falls back to download.
- Posting captures the finished composition rather than uploading the unedited source photo. Real accounts use signed media uploads; web preview artwork uses IndexedDB. Feed preserves image aspect ratio and does not paint legacy text/gradients over it.
- Raw GPS coordinates stay on owner workout endpoints; public member records omit them. Publishing/exporting a route asks for a location-privacy confirmation. Photo metadata is stripped before upload.
- Foreground/background GPS requests navigation accuracy at 1 second / 2 meter intervals. These are OS requests, not a promise of sensor precision. Implausible fixes/jitter are rejected; gaps/pause intervals are not joined into invented distance.

## Database and rollout

- `0015_workout_routes.sql` adds `workout_sessions.route_points` (bounded JSON array). Existing rows get `[]`; their routes cannot be reconstructed from point count alone.
- Apply pending migrations (including preceding `0014_comment_replies_likes.sql`) before starting the updated production API. Workout POST payload limit is 8 MB; track limit is 30,000 fixes. No public migration, push, or deploy was performed in this turn.
- API/shared contracts/mobile must roll out together. Native builds must be rebuilt for the new Expo Sharing/FileSystem/ViewShot dependencies; Expo web hot reload is not native device verification.
- OpenFreeMap public service: https://openfreemap.org/quick_start/ . No API key. Initial map loading needs network and WebGL; failures are shown with retry/photo alternatives, not a fabricated map.

## Verification

- Automated tests cover real-coordinate validation, owner/private route boundaries, saved-route edit round trips, Mercator aspect ratio, antimeridian, segment breaks, external logo policy, independent metric values, bounds, GPS filtering/resume and existing comments/feed regressions.
- TypeScript checks, scoped ESLint, formatting and Expo web export are run locally.
- Follow-up browser QA used an isolated, explicitly synthetic GPS fixture, without saving posts or workouts to the user's account. Verified map snapshot/orange route alignment, no-route history handling, text drag, detached route movement/resize/rotation, photo cover, image output and mandatory external GROOV branding. The temporary QA route was removed before the final build.
- Desktop and 390px viewport checks found and fixed three runtime issues: restored-session onboarding redirect race, RN Web image dimension event mismatch, and SVG shading misalignment during scaled image capture. Rotation-aware bounds were also added to keep edited elements within the artwork.
- Final checks: 73 tests passed (14 contracts, 33 API, 26 mobile), TypeScript, scoped ESLint/Prettier, secret scan, Git whitespace checks and complete API/web build passed. Web export contains 31 routes, with no QA route.
- Feed comment/reply UI, activity start/cancel, deletion confirmation/cancel and profile deep links were checked without deleting or creating user records. Physical-device GPS/camera/two-finger/native-share tests and production migration/deployment were not performed. Manual acceptance still needs an actual recorded outdoor track and Android/iOS devices.

## Manual acceptance sequence

1. Record a short outdoor run/cycle, pause/move/resume, stop/save. Reopen history: route remains, with no line across the pause.
2. Feed → map → choose that workout: real route aligns with roads; toggle minimal place names; retry with network unavailable.
3. Switch to photo → adjust crop → move/pinch orange route; choose metrics; add/move/pinch/rotate/color text and sport logo.
4. Turn off in-app GROOV → publish: feed preserves the edited portrait, including after refresh. Original workout remains intact.
5. Turn off GROOV → external image: GROOV must still appear top-right; no handles/selection borders. Verify native share and browser download fallback.
6. Check a historical workout without coordinates: no fabricated route. Check a different user's public profile: raw GPS is absent.
