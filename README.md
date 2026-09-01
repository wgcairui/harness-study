# harness-study

> 一个最小可跑的 Claude Code / ZCode 风格 agent harness，用来从零学 agent loop。

## 它是什么

不是生产工具。是**学习项目**。

模拟 Claude Code SDK 那个 `query()` 函数背后的 5 层原理：

1. **events** — 事件流类型
2. **llm** — Anthropic Messages API 流式客户端
3. **tools** — 工具注册与 dispatch
4. **permission** — allowedTools 白名单 + 风险二次确认
5. **prompt** — system prompt 拼装
6. **loop** — 把上面 5 层缝起来的状态机
7. **repl** — stdio 交互入口

## 跑起来

```bash
# 1. 装依赖（已装可跳）
bun install

# 2. 配凭据（从环境变量读，不动 ~/.zcode/）
cp .env.example .env.local
# 编辑 .env.local：填 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / HARNESS_MODEL

# 3. 跑 demo
bun run examples/01_repo_qa.ts
```

跑完预期看到：

- LLM 自己选 `glob` 找 README
- 选 `read_file` 读内容
- 选 `grep` 在 `src/loop.ts` 里搜 import
- 三层工具都被走到、合并答案

## 推荐阅读顺序

如果你是第一次打开这个 repo，按下面顺序读最省时间：

1. `AGENTS.md` — 项目目的 + 设计原则
2. `DESIGN.md` — 架构图 + 为什么要这样切
3. `learning-plan.md` — 5 层的 Why / Done / Verify
4. `src/events.ts` → `src/llm.ts` → `src/tools/registry.ts` → `src/permission.ts` → `src/prompt.ts` → `src/loop.ts`
5. `examples/01_repo_qa.ts` — 看一个完整 demo 怎么把它们缝起来

## 真实系统对应地图

学完这个 mini harness，再去看真实的 ZCode / Claude Code 时能直接对应上：

| 这一层的概念 | ZCode 真实位置 |
| --- | --- |
| `events.ts` | `~/.zcode/cli/agents/<sess>/<agent>/transcript.jsonl` 里的 `model_streaming` / `tool_ledger_updated` 事件 |
| `llm.ts` | `/Users/cairui/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk.d.ts` 的 `query()` 内部用的就是这层 |
| `tools/registry.ts` | SDK 的 `allowedTools` / `disallowedTools` 字段 |
| `permission.ts` | SDK 的 `permissionMode: default \| acceptEdits \| bypassPermissions \| plan` + `permissionPromptToolName` |
| `prompt.ts` | ZCode 的 `~/.zcode/cli/agents/<sess>/<agent>/metadata.json` 里 `profileSnapshot.systemPrompt` |
| `loop.ts` | ZCode 的 `transcript.jsonl` 里 `turn_started → model_request → ... → turn_started` |
| `repl.ts` | ZCode Electron 渲染层订阅事件 |

具体行级路径等 commit 完后再补一份带 `file:line` 的细节表。

## 克制项（明确不做）

- 不接 MCP server（stdio/SSE/HTTP）
- 不做 context compaction
- 不做 session JSONL 持久化
- 不渲染 TUI / Electron

理由：先把主循环+tool+permission 三件事搞扎实，深度 2 是另一轮。

## 跑出来的踩坑记 `progress.md`

每个 commit 都会在 `progress.md` 添一行（计划 vs 实际 + 偏差原因）。
