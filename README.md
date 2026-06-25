# FreshKeep

FreshKeep is an offline-first React Native app for managing food in a fridge. It helps users record what they put into the fridge, where it is stored, the storage temperature, and the expected freshness date.

[简体中文](README.zh-CN.md)

## Features

- Offline inventory management with local persistence.
- Configurable fridge zones, such as fridge area, crisper drawer, and freezer.
- Configurable food categories with default freshness days.
- Manual item entry with quantity, notes, category, fridge zone, and freshness period.
- Local mock image recognition flow for quickly prefilling item data.
- Fresh, expiring soon, and expired status calculation.
- Future API integration points preserved through repository and gateway interfaces.

## Tech Stack

- Expo SDK 52
- React Native 0.76
- TypeScript
- AsyncStorage
- Expo Image Picker
- Expo Vector Icons

## Requirements

- Node.js 18 or later
- npm
- Expo Go, iOS Simulator, or Android Emulator for mobile preview

## Install

```bash
npm install
```

## Development

Start the Expo development server:

```bash
npm start
```

Run on iOS:

```bash
npm run ios
```

Run on Android:

```bash
npm run android
```

Run in a browser:

```bash
npm run web
```

## Verification

Run TypeScript checks:

```bash
npm run typecheck
```

Run dependency security audit:

```bash
npm audit --omit=dev
```

## Build

Export a static web build:

```bash
npm run build:web
```

The output is generated in `dist/`.

Export Expo bundles:

```bash
npm run export
```

For production iOS and Android builds, use EAS Build:

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

## Project Structure

```text
.
├── App.tsx
├── README.md
├── README.zh-CN.md
├── app.json
├── package.json
├── src
│   ├── data
│   │   └── fridge.ts
│   ├── services
│   │   ├── dateUtils.ts
│   │   ├── localRepository.ts
│   │   └── recognitionService.ts
│   ├── theme
│   │   └── colors.ts
│   └── types
│       └── inventory.ts
└── tsconfig.json
```

## Data and API Extension

FreshKeep is currently a standalone app. Data is stored locally through `AsyncStorage`.

The main extension points are:

- `src/services/localRepository.ts`: local repositories and the `RemoteInventoryGateway` placeholder.
- `src/services/recognitionService.ts`: local mock recognition service. Replace it with a real OCR or image recognition API when needed.
- `src/types/inventory.ts`: shared inventory, zone, category, and recognition types.

## Notes

- Image recognition is intentionally a local mock in this version. It does not upload images.
- Fridge zones and food categories are user-configurable from the settings entry beside the FreshKeep title.
- Freshness calculations use local dates, not UTC dates, to avoid off-by-one date issues.
- `package.json` uses `overrides` to pin selected transitive dependencies to audited versions while keeping Expo SDK 52 compatibility.
