# Progress — 全量笔记型

## Wk 1  (2026-09-01 ~ 2026-09-07)

### 本周目标
- 起项目骨架：bun init + 依赖 + git init
- 起草 5 份文档（AGENTS / learning-plan / progress / README / DESIGN / .env.example）
- 完成 Layer 1（events.ts）
- 完成 Layer 2（llm.ts）
- 跑通 demo `examples/01_repo_qa.ts`

### 计划 vs 实际

| layer | 计划 | 实际 | commit | 偏差原因 |
| --- | --- | --- | --- | --- |
| 0 | docs 骨架 | 完成 | (docs commit) | — |
| 1 | events.ts | 完成 | c6a90a6 | — |
| 2 | llm.ts | 完成 | dd1e891 | — |
| 3 | tools/* | 完成 | 02e1102 | type-check 撞到 Bun GlobScanOptions 没有 follow 字段；删掉 |
| 4 | permission | 完成 | 457d8be | — |
| 5 | prompt | 完成 | 2ff710d | strict regexp 在 TS 上出现 `string \| undefined`，加 None 拦截 |
| 2 | llm.ts | 待办 | — | — |
| 3 | tools | 待办 | — | — |
| 4 | permission | 待办 | — | — |
| 5 | prompt | 待办 | — | — |
| 6 | loop | 待办 | — | — |
| 7 | repl + index | 待办 | — | — |
| 8 | demo + README 完成 | 待办 | — | — |

### 踩坑 / 决策记录

- **decision 09-01**：用 Bun + 直接打 `@anthropic-ai/sdk`，不依赖 `@anthropic-ai/claude-code` SDK。后者把循环包死，看不到点子上。
- **decision 09-01**：provider 选 Anthropic-compatible `bigmodel-start-plan`（GLM-5 / glm-5-turbo，baseURL `https://zcode.z.ai/api/v1/zcode-plan/anthropic`）。凭据从环境变量读，不读 ~/.zcode 凭据 — 学习项目要和生产配置隔离。
- **decision 09-01**：`bun init` 默认生成 `CLAUDE.md`；重命名为 `AGENTS.md` 与 ZCode 项目级协议对齐。
- **decision 09-01**：Zod 4.5 与 Anthropic SDK 0.122 都用最新；zod 3 写过的代码要避免直接拷过来。
- 待补：跑 demo 时遇到的具体报错 / 决策。

### 下周计划
- 把 Layer 3-7 全跑通
- 跑 1-2 个新 demo 验证 layout 稳定性
- 把 Wk 1 跑出来的真实 commit hash 填回上面表格
