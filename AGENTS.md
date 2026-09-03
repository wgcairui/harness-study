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

> 本文件按"目录页"标准维护（~100 行）：只写不变量和验证命令，细节指向
> DESIGN.md / learning-plan.md / docs/。本 repo 自己吃自己的狗粮——
> 工件体系（init.sh / feature_list.json / progress.md）就是环境侧方法论的示范，见 docs/ENVIRONMENT-HARNESS.md。

## 1. Project purpose

`~/Code/harness-study` 是一个**纯学习项目**，用来从零拆解 Claude Code / ZCode 风格的 agent harness。它**不影响任何外侧项目**，不写任何 ~/.zcode/ 下的配置，不挂 hook，不建 cron。

双重身份：① 引擎侧学习（亲手造七层 loop）；② 新人渐进教程（docs/ROADMAP.md 阶段 0-5）。

## 2. 开工流程

写代码之前：

1. 读 `progress.md`（当前已验证状态 + 下一步）。
2. 读 `feature_list.json`，选最高优先级未完成项；一次只做一个。
3. 跑 `./init.sh`（装依赖 + 基线验证）。基线已红就先修基线，不叠新功能。
4. `git log --oneline -5` 回顾最近改动。

## 3. 验证命令

```
- 类型检查：bunx tsc --noEmit
- 单元测试：bun test        （当前无测试文件，exit 0；补齐 = feature_list 的 test-001）
- 完整验证：./init.sh       （含以上全部）
- 真机 demo：bun run examples/01_repo_qa.ts   （需直连 Anthropic key；401 = 环境问题，见 README）
```

完成定义：代码写了 + 验证**真跑过** + 证据记入 feature_list.json 或 progress.md。
没有验证证据不许标 passing（`passing_requires_evidence: true`）。

## 4. Architecture layers

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

## 5. Design principles（不变量）

1. **Tool 注册必须填齐 `name` / `description` / `input_schema (zod)`**，缺一项即注册失败。这是 harness 与 LLM 之间的契约。
2. **Permission 决策必须经 `permission.ts`**，工具内禁止自决 allowed/denied。
3. **Main loop 不直接读 / 写文件系统**，只能通过 tool 间接访问。这样所有副作用都经过 permission 层。
4. **System prompt 不能拼接外部网络内容**（不允许 webfetch 拼进 system；只允许拼本地 AGENTS.md / SKILL.md frontmatter）。
5. **事件流是单向的**：harness → emit → UI；不允许 UI 回调改 messages。
6. **每完成一个 layer 立刻独立 commit**，对应 `learning-plan.md` checkbox 勾上 + `progress.md` 添一行 + `feature_list.json` 更新状态与证据。

## 6. Reading order for new agents

1. 本文件（目录页）→ `DESIGN.md`（为什么这样切）→ `learning-plan.md`（每层 Why/Done/Verify）
2. `src/events.ts` → `src/llm.ts` → `src/tools/registry.ts` + `src/tools/read_file.ts` → `src/permission.ts` → `src/prompt.ts` → `src/loop.ts` → `src/repl.ts` + `src/index.ts`
3. `examples/01_repo_qa.ts` — 完整 demo
4. 教程向：`docs/ROADMAP.md`（学习路线总表）→ `docs/REFERENCES.md`（按阶段读什么）→ `docs/ENVIRONMENT-HARNESS.md`（五子系统 + 自审计）→ `docs/FRONTIER-HARNESS.md`（前沿产品映射）

## 7. Out-of-scope（深度 2，毕业后再做）

- **MCP**（stdio / SSE / HTTP server 接入）
- **Context compaction / 摘要压缩**（对标：Claude Code 五层压缩管线）
- **Session JSONL 持久化 + resume**（对标：transcript.jsonl / Codex Thread 原语）
- **完整 skill loader**：本项目只演示 SKILL.md frontmatter 解析流程
- **TUI / Electron 渲染**：只 stdio 打字输出，够学
- **多 provider 适配**：只跑 Anthropic-compatible 协议（GLM-5、Claude、MiniMax-M3 都吃）
- **多 agent / worktree 隔离**（对标：子智能体 sidechain / Codex worktree）

## 8. Common pitfalls

- **Zod 4** 与 zod 3 的 API 不同；这个项目用 zod 4（`bun add zod` 已装 4.5）
- **Anthropic SDK v0.122** 默认走 stream 时返回 `MessageStream`；不要用 `client.messages.create` 然后手撕 SSE
- **bun 默认已加载 .env**，不要再 `import 'dotenv'`
- **GLM-5 的 tool calling** 偶尔 finishReason 不带 stop_reason；按数组是否为空判断
