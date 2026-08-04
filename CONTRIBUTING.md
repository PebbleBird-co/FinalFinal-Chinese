# 参与贡献

感谢你帮助改进 File Archaeologist。提交代码前，请先确认改动仍然遵守本地、只读、可解释的产品边界。

## 开发环境

- Node.js 22 或更高版本
- pnpm 9 或更高版本
- Windows 10/11 是首要运行平台

```bash
pnpm install
pnpm run fixture:demo
pnpm run dev
```

## 安全边界

所有贡献必须满足：

- 不读取或解析被调查文件的正文。
- 不上传文件、路径或元数据，不引入遥测和外部 AI API。
- 不移动、重命名、覆盖或删除用户文件。
- Renderer 不直接访问 Node.js 或文件系统；系统能力必须通过最小白名单 IPC 暴露。
- 所有推断保留置信度、依据和人工纠正入口，不把推测表述为事实。
- 除 Electron `userData` 和用户明确选择的导出位置外，不增加写入目标。

涉及这些边界的改动，应在 `docs/decisions/` 中增加决策记录。

## 提交改动

1. 先创建 Issue，说明问题、使用场景和预期行为。
2. 保持改动聚焦，不夹带无关重构或依赖升级。
3. 为规则、IPC 合约和用户交互增加与风险相称的测试。
4. 同步 README、PRIVACY.md、`.env.example` 和相关决策记录。
5. 提交 Pull Request 前运行完整检查。

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:fixture
pnpm run build
```

涉及 PDF 时还需运行 `pnpm run test:pdf`；涉及 Windows 打包时运行 `pnpm run dist:win`。

## Pull Request 要求

- 清楚说明问题、解决方案、范围和人工验证方式。
- UI 改动提供截图。
- 不提交 `node_modules/`、`out/`、`dist/`、缓存、日志、真实用户目录或扫描数据。
- 不提交 API Key、令牌、私钥或其他凭据。
- 确认新增依赖的许可证与 MIT 项目兼容。
