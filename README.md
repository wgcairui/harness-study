# harness-study

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Roadmap](https://img.shields.io/badge/学习路线-阶段%200→5-blue?style=flat-square)](docs/ROADMAP.md)
[![在线阅读](https://img.shields.io/badge/在线阅读-wgcairui.github.io-success?style=flat-square)](https://wgcairui.github.io/harness-study/)

> 一个最小可跑的 Claude Code / ZCode 风格 agent harness，用来**从零学 agent loop**——
> 同时也是一份**新人可跟随的渐进式教程项目**。
>
> 📱 **想在平板/手机上看？** 直接访问 [wgcairui.github.io/harness-study](https://wgcairui.github.io/harness-study/)，暗色/亮色跟随系统自动切换，侧边栏可折叠。

## 它是什么：一个项目，两种用法

1. **个人学习项目**：亲手把 agent 循环引擎（引擎侧）造一遍，再用 harness 工程方法（环境侧）给这个 repo 本身装上工作环境。方法论来源见文末致谢。
2. **新人教程**：按 [`docs/ROADMAP.md`](docs/ROADMAP.md) 的六个阶段循序渐进——每个阶段有目标、阅读清单、动手作业和验收标准。有 git 基础即可起步。

### 一条路线，两个维度

harness = **模型权重之外的一切工程基础设施**，五个子系统：指令 · 工具 · 环境 · 状态 · 反馈。

```
维度 A · 引擎侧（造 loop）          维度 B · 环境侧（给 loop 修路）
────────────────────────          ────────────────────────────
src/events.ts    事件流             AGENTS.md          指令
src/llm.ts       流式客户端          init.sh            环境/启动
src/tools/*      工具注册+dispatch   feature_list.json  范围/状态
src/permission.ts 权限拦截           progress.md        状态/交接
src/prompt.ts    system prompt      验证命令 + tsc/test 反馈
src/loop.ts      主循环 ← 以上汇合
src/repl.ts      stdio UI
```

只学引擎侧，你写得出能跑的 loop，但不知道真实产品为什么还要 worktree 隔离、五级压缩、maker-checker；
只学环境侧，你抄得来模板，却不知道 `permission_ask` 事件背后发生了什么。路线把它们拼在一起。

### 学习路线总览（详见 [docs/ROADMAP.md](docs/ROADMAP.md)）

| 阶段 | 主题 | 产出 | 状态 |
| --- | --- | --- | --- |
| 0 | 看见问题：为什么强模型不可靠 | 跑通 demo + 1 条自己的失败记录 | [ ] |
| 1 | 造引擎：七层 loop | mini harness + 单元测试 | 七层 ✓ / 测试待补 |
| 2 | 造环境：五子系统工件 | 七件模板装进你的真实项目 | 本 repo 已示范 |
| 3 | 验证与可观测 | evidence-based 完成观 + 评审校准 | [ ] |
| 4 | 循环工程 | goal loop / maker-checker + 干预次数对比 | [ ] |
| 5 | 图工程与前沿对齐 | 四产品 harness 审计 + 毕业考 | [ ] |

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

标准启动/验证路径已固化为 [`init.sh`](init.sh)（装依赖 → `tsc --noEmit` → `bun test` → 打印 demo 命令），当前状态与证据见 [`feature_list.json`](feature_list.json)。

## 推荐阅读顺序

**新人**（从零跟学）：[docs/ROADMAP.md](docs/ROADMAP.md) → 按阶段走。

**只想读懂引擎**（老手快进）：

1. `AGENTS.md` — 项目目的 + 设计原则 + 验证命令
2. `DESIGN.md` — 架构图 + 为什么要这样切
3. `learning-plan.md` — 七层的 Why / Done / Verify
4. `src/events.ts` → `src/llm.ts` → `src/tools/registry.ts` → `src/permission.ts` → `src/prompt.ts` → `src/loop.ts`
5. `examples/01_repo_qa.ts` — 看一个完整 demo 怎么把它们缝起来

**想学环境侧**：[docs/ENVIRONMENT-HARNESS.md](docs/ENVIRONMENT-HARNESS.md)（含本 repo 的五子系统自审计）→ [`templates/`](templates/) 拿模板装进你自己的项目。

## 目录结构

```
harness-study/
├── AGENTS.md            # agent 指令（目录页：原则 + 开工流程 + 验证命令）
├── init.sh              # 标准启动/验证路径
├── feature_list.json    # 功能状态唯一事实来源（含证据）
├── progress.md          # 会话进度日志
├── DESIGN.md            # 架构与决策记录
├── learning-plan.md     # 阶段 1（引擎侧）施工图：七层 Why/Done/Verify
├── src/                 # 七层引擎源码
├── examples/            # 端到端 demo
├── docs/                # 教程
│   ├── ROADMAP.md       #   学习路线（总课程表）
│   ├── REFERENCES.md    #   精选阅读清单（按阶段索引）
│   ├── FRONTIER-HARNESS.md #  前沿拆解读本（Claude Code/Codex/Pi/DeepSeek → 七层映射）
│   └── ENVIRONMENT-HARNESS.md # 五子系统实操 + 本 repo 自审计
└── templates/           # 七件环境侧模板（可复制到你自己的项目）
```

## 真实系统对应地图（带 file:line）

每条都对应到你能看到源码的真实文件。学习 mini harness 时，**不需要对照着念** —— 但回头去看真实系统时能瞬间对上号。前沿产品级的机制映射另见 [docs/FRONTIER-HARNESS.md](docs/FRONTIER-HARNESS.md)。

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

## 进度与踩坑

- 会话日志：[`progress.md`](progress.md)（当前已验证状态 + 每轮会话记录）
- 功能状态与证据：[`feature_list.json`](feature_list.json)（`test-001` 单元测试待补；`smoke-001` demo 真机跑通 blocked 于 401，blocker 有记录）
- 已知环境坑：**2026-09-01 smoke** 直接调 Provider（bigmodel-start-plan / MiniMax-M3）= `401 invalid api key`。Plan key 绑 ZCode 网关，harness 端无 workaround，需直 Anthropic key。

## 方法论来源与致谢

本 repo 的学习路线与环境侧方法论改编自 **[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/zh/)**（WalkingLab，MIT License）——14 讲 + 8 项目 + 模板库 + 前沿 harness 拆解；`templates/` 七件模板由其模板库改编并保留 MIT 署名。课程的核心引用（也是本路线的主轴三篇）：

- [OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)

更多按阶段索引的阅读清单见 [docs/REFERENCES.md](docs/REFERENCES.md)。
