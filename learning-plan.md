# Learning Plan

5 个 layer 的学习路线。每完成一个 layer，在该行末加 `✓ 完成于 <commit-hash>`。

## Layer 1 — Streaming events (events.ts)

- **Why**：所有后续层都向 UI 推事件流；先把事件类型定清楚，其他层才能"对接口编"。
- **Done means**：`src/events.ts` 定义 `Event` discriminated union（`text_delta` / `text_done` / `tool_call_start` / `tool_call_delta` / `tool_call_done` / `tool_result` / `permission_ask` / `permission_denied` / `done`），并暴露 `Emitter` 实现，能 `emit` + `subscribe`。
- **Verify**：`bun run src/index.ts`（index 入口此时还简陋，仅打印已收事件即可）。
- **Depends on**：无。
- **Real-system map**：`~/.zcode/cli/agents/<sess>/<agent>/transcript.jsonl` 里的 `model_streaming` / `tool_ledger_updated` / `tool_batch_complete` 事件就是这个层对应的东西；本项目用 ~5 个事件类型收敛。

## Layer 2 — LLM client (llm.ts)

- **Why**：循环的引擎。把 LLM 当成一个会"想一会儿、可能用 tool、再想"的 model；不需要懂 LLM 怎么训的，但要懂它返回什么、怎么解析。
- **Done means**：`streamChat(messages, system, tools)` 返回 `AsyncIterable<assistantDelta>`；能解析 Anthropic `MessageStream` 的 `text` / `input_json_delta` 块；能把流上累积出的 content blocks 序列化成 assistant message。
- **Verify**：`bun test` 一个 unit test，喂固定 `messages`，mock 一个 `MessageStream`，断言累积出来的 tool_use JSON 完整。
- **Depends on**：Layer 1。
- **Real-system map**：`/Users/cairui/.zcode/agents/claude-code/node_modules/@anthropic-ai/sdk` 包就是这个 client；本项目用其中 `client.messages.stream` 一个方法。

## Layer 3 — Tools (tools/* + tools/registry.ts)

- **Why**：agent 与外部世界的唯一边界。tool 定义 = 给 LLM 看的 schema + 给机器执行的 handler，二者必须绑死。
- **Done means**：注册表能查得到 4 个 tool（read_file / glob / grep / bash）。每个 tool 有 `name` / `description` / `inputSchema (zod)` / `handler(args)`。不允许工具 schema 缺字段注册。
- **Verify**：单元测试 `bun test` 跑通每个 tool 的 happy path + 一条 fail path（如 bash 命中黑名单命令）。
- **Depends on**：Layer 1。
- **Real-system map**：ZCode 的 `streaming_tool_ledger_updated` 三段事件（queued / started / closed）+ `tool_batch_complete` 的 successCount / errorCount 即此层。

## Layer 4 — Permission (permission.ts)

- **Why**：所有副作用都必须经过它。是 harness 的"防火墙"。
- **Done means**：`canCall(toolName, args, allowedTools)` 拒绝不在白名单的；`requireConfirm(toolName, args)` 对 bash 类 / write 类工具弹确认。`bash` tool 黑名单（`rm` / `sudo` / `mkfs` / `dd` ...）。
- **Verify**：单元测试 mock 一个 ask hook，确认能拦截 / 放行 / 拒。
- **Depends on**：Layer 3。
- **Real-system map**：Claude Code SDK 的 `allowedTools` / `disallowedTools` / `permissionMode`（default / acceptEdits / bypassPermissions / plan）就是这里 4 个常量对应的扩展。

## Layer 5 — System prompt (prompt.ts)

- **Why**：拼出来一份能稳定回答、按预期调 tool 的 system prompt，是 harness 的"宪法"。
- **Done means**：`buildSystemPrompt({ role, tools, skills })` 输出字符串：role 段 + 当前工作目录 + 工具描述块 + skills frontmatter 列表。**禁止**从网络拉内容。
- **Verify**：单元测试断言上面 4 段都在；并 assert 字符串里有"工具调用必须" 等硬约束。
- **Depends on**：Layer 3（需要 tools schema）。
- **Real-system map**：`~/.zcode/agents/<sess>/<agent>/metadata.json` 里的 `profileSnapshot.systemPrompt` 就是同款组装；本项目不复制 profile，但结构一样。

## Layer 6 — Main loop (loop.ts) [整合]

- **Why**：上面 5 层在这里汇合。这是一个会"想-调-想-调-想"的状态机，不是 LLM 调用。
- **Done means**：`runAgent({ prompt, allowedTools, maxTurns })` 跑通 demo `examples/01_repo_qa.ts`；事件被 REPL 实时打印；tool_use 被 dispatch + permission 拦；tool_result 回灌 messages；end_turn 退出；maxTurns 强制停。
- **Verify**：`bun run examples/01_repo_qa.ts` 真打到 LLM，三层工具都被走过一次。
- **Depends on**：1+2+3+4+5。
- **Real-system map**：ZCode 的 `transcript.jsonl` 里 `turn_started → model_request → model_streaming → tool_ledger_updated → tool_batch_complete → model_complete → turn_started...` 就是这一层的展开。

## Layer 7 — REPL + entry (repl.ts + index.ts)

- **Why**：把事件流连到一个能看的输出。学习用 stdout 打字即可。
- **Done means**：`bun run src/index.ts --prompt "..."` 能跑 REPL；事件实时显示；`permission_ask` 时停在 y/N。
- **Verify**：跑一次 `--prompt "list the files in src/"`，看 bash 被拦截 / 放行。
- **Depends on**：6。
- **Real-system map**：ZCode Electron app 的 renderer 订阅事件；本项目用 stdio 替代。

---

## 完成情况（AI 在 commit 时同步）

- [x] Layer 1 — events  ✓ 完成于 c6a90a6
- [ ] Layer 2 — llm
- [ ] Layer 3 — tools
- [ ] Layer 4 — permission
- [ ] Layer 5 — prompt
- [ ] Layer 6 — loop
- [ ] Layer 7 — repl + index
- [ ] Example 01 — repo_qa demo
