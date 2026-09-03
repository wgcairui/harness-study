# 进度日志

> 结构采用课程模板（templates/progress.md）。开工先读本文件，收尾前更新——这是 L05/L12 教的状态子系统。

## 当前已验证状态

- 仓库根目录：`~/Code/harness-study`
- 标准启动路径：`./init.sh`（装依赖 → `bunx tsc --noEmit` → `bun test` → 打印 demo 命令）
- 标准验证路径：`./init.sh` 或 `bunx tsc --noEmit && bun test`
- 当前最高优先级未完成功能：`test-001` 补齐单元测试（见 feature_list.json）
- 当前 blocker：`smoke-001` demo 真机 smoke——plan key 绑 ZCode 网关直调 401，需直连 Anthropic key

## 会话记录

### 会话 001（2026-09-01，Wk 1）

- 本轮目标：起项目骨架 + 起草文档 + 完成七层引擎 + 跑通 demo
- 已完成：全部完成——骨架、6 份文档、Layer 1-7、demo 代码 `examples/01_repo_qa.ts`
- 运行过的验证：`bunx tsc --noEmit` 通过；**`bun test` 未跑（无测试文件——learning-plan 承诺的单测没写，登记为 `test-001`）**；demo 真机未跑通
- 已记录证据：见下表各层 commit + feature_list.json evidence 字段
- 已知风险或未解决问题：401（见 blocker）；单测缺口（见 test-001）

**逐层记录**（计划 vs 实际）：

| layer | 计划 | 实际 | commit | 偏差原因 |
| --- | --- | --- | --- | --- |
| 0 | docs 骨架 | 完成 | (docs commit) | — |
| 1 | events.ts | 完成 | c6a90a6 | — |
| 2 | llm.ts | 完成 | dd1e891 | — |
| 3 | tools/* | 完成 | 02e1102 | type-check 撞到 Bun GlobScanOptions 没有 follow 字段；删掉 |
| 4 | permission | 完成 | 457d8be | — |
| 5 | prompt | 完成 | 2ff710d | strict regexp 在 TS 上出现 `string \| undefined`，加 None 拦截 |
| 6 | loop | 完成 | 17d40fe | — |
| 7 | repl + index | 完成 | adb88b9 | — |
| 8 | demo + smoke | 代码完成，smoke blocked | — | 401（见 blocker），代码路径 type-check 通过 |

**本轮决策记录**：

- 用 Bun + 直接打 `@anthropic-ai/sdk`，不依赖 `@anthropic-ai/claude-code` SDK。后者把循环包死，看不到点子上。
- provider 选 Anthropic-compatible `bigmodel-start-plan`（GLM-5 / glm-5-turbo，baseURL `https://zcode.z.ai/api/v1/zcode-plan/anthropic`）。凭据从环境变量读，不读 ~/.zcode 凭据 — 学习项目要和生产配置隔离。
- `bun init` 默认生成 `CLAUDE.md`；重命名为 `AGENTS.md` 与 ZCode 项目级协议对齐。
- Zod 4.5 与 Anthropic SDK 0.122 都用最新；zod 3 写过的代码要避免直接拷过来。

### 会话 002（2026-09-03）

- 本轮目标：文档重构——按 Learn Harness Engineering 课程方法论，把项目改造成"个人学习 + 新人渐进教程"双身份
- 已完成：
  - 新增 `docs/` 四篇：ROADMAP（阶段 0-5 总课程表）、REFERENCES（按阶段阅读清单）、FRONTIER-HARNESS（四产品拆解 → 七层映射）、ENVIRONMENT-HARNESS（五子系统实操）
  - 新增 `templates/` 七件（改编自课程模板，MIT 署名）
  - 自装环境侧工件：根目录 `init.sh` + `feature_list.json`（诚实状态：`test-001` not_started / `smoke-001` blocked）
  - 重写 README（双身份 + 路线总览）；AGENTS.md 加开工流程 + 验证命令段；learning-plan 加定位头
- 运行过的验证：`bunx tsc --noEmit` 通过；`bash init.sh` 基线验证通过
- 已记录证据：本 commit；feature_list.json `docs-001`
- 已知风险或未解决问题：五子系统审计发现的问题（无验证命令段 / 无 init.sh / progress.md 假待办行 / 单测缺口）已在本轮修复或登记，详见 docs/ENVIRONMENT-HARNESS.md
- 下一步最佳动作：`test-001` 补齐七层单元测试（llm 流累积 / tools happy+fail / permission 拦截 / prompt 四段）

### 状态卫生注记

会话 001 的旧版 progress.md 表格里残留 6 行假"待办"（layers 2-7 实际已完成却仍标待办）——
这正是课程 L05 说的状态腐化：下次会话读到假信号就会重做已完成的工作。会话 002 重写时删除。
教训：**收尾时不更新状态 = 给下个会话埋雷**（clean-state-checklist 的第 4 条就是防这个）。
