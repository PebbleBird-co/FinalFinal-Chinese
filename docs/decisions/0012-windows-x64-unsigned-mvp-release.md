# 0012：发布未签名的 Windows x64 MVP

## 状态

已采纳（Phase 10）

## 决策

首个 MVP 版本使用 `0.1.0`，通过 Electron Builder 生成 Windows x64 的 NSIS 安装器。安装器、卸载器和应用可执行文件统一使用 `assets/brand/logo.png` 派生的多尺寸 Windows 图标。

打包直接使用安装在 `node_modules/electron/dist` 的 Electron 发行目录，保证它与依赖锁定的版本一致，并避免 Builder 再次下载同一运行时。

Electron Builder 所需的 `@electron/get` 3.x 固定为 `3.1.0`。初始锁文件中的 `3.0.0` 不导出 Builder 使用的缓存模式枚举，而 `3.1.0` 在不跨主版本的前提下补齐该接口。

GitHub Release 工作流只在 `v*` 标签推送时运行，先执行 lint、类型检查、测试和生产构建，再生成安装器并创建对应 Release。普通分支和普通提交不会触发外部发布。

## 理由

- Windows x64 是计划明确的 MVP 首发目标。
- NSIS 支持用户选择安装目录、开始菜单和桌面快捷方式，满足桌面工具的基础安装体验。
- 标签触发避免未完成代码被意外发布。
- `0.1.0` 清楚表达首个可用但仍处于早期阶段的版本状态。

## 范围限制

- 当前没有代码签名证书，安装器保持未签名，Windows 可能显示“未知发布者”或 SmartScreen 提示。
- Phase 10 不增加自动更新、macOS/Linux 包、崩溃上报或遥测。
- 发布工作流不会上传用户文件、扫描数据或本地报告。
