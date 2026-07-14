# Enterprise HRMS

Production-ready React Native CLI + TypeScript HRMS application for Android-first enterprise deployment.

## Setup

```sh
npm install
npm start
npm run android
```

For iOS development:

```sh
cd ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

## Environment

API configuration lives in `src/constants/app.ts`.

- `apiBaseUrl`: backend base URL.
- `sessionExpiryMinutes`: current access-token lifetime.
- `appLockAfterMs`: configurable background lock threshold. Default is 5 minutes.
- `officeLocation`: latitude, longitude, and geofence radius.

Do not commit secrets. Replace demo API URLs with environment-specific config before release.

## Folder Structure

- `src/components`: reusable cards, buttons, inputs, state, and layout primitives.
- `src/navigation`: root stack and bottom tab navigation.
- `src/screens`: auth, dashboard, attendance, profile, requests, settings, and static module UI.
- `src/services`: API client, biometrics, permissions, location, network, session storage, and feature services.
- `src/repositories`: feature orchestration and backend/local persistence boundaries.
- `src/store`: Redux Toolkit slices and typed hooks.
- `src/database`: SQLite attendance queue.
- `src/localization`: translation dictionaries and locale switching entry point.
- `src/theme`: colors, spacing, typography, Paper theme, and global styles.
- `src/utils`, `src/constants`, `src/types`, `src/validators`: shared enterprise support code.

## Implemented Phase 1 Capabilities

- Authentication with secure MMKV session storage.
- Face login with live front-camera selfie capture and face-verification API placeholder.
- Mandatory first-login face registration gate. Dashboard and attendance remain blocked until the employee registers a live selfie.
- Future-ready refresh-token session model.
- Automatic session restore and expiry redirect.
- Biometric login and app lock with device credential fallback.
- Mock location detection for login and attendance. Android mock-provider locations, including Fly GPS style spoofing, are blocked.
- Continuous mock-location session guard. If a logged-in user opens/enables Fly GPS later, the app clears the session and blocks access.
- Dashboard with employee, attendance, announcements, holidays, and metrics.
- Attendance flow with front-camera live selfie capture, registered-face backend verification placeholder, OS biometric authentication, GPS lookup, mock-location block, backend/multi-office geofence fallback, attendance API placeholder, and local persistence.
- Offline-first SQLite attendance queue.
- Network monitoring with automatic pending attendance sync on reconnect.
- Reusable loading, empty, error, retry, and banner UI patterns.
- Internationalization-ready strings with English default.
- Static enterprise modules with dummy data and extension-ready screens.
- Working Leave module with Casual Leave, Loss of Pay, and Maternity request submission, balance checks, and local request history.

## Backend Integration Guide

Replace placeholder implementations in these files:

- `src/services/faceVerificationService.ts`: connect `POST /api/attendance/verify-face`.
- `src/services/faceEnrollmentService.ts`: connect face-registration status and enrollment endpoints.
- `src/services/geofenceService.ts`: connect active office geofence endpoint.
- `src/services/attendanceService.ts`: connect `POST /api/attendance/mark`.
- `src/repositories/authRepository.ts`: replace demo login with auth API and refresh-token handling.
- `src/services/sessionStorage.ts`: move the encryption key to Android Keystore or equivalent native secret management.

Attendance payloads already include employee ID, timestamp, coordinates, device ID, attendance type, selfie reference, network type, battery percentage, app version, sync status, and audit metadata.

## Build

```sh
npm run lint
npm test
npm run android -- --mode=release
```

Before production release, configure signing keys, backend URLs, certificate pinning, SSL pinning, analytics, crash reporting, and app distribution.
