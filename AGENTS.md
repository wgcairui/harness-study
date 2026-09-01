---
read_when:
  - opening any file under src/
  - running examples/
  - extending with new tools or new layers
priority: project
globs: ["src/**/*.ts", "examples/**/*.ts", "tools/**/*.ts"]
maturity: learning
---

# AGENTS.md — 给 ZCode / Claude Code 读的项目上下文

## 1. Project purpose

`~/Code/harness-study` 是一个**纯学习项目**，用来从零拆解 Claude Code / ZCode 风格的 agent harness。它**不影响任何外侧项目**，不写任何 ~/.zcode/ 下的配置，不挂 hook，不建 cron。

目标产出：理解以下 5 层的工作原理，并能动手用 200–400 行 TS 复现它们。

## 2. Architecture layers

| 层 | 文件 | 职责 |
| --- | --- | --- |
| Streaming events | `src/events.ts` | 定义 harness↔UI 的事件流类型（text_delta / tool_call / tool_result / permission_ask / done） |
| LLM client | `src/llm.ts` | 调 Anthropic Messages API、SSE 解析、组装 assistant message |
| Tools | `src/tools/registry.ts` + `src/tools/*.ts` | 工具 schema (zod) + handler switch + 注册表 |
| Permission | `src/permission.ts` | allowedTools 白名单 + 风险工具二次确认 hook |
| System prompt | `src/prompt.ts` | 拼装 role + tool schemas + skills 列表 |
| Main loop | `src/loop.ts` | 调度循环、消息累积、tool_use ↔ tool_result、退出条件 |
| REPL | `src/repl.ts` + `src/index.ts` | stdio 交互入口、事件打字输出 |

**学习的最短读懂路径**：`events → llm → tools → permission → prompt → loop → repl → examples`

## 3. Design principles

1. **Tool 注册必须填齐 `name` / `description` / `input_schema (zod)`**，缺一项即注册失败。这是 harness 与 LLM 之间的契约。
2. **Permission 决策必须经 `permission.ts`**，工具内禁止自决 allowed/denied。
3. **Main loop 不直接读 / 写文件系统**，只能通过 tool 间接访问。这样所有副作用都经过 permission 层。
4. **System prompt 不能拼接外部网络内容**（不允许 webfetch 拼进 system；只允许拼本地 AGENTS.md / SKILL.md frontmatter）。
5. **事件流是单向的**：harness → emit → UI；不允许 UI 回调改 messages。
6. **每完成一个 layer 立刻独立 commit**，对应 `learning-plan.md` checkbox 勾上 + `progress.md` 添一行。

## 4. Reading order for new agents

如果你是 ZCode / Claude Code 第一次打开这个 repo，按这个顺序读最省时间：

1. `src/events.ts`（约 50 行）— 先把事件类型看完，后续代码都基于它
2. `src/llm.ts` — 看清 SSE 怎么拼成 assistant message
3. `src/tools/registry.ts` + `src/tools/read_file.ts` — 一个完整的 tool 长什么样
4. `src/permission.ts` — 看拦截点
5. `src/prompt.ts` — 看 system prompt 怎么拼
6. `src/loop.ts` — **核心**，上面四层在这一层汇合
7. `src/repl.ts` + `src/index.ts` — 看 wiring
8. `examples/01_repo_qa.ts` — 看一个完整 demo 怎么用

## 5. Out-of-scope

这个项目**故意不做**的事：

- **MCP**（stdio / SSE / HTTP server 接入）：属于深度 2
- **Context compaction / 摘要压缩**：属于深度 2
- **Session JSONL 持久化 + resume**：属于深度 2
- **完整 skill loader**：本项目只演示 SKILL.md frontmatter 解析流程
- **TUI / Electron 渲染**：只 stdio 打字输出，够学
- **多 provider 适配**：只跑 Anthropic-compatible 协议（GLM-5、Claude、MiniMax-M3 都吃）

## 6. Common pitfalls

- **Zod 4** 与 zod 3 的 API 不同；这个项目用 zod 4（`bun add zod` 已装 4.5）
- **Anthropic SDK v0.122** 默认走 stream 时返回 `MessageStream`；不要用 `client.messages.create` 然后手撕 SSE
- **bun 默认已加载 .env**，不要再 `import 'dotenv'`
- **GLM-5 的 tool calling** 偶尔 finishReason 不带 stop_reason；按数组是否为空判断
