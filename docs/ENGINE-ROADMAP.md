# 引擎侧学习路线 — 从"看不出什么是 agent loop"到"我能造一个"

> 这一页是 [`ROADMAP`](./ROADMAP) **阶段 1** 的完整施工图。读完 ROADMAP 后再读这一页，
> 然后跟着做。环境侧（阶段 2-5）的工件安装方法见 [`ENVIRONMENT-HARNESS`](./ENVIRONMENT-HARNESS)；
> 这一页只讲**引擎本身**——代码怎么写、为什么这样写、每一层在生产环境长什么样。
>
> 假设你**完全没写过 agent loop**。如果你已有经验，可以跳到第 3 节直接跟七层节奏走。

---

## 0. agent loop 到底是什么

先回答一个最基本的问题：coding agent 跟普通的聊天 LLM 有什么区别？

**普通聊天 LLM**：你发一段话，它回一段话，结束。

**Coding agent**：你给它一个目标，它自己决定——我能不能直接回答？还是要先读这个文件？要不要执行这条命令？读完再决定下一步。每一步都可能反悔、循环、重试。

这就是 loop。一个最简化的 agent loop 长这样：

```
┌──────────────────────────────────────────────────────────┐
│  loop 永远在做的事：                                       │
│                                                          │
│  把 messages 喂给模型                                      │
│         ↓                                                │
│  模型返回：要么 text（结束），要么 tool_use（"我要用这个工具"）  │
│         ↓                                                │
│  有 tool_use → 执行 tool → 把 tool_result 塞回 messages   │
│         ↓                                                │
│  没有 → 退出 loop（本轮结束，等用户下次输入）                   │
└──────────────────────────────────────────────────────────┘
```

Claude Code、Codex、Aider、Cursor 的 agent 内部都是这个循环。区别只在每一步的实现复杂度和外围加了哪些 hook。

**这就是我们要造的东西。** 一共七层，每一层职责单一，互相通过定义清晰的边界连接。

## 1. 这七层是怎么切出来的

先把"为什么这么切"想清楚，再动手写代码——否则你会陷入"我能不能换个切法"的无限纠结。

| 层 | 文件 | 职责 | 不该承担什么 |
| --- | --- | --- | --- |
| **Streaming events** | `src/events.ts` | 定义 harness↔UI 的事件流类型（text_delta / tool_call / tool_result / permission_ask / done） | 不该知道 LLM 是哪家、不该知道 tool 是什么 |
| **LLM client** | `src/llm.ts` | 调 Anthropic Messages API、SSE 解析、组装 assistant message | 不该知道 loop 长什么样、不该决定要不要调 tool |
| **Tools** | `src/tools/registry.ts` + `src/tools/*.ts` | 工具 schema (zod) + handler switch + 注册表 | 不该知道模型看到什么描述、不该决定能不能调用 |
| **Permission** | `src/permission.ts` | allowedTools 白名单 + 风险工具二次确认 hook | 不该知道 tool 的具体实现、不该写工具逻辑 |
| **System prompt** | `src/prompt.ts` | 拼装 role + tool schemas + skills 列表 | 不该生成运行时 content、不该访问网络 |
| **Main loop** | `src/loop.ts` | 调度循环、消息累积、tool_use ↔ tool_result、退出条件 | 不该读 / 写文件系统（那是 tool 的活） |
| **REPL** | `src/repl.ts` + `src/index.ts` | stdio 交互入口、事件打字输出 | 不该回调改 messages（事件流是单向的） |

**为什么这么切**：每一层的边界都是为了隔离复杂度。你换 Anthropic 之外的 provider 时只动 `llm.ts`；你加一个 tool 时只动 `src/tools/` 下新文件 + `registry.ts` 一行注册；你收紧权限策略时只动 `permission.ts`；你换 UI（stdio → Electron）时只动 `repl.ts` + `index.ts`。

## 2. 准备好工具

动手前确认三件事：

