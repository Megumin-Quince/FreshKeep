# FreshKeep

FreshKeep 是一款离线优先的 React Native 冰箱食材管理应用，用于记录放入冰箱的物品、所在分区、温度和预计保鲜日期。

[English](README.md)

## 功能

- 单机离线管理冰箱食材，并使用本地存储持久化。
- 可配置冰箱分区，例如冷藏区、保鲜抽屉、冷冻室。
- 可配置食材类别及默认保鲜天数。
- 支持手动录入名称、数量、备注、类别、分区和保鲜期。
- 支持本地模拟图片识别，用于快速预填食材信息。
- 自动计算新鲜、临期和过期状态。
- 通过仓库和网关接口保留后续接入后端 API 的能力。

## 技术栈

- Expo SDK 52
- React Native 0.76
- TypeScript
- AsyncStorage
- Expo Image Picker
- Expo Vector Icons

## 环境要求

- Node.js 18 或更高版本
- npm
- 移动端预览可使用 Expo Go、iOS 模拟器或 Android 模拟器

## 安装

```bash
npm install
```

## 开发启动

启动 Expo 开发服务：

```bash
npm start
```

启动 iOS：

```bash
npm run ios
```

启动 Android：

```bash
npm run android
```

浏览器预览：

```bash
npm run web
```

## 验证

运行 TypeScript 类型检查：

```bash
npm run typecheck
```

运行依赖安全审计：

```bash
npm audit --omit=dev
```

## 编译与打包

导出 Web 静态产物：

```bash
npm run build:web
```

产物会生成在 `dist/` 目录。

导出 Expo bundle：

```bash
npm run export
```

iOS 与 Android 生产包建议使用 EAS Build：

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

## 项目结构

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

## 数据与接口扩展

当前 FreshKeep 是单机应用，数据通过 `AsyncStorage` 保存在本地。

主要扩展点：

- `src/services/localRepository.ts`：本地仓库和 `RemoteInventoryGateway` 远程同步占位接口。
- `src/services/recognitionService.ts`：本地模拟识别服务，后续可替换为真实 OCR 或图片识别 API。
- `src/types/inventory.ts`：食材、分区、类别和识别结果的共享类型定义。

## 说明

- 当前版本的图片识别是本地模拟，不会上传图片。
- 冰箱分区和食材类别可在 FreshKeep 标题旁的配置入口中维护。
- 保鲜日期按本地日期计算，避免 UTC 日期导致的跨天偏差。
- `package.json` 中使用 `overrides` 固定部分传递依赖安全版本，以保持 Expo SDK 52 兼容并通过依赖审计。
