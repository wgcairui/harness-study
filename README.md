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

如果你看到 `401 invalid api key`，意思是 plan key 是绑 ZCode 网关的（不出 SDK），不是 harness 的 bug — 拿一个直 Anthropic key 就行。

跑完预期看到 LLM 自己选 `glob` 找 README → `read_file` 读 → `grep` 在 `src/loop.ts` 里搜 import。三层工具都被走到、合并答案。

## 推荐阅读顺序

如果你是第一次打开这个 repo，按下面顺序读最省时间：

1. `AGENTS.md` — 项目目的 + 设计原则
2. `DESIGN.md` — 架构图 + 为什么要这样切
3. `learning-plan.md` — 5 层的 Why / Done / Verify
4. `src/events.ts` → `src/llm.ts` → `src/tools/registry.ts` → `src/permission.ts` → `src/prompt.ts` → `src/loop.ts`
5. `examples/01_repo_qa.ts` — 看一个完整 demo 怎么把它们缝起来

## 真实系统对应地图（带 file:line）

每条都对应到你能看到源码的真实文件。学习 mini harness 时，**不需要对照着念** —— 但回头去看真实系统时能瞬间对上号。

### 事件流

| 这一层 | 真实系统 |
| --- | --- |
| `src/events.ts` (Event union + Emitter) | `~/.zcode/cli/agents/<sess>/<agent>/transcript.jsonl` — 每个 jsonl 行就是一个 event：`turn_started` / `model_request` / `model_streaming`（含 `kind: text_delta \| tool_call \| tool_input_delta`）/ `streaming_tool_ledger_updated` / `tool_batch_complete` / `model_complete` |
| `Emitter.subscribe` | ZCode 的 Electron renderer 通过 IPC 订阅同一组事件流 |

### LLM 客户端

| 这一层 | 真实系统 |
| --- | --- |
| `src/llm.ts` (streamChat) | `~/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk.d.ts:131` — `query({ prompt, options })` 返回 `Query extends AsyncGenerator<SDKMessage>`。ZCode 自己的 LLM 调用在 `/Applications/ZCode.app` 里（闭源）。 |
| `events.ts ↔ llm.ts` 边界 | SDK 里 `MessageStream` 类的 `on('text')` / `on('inputJson')` / `on('contentBlock')` — 本项目同样 3 个 listener。`~/.zcode/agents/claude-code/node_modules/@anthropic-ai/sdk/lib/MessageStream.d.ts:6-19` |

### 工具注册 & dispatch

| 这一层 | 真实系统 |
| --- | --- |
| `src/tools/registry.ts` (Map + dispatch) | `~/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk-tools.d.ts:47-79` — 每个工具都是 `interface { name; description; input_schema }`；本项目 zod 写的 schema 渲染成 Anthropic `input_schema`。 |
| `src/tools/{read_file,glob,grep,bash}.ts` | Claude Code SDK 同样 4 工具 + Plus WebFetch / WebSearch / TodoWrite / NotebookEdit 共 8-9 个。`tool_use` 块的 id 由 SDK 帮我们生成。 |

### Permission

| 这一层 | 真实系统 |
| --- | --- |
| `src/permission.ts` (allowedTools + ask) | `~/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk.d.ts:43` — `Options.permissionMode: "default" \| "acceptEdits" \| "bypassPermissions" \| "plan"`；`Options.allowedTools/disallowedTools`。本项目少了 `plan` 模式（属于深度 2）。 |
| bash 黑名单 | Claude Code 内部也会拦 rm/sudo；写在本项目 `bash.ts` 的 `BLACKLISTED` 数组里 —— 同样的规则。 |

### System prompt

| 这一层 | 真实系统 |
| --- | --- |
| `src/prompt.ts` (buildSystemPrompt) | ZCode 的 `~/.zcode/cli/agents/<sess>/<agent>/metadata.json` 里 `profileSnapshot.systemPrompt` 直接就是这条字符串。`role + rules + tools + skills` 4 段结构 1:1 对应。 |
| 解析 SKILL.md frontmatter | `~/.zcode/cli/plugins/cache/.../skills/<name>/SKILL.md` —— `~/.zcode/skills/ask-matt/SKILL.md` 是真实例子。 |

### Main loop

| 这一层 | 真实系统 |
| --- | --- |
| `src/loop.ts` (runAgent) | `transcript.jsonl` 的事件序列 `turn_started → model_request → model_streaming → streaming_tool_ledger_updated → tool_batch_complete → model_complete → turn_started` 就是这一层的展开。`permission_ask` 等事件在 `<agent>/output.txt` 旁路。 |
| messages 累积 | Claude Code SDK 用 `messages: SDKMessage[]` 一直 push；本项目用 Anthropic `MessageParam[]` —— 同一回事。 |
| exit condition | 三个 stop reason：`end_turn`（无 tool_use）/ `max_turns`（cap）/ `error`。对应 SDK `result.subtype`：`success` / `error_max_turns` / `error_during_execution`（`~/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk.d.ts:81-104`） |

### REPL / UI

| 这一层 | 真实系统 |
| --- | --- |
| `src/repl.ts` (stdio event renderer) | ZCode 的 Electron renderer 同构订阅事件；stdin readline 在 ZCode 里改成 UI 上的 confirm modal。 |

## 跑出来的踩坑记 `progress.md`

每个 commit 都会在 `progress.md` 添一行（计划 vs 实际 + 偏差原因）。有一项已知环境坑：

- **2026-09-01 smoke**：直接调 Provider（bigmodel-start-plan / MiniMax-M3）= `401 invalid api key`。Plan key 绑 ZCode 网关，harness 端无 workaround。需要直 Anthropic key 跑 demo。