1. **Bun 已经装好**（[bun.sh](https://bun.sh)）：`bun --version` 应输出 ≥1.0
2. **依赖能装**：`bun install` 在仓库根目录跑通
3. **基线验证能过**：`bunx tsc --noEmit` exit 0；`./init.sh` 跑通

如果有任何一步红，先按报错修——**不要在坏基线上叠新功能**。

## 3. 七个 layer 的施工顺序

下面七小节就是具体怎么写了。每节都有"为什么独立一层 / Done means / Verify / 看真实系统的哪一行"四块。

### Layer 1 — 事件流（`src/events.ts`）

**为什么独立一层**：所有后续层都向 UI 推事件流；先把事件类型定清楚，其他层才能"对接口编"。如果事件类型每改一次，后面六层都要跟着改一遍。

**Done means**：
- 定义 `Event` discriminated union（`text_delta` / `text_done` / `tool_call_start` / `tool_call_delta` / `tool_call_done` / `tool_result` / `permission_ask` / `permission_denied` / `done`）
- 暴露 `Emitter` 实现，能 `emit` + `subscribe`
- `subscribe(handler)` 返回 `unsubscribe` 函数（订阅生命周期要可释放）

**Verify**：`bun run src/index.ts`（此时 index 入口还简陋，仅打印已收事件即可）。可以跑通说明 Emitter 工作了。

**真实系统对照**：ZCode `~/.zcode/cli/agents/<sess>/<agent>/transcript.jsonl` 里的事件就是这个层对应的东西。ZCode 一个 jsonl 行就是一个 event：`turn_started` / `model_request` / `model_streaming`（含 `kind: text_delta \| tool_call \| tool_input_delta`）/ `streaming_tool_ledger_updated` / `tool_batch_complete` / `model_complete`。

**实战练习**：把 `subscribe` 改成"最多缓冲 N 条，没消费就丢"——体会事件流的背压处理（生产环境是 JSONL 落盘背压）。

### Layer 2 — LLM 流式客户端（`src/llm.ts`）

**为什么独立一层**：不能让 loop 直接知道"Anthropic SDK 怎么调用"。所有 model-specific 知识（headers、SSE 协议、tool_use block 的累积策略）都封在这层。换成 OpenAI 也只改 `llm.ts`。

**Done means**：
- `streamChat(messages, system, tools)` 返回 `AsyncIterable<assistantDelta>`
- 能解析 Anthropic `MessageStream` 的 `text` / `input_json_delta` 块
- 能把流上累积出的 content blocks 序列化成完整的 assistant message

**Verify**：`bun test` 一个单元测试，喂固定 `messages`，mock 一个 `MessageStream`，断言累积出来的 tool_use JSON 完整。**这一层也是 learning-plan 里 `test-001` 的优先目标**——不补这层的测试，整个 loop 的回归保护就缺一环。

**真实系统对照**：`@anthropic-ai/sdk` 包里 `client.messages.stream` 一个方法就是这一层；Claude Code SDK 用 `MessageStream` 的 `on('text')` / `on('inputJson')` / `on('contentBlock')` 三个 listener——你写的也是 3 个 listener。

**实战练习**：在 `streamChat` 上加一个"超时中断"——流式调用超过 30s 没收到任何 chunk 就 abort，emit 一个 `error` 事件。生产环境的 Anthropic API 在网络抖动时会卡 stream，这个保护 loop 不能裸跑出去。

### Layer 3 — 工具注册与 dispatch（`src/tools/`）

**为什么独立一层**：agent 与外部世界的唯一边界。tool 定义 = 给 LLM 看的 schema + 给机器执行的 handler，二者必须绑死。

**Done means**：
- 注册表能查得到 4 个 tool（read_file / glob / grep / bash）
- 每个 tool 有 `name` / `description` / `inputSchema (zod)` / `handler(args)`
- **不允许工具 schema 缺字段注册**——这是 harness 与 LLM 之间的契约，缺一项即注册失败

**Verify**：单元测试 `bun test` 跑通每个 tool 的 happy path + + 1 条 fail path（如 bash 命中黑名单命令 `rm -rf /`）。

**真实系统对照**：ZCode `~/.zcode/agents/claude-code/node_modules/@anthropic-ai/claude-code/sdk-tools.d.ts:47-79` 里每个工具都是 `interface { name; description; input_schema }`——你写的 zod schema 渲染成 Anthropic `input_schema` 是同一回事。本 repo 当前 4 个工具对应 Claude Code SDK 的 read_file / glob / grep / bash 一一对应。

**实战练习**：加第 5 个工具——`list_dir` 或 `webfetch`。体会"加 tool = 加 1 文件 + 1 行注册"，而不是改 6 个文件。

### Layer 4 — 权限层（`src/permission.ts`）

**为什么独立成层而非 tool 内自决**：tool 内自决 = N 个 tool 各自一套黑名单白名单 = 重复、易漏、可被绕过。统一在 `permission.ts` 有一个 `canCall()` 函数，loop 调用前先过它。bash tool 自己再过一遍自己的黑名单（双层防御），因为低层防御更快。

**Done means**：
- `canCall(toolName, args, allowedTools)` 拒绝不在白名单的
- `requireConfirm(toolName, args)` 对 bash 类 / write 类工具弹确认
- bash tool 黑名单（`rm` / `sudo` / `mkfs` / `dd` ...）

**Verify**：单元测试 mock 一个 ask hook，确认能拦截 / 放行 / 拒三种情况。

**真实系统对照**：Claude Code SDK 的 `permissionMode: "default" \| "acceptEdits" \| "bypassPermissions" \| "plan"`；`Options.allowedTools/disallowedTools`。本 repo 少了 `plan` 模式（属于深度 2）。

**实战练习**：加一个"敏感路径保护"——bash tool 不允许写 `/etc/`、`~/.ssh/` 等。把判定放在 `permission.ts` 而不是 bash.ts 里——体会"中心判定 vs 各自判定"的差异。

### Layer 5 — System prompt 拼装（`src/prompt.ts`）

**为什么禁止网络拼接**：网络内容进 system prompt = 提示注入风险（你 fetch 了一个恶意页面，LLM 就被指引过去了）。本地文件 frontmatter 是显式 import 的，没有这个风险。

**Done means**：
- `buildSystemPrompt({ role, tools, skills })` 输出字符串：role 段 + 当前工作目录 + 工具描述块 + skills frontmatter 列表
- **禁止**从网络拉内容
- 输出可被 loop 直接拼到 `messages[0].content`

**Verify**：单元测试断言上面 4 段都在；并 assert 字符串里有"工具调用必须"等硬约束。

**真实系统对照**：ZCode `~/.zcode/cli/agents/<sess>/<agent>/metadata.json` 里 `profileSnapshot.systemPrompt` 直接就是这条字符串。`role + rules + tools + skills` 4 段结构 1:1 对应。

**实战练习**：在 buildSystemPrompt 里加上"项目目录下的 ARCHITECTURE.md 内容"作为额外段——但要读本地文件，不能 fetch URL。

### Layer 6 — 主循环（`src/loop.ts`）**[整合层]**

**为什么是整合层**：上面五层在这里汇合。这是一个会"想-调-想-调-想"的状态机，不是 LLM 调用。

**Done means**：
- `runAgent({ prompt, allowedTools, maxTurns })` 跑通 demo `examples/01_repo_qa.ts`
- 事件被 REPL 实时打印
- tool_use 被 dispatch + permission 拦
- tool_result 回灌 messages
- **三个退出条件**：`end_turn`（无 tool_use）/ `max_turns`（cap）/ `error`

**Verify**：`bun run examples/01_repo_qa.ts` 真打到 LLM，三层工具（read_file / glob / grep）都被走过一次。本 repo 当前 `smoke-001` 因 plan key 401 blocked，需直 Anthropic key 跑通。

**真实系统对照**：ZCode `transcript.jsonl` 里 `turn_started → model_request → model_streaming → tool_ledger_updated → tool_batch_complete → model_complete → turn_started...` 就是这一层的展开。**这是 README "真实系统对应地图" 的核心**——读完 README 再回来对照。

**实战练习**：在 runAgent 上加 token 预算（total token > N 就 abort）。体会"loop 不是裸跑 LLM，而是带资源的有限循环"。

### Layer 7 — REPL + CLI 入口（`src/repl.ts` + `src/index.ts`）

**为什么单独一层**：把事件流连到一个能看的输出。学习用 stdout 打字即可。

**Done means**：
- `bun run src/index.ts --prompt "..."` 能跑 REPL
- 事件实时显示
- `permission_ask` 时停在 y/N

**Verify**：跑一次 `--prompt "list the files in src/"`，看 bash 被拦截 / 放行。

**真实系统对照**：ZCode Electron app 的 renderer 订阅事件；本项目用 stdio 替代。

**实战练习**：把 REPL 改成"按事件类型不同着色"——text_delta 用灰色、tool_call 用蓝色、permission_ask 用黄色。体会"事件流的展示层独立于循环层"的好处。

## 4. 实战 demo — 把七层缝起来

读完上面七层后，跑一个端到端 demo 把它们全串一遍：

```bash
bun run examples/01_repo_qa.ts
```

这个 demo 的 prompt 是类似："用 glob 找 README.md → read_file 读它 → grep 在 src/loop.ts 里搜 import → 合并答案"。三层工具都被走到。

预期输出（事件流顺序）：
1. `text_delta` ...（agent 思考要不要直接答）
2. `tool_call_start` `{ name: 'glob', args: { pattern: 'README.md' } }`
3. `tool_result` `[doc list]`
4. `tool_call_start` `{ name: 'read_file', args: { path: 'README.md' } }`
5. `tool_result` `[content]`
6. `tool_call_start` `{ name: 'grep', args: { path: 'src/loop.ts', pattern: 'import' } }`
7. `tool_result` `[matches]`
8. `text_delta` ...（合并答案）
9. `done`

如果跑出来不是这个顺序，说明哪一层的边界没切对。

## 5. 怎么知道你真的懂了

读完七层、跑通 demo 后，用这三个问题验证：

1. **不参考源码**，你能画出 loop 状态机图吗？messages 累积、tool_use↔tool_result、三个退出条件，全部要标出来
2. 给一个具体的扩展需求（比如"加 token 预算"），你能指出要改哪几层、为什么不是其他层？
3. 解释为什么 `loop.ts` 不能直接读文件系统（答案：读 fs 是 tool read_file 的活。若 loop 自己读，整个 permission 机制对 fs 无效；tool 间隔离也丢失）

答不出来就回看——这不是"测试你记忆"，是确保你对边界的理解够具体，能动手扩展。

## 6. 跨层思考题（动手做，不看答案）

| 思考题 | 训练的能力 |
| --- | --- |
| 在 events.ts 加一个"事件过滤器"层（按 type 过滤），观察对 loop.ts 有什么影响？ | 边界设计 |
| 把 permission 改成"per-tool 的策略对象"（`bash: BashPolicy`, `write: WritePolicy`），怎么改最省事？ | 接口稳定性 |
| 给 loop.ts 加"可恢复中断"——按 Ctrl-C 不退出，下次执行从中断处继续。需要改哪几层？ | 状态持久化（深度 2 入口） |
| 把 REPL 换成 WebSocket 服务，前端是 Electron 渲染。loop.ts 要改吗？ | 解耦边界 |
| 让 loop 支持"中途插入新 prompt"（不打断当前 turn），messages 累积策略怎么改？ | 时序正确性 |

## 7. 当前的真实状态（透明登记）

这一节的目的是"不让你以为造完了"——下面是本 repo 真实的进展：

| Layer | 代码 | 单元测试 | demo 跑通 |
| --- | --- | --- | --- |
| 1 events | ✓ | ✗ | — |
| 2 llm | ✓ | ✗（test-001） | — |
| 3 tools | ✓ | ✗（test-001） | — |
| 4 permission | ✓ | ✗（test-001） | — |
| 5 prompt | ✓ | ✗（test-001） | — |
| 6 loop | ✓ | ✗（test-001） | ✗（smoke-001，401） |
| 7 repl+index | ✓ | ✗ | — |

**`test-001` 是本路线最优先的下一项**——learning-plan 里早就承诺过 bun test，但一个测试文件都不存在。这不是污点，是真实状态。具体怎么补、按什么顺序，见仓库根目录的 [`learning-plan.md`](https://github.com/wgcairui/harness-study/blob/main/learning-plan.md)。

## 8. 进阶路径

学完阶段 1 后，按 [`ROADMAP`](./ROADMAP) 继续：

- 阶段 2（造环境）— 把五子系统装进你的真实项目：[`ENVIRONMENT-HARNESS`](./ENVIRONMENT-HARNESS)
- 阶段 3（验证与可观测）— 让"完成"绑定到证据
- 阶段 4（循环工程）— 从手动开车到设计马路
- 阶段 5（图工程与前沿对齐）— [`FRONTIER-HARNESS`](./FRONTIER-HARNESS) 拆 Pi / Claude Code / Codex / DeepSeek

深度 2 方向（毕业后再做）：MCP、context compaction、session 持久化 + resume、多 agent 编排。详见根目录 README 的 "Out-of-scope" 段。