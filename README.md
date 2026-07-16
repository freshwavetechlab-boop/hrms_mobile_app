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

Do not commit secrets. Configure production resolver and tenant URLs before release.

## Folder Structure

- `src/components`: reusable cards, buttons, inputs, state, and layout primitives.
- `src/navigation`: root stack and bottom tab navigation.
- `src/screens`: tenant selection, auth, dashboard, attendance, leave requests, profile, and settings.
- `src/services`: API client, biometrics, permissions, location, network, session storage, and feature services.
- `src/repositories`: feature orchestration and backend/local persistence boundaries.
- `src/store`: Redux Toolkit slices and typed hooks.
- `src/database`: SQLite attendance queue.
- `src/localization`: translation dictionaries and locale switching entry point.
- `src/theme`: colors, spacing, typography, Paper theme, and global styles.
- `src/utils`, `src/constants`, `src/types`, `src/validators`: shared enterprise support code.

## Implemented Capabilities

- Tenant-code resolution with locally persisted endpoint and validity checks.
- Real HRMS authentication, ESS profile validation, session restore, and expiry handling.
- Dashboard backed by employee, attendance, leave-balance, request, and holiday APIs.
- Month/year-driven attendance and holiday API queries.
- Dynamic leave masters and balances, native date selection, request submission, and request history.
- Attendance capture with a required live selfie, GPS and mock-location checks, and a local retry queue for transient network failures.
- Network monitoring with automatic pending-attendance retry on reconnect.
- Reusable loading, empty, error, retry, and banner UI patterns.
- Internationalization-ready strings with English default.

## Backend Integration Guide

Session tokens and saved login credentials use the platform keychain; MMKV is limited to non-secret local routing/device state. The current punch endpoint receives selfie audit metadata, not the image bytes.

## Build

```sh
npm run lint
npm test
npm run android -- --mode=release
```

Before production release, configure signing keys, backend URLs, certificate pinning, SSL pinning, analytics, crash reporting, and app distribution.
