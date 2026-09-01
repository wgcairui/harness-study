# DESIGN.md — 架构与决策

## 单一图

```
                        ┌─────────────────────┐
                        │     src/index.ts    │  CLI 入口
                        └──────────┬──────────┘
                                   │ prompt, allowedTools
                                   ▼
                        ┌─────────────────────┐
                        │      src/loop.ts    │  状态机：messages + turn 计数
                        └──┬────┬──────┬──────┘
                           │    │      │
              调用 LLM      │    │      │  dispatch tool
                           ▼    │      ▼
                  ┌────────────┐│  ┌──────────────────┐
                  │ src/llm.ts ││  │ src/permission.ts│  拦截点
                  └──────┬─────┘│  └────┬─────────────┘
                         │ SSE  │       │ allowedTools / confirm
                         ▼      │       ▼
                  ┌──────────┐  │  ┌──────────────────┐
                  │ events.ts│◄─┴──┤ tools/registry.ts│  tool 名字 → handler
                  └─────┬────┘     └────┬─────────────┘
                        │              │
                        ▼              ▼
                   REPL stdout    tools/*.ts (read_file / glob / ...)
```

## 每层职责与"为什么这样切"

### events.ts — 为什么 discriminated union

不用 class，是因为 LLM 的 content blocks 在 harness 里就是"一段一段"流入 / 流出的；用 `type: 'text_delta' | 'tool_call_start' | ...` 让 REPL 一句 `switch (event.type)` 就能分发，没有继承 / 多态。

### llm.ts — 为什么独立一层

不能让 loop 直接知道"Anthropic SDK 怎么调用"。所有 model-specific 知识（headers、SSE 协议、tool_use block 的累积策略）都封在这层。换成 OpenAI 也只改 llm.ts。

### tools/registry.ts — 为什么是 Map 不是注册副作用

`Map<string, ToolDef>`。注册时机 = 模块顶层（import 即注册），不传 `permission` / `prompt`。这样测试时可以直接构造一份新的 registry 不污染模块级。

### permission.ts — 为什么独立成层而非 tool 内自决

tool 内自决 = N 个 tool 各自一套黑名单白名单 = 重复、易漏、可被绕过。统一在 `permission.ts` 有一个 `canCall()` 函数，loop 调用前先过它。bash tool 自己再过一遍自己的黑名单（双层防御），因为低层防御更快。

### prompt.ts — 为什么禁止网络拼接

网络内容进 system prompt = 提示注入风险（你 fetch 了一个恶意页面，LLM 就被指引过去了）。本地文件 frontmatter 是显式 import 的，没有这个风险。

### loop.ts — 为什么不读 fs 直接 import tools

读 fs 是 tool read_file 的活儿。若 loop 自己读，整个 permission 机制对 fs 无效；tool 间隔离也丢失。

### repl.ts — 为什么单向事件流

harness → emit → UI 单向。如果 UI 能改 messages，意味着"前端能篡改 LLM 的上下文"，那 permission / 审计 / replay 都不能保证。

## 关键技术选择

| 决策 | 选 X | 不选 Y | 原因 |
| --- | --- | --- | --- |
| Runtime | Bun | Node | 单文件 TS 直跑；Bun 文档一直强调；要先看 bun 1.4 兼容面 |
| LLM SDK | `@anthropic-ai/sdk` | `@anthropic-ai/claude-code` | Claude Code SDK 把循环封死，看不到点子上 |
| Schema | zod 4 | 手写类型 | `description` 字段方便抽出来给 LLM 用；fail path 自带 |
| Tool dispatch | Map<string, ToolDef> + switch | class 注册 | 简单、测试友好、热插拔无副作用 |
| Permission | 中心函数 + 风险 hook | 让每个 tool 自决 | 一处管控，不漏 |
| System prompt | 字符串拼接 | 模板引擎 | 字符串够短、可读 |
| 事件流 | discriminated union over async iterator | RxJS / EventEmitter | Bun 内置 async iterator 够用；不引入新依赖 |
| Provider | Anthropic-compatible (GLM-5 / Claude / MiniMax-M3) | 只 Anthropic 一家 | 学习跨 provider 抽象，配置解耦 |

## 不做的事

- **不做 MCP**：等你决定要不要拉深度 2 时再开
- **不做 session 持久化**：transcript.jsonl 这套（ZCode 的实现）以后再学
- **不做 context compaction**：先看 LLM 端怎么吐出 100k context，再设计摘要策略
- **不做 TUI**：`bun:test` + stdio 打字够学
