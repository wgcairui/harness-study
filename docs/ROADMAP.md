# 学习路线 — 从"看见问题"到"能设计 harness"

> 本文件是 harness-study 的总课程表。无论你是 repo 作者本人还是第一次打开这里的新人，
> 都按这个顺序走。每个阶段有明确的 **目标 / 前置 / 读什么 / 做什么 / 验收标准**。
> 完成一项就回来勾一项——这就是课程说的"状态持久化"，本文件自己就是这套方法的使用示范。

## 总览：一条路线，两个维度

harness 的定义：**模型权重之外的一切工程基础设施**。它由五个子系统组成：

```
指令（AGENTS.md） · 工具（shell/文件/测试） · 环境（依赖/版本）
· 状态（progress/feature list/git） · 反馈（验证命令/评审）
```

学 harness 有两条互补的路，本 repo 把两条都走通：

| 维度 | 回答的问题 | 对应阶段 | 产出 |
| --- | --- | --- | --- |
| **引擎侧** — 亲手造 loop | agent 循环内部到底怎么转？ | 阶段 1 | 你自己的 mini harness（`src/` 七层） |
| **环境侧** — 给 loop 修路 | 怎么让 agent 在真实仓库里可靠？ | 阶段 2-5 | 五子系统工件（AGENTS.md / init.sh / feature_list / progress） |

只学引擎侧，你会写出能跑的 loop，但不知道为什么真实产品里还有 worktree 隔离、五级压缩、maker-checker；
只学环境侧，你会照抄模板却不知道 `permission_ask` 事件背后发生了什么。
两条都走完，你才能对着任何一个 agent 产品做五子系统审计（阶段 5 的毕业考）。

时间预算：全职约 4-5 周，业余约 2-3 个月。阶段 1-2 是地基，不要跳。

---

## 阶段 0 · 看见问题（0.5-1 天）

**目标**：亲眼见到"模型强 ≠ 执行可靠"，能说出五子系统模型。

**前置**：会用终端和 git；有一个能用 coding agent 的真实项目。

**读什么**（约 2 小时）：
1. 课程 [L01 模型能力强，不等于执行可靠](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-01-why-capable-agents-still-fail/) — Anthropic 那个对照实验：同一模型，无 harness 花 $9/20 分钟产出不可用，有 harness 花 $200/6 小时产出可玩的游戏
2. 课程 [L02 Harness 到底是什么](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-02-what-a-harness-actually-is/) — 五子系统定义 + 20%→100% 的四次迭代案例
3. [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) — "仓库即规范"的原始出处

**做什么**：
- 跑通本 repo demo：`bun install && cp .env.example .env.local && bun run examples/01_repo_qa.ts`
  （看到 LLM 自己选 `glob` → `read_file` → `grep` 合并答案即通过）
- 拿你自己的项目，让 agent 干一件中等任务，**记录它怎么失败的**：范围蔓延？提前说完成？下次会话摸黑？

**验收**：
- [ ] demo 跑通，能指着输出说出哪一段是 event 流、哪一段是 tool dispatch
- [ ] 写下你自己踩到的至少 1 条失败模式（对照课程的 [method-map](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/method-map)，它属于哪一类？）
- [ ] （可选）用 L01 的方法测一次自己的「验证缺口」：5 个任务里，agent 声称完成但实际没完成的比例是多少

---

## 阶段 1 · 造引擎（1-2 周）— 引擎侧

**目标**：从零写出一个 300 行级、能跑通真实 LLM 的 agent loop，理解每一层为什么独立存在。

**前置**：阶段 0。

**读什么**：
- 从零开始的全路径：[`docs/ENGINE-ROADMAP.md`](./ENGINE-ROADMAP)（新人先看这一页——它从"agent loop 是什么"讲起，再逐层给你施工图）
- 工程师节奏表：[`learning-plan.md`](https://github.com/wgcairui/harness-study/blob/main/learning-plan.md)（已有 TS / Bun 经验可只看这个，含跨层思考题）
- 本 repo 源码，按依赖序：`src/events.ts` → `src/llm.ts` → `src/tools/registry.ts` + `src/tools/read_file.ts` → `src/permission.ts` → `src/prompt.ts` → `src/loop.ts` → `src/repl.ts` + `src/index.ts`
- 工业级对照：[OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/) — 工业级 loop 和你的 mini loop 差在哪
- 本 repo [README 的「真实系统对应地图」](https://github.com/wgcairui/harness-study#真实系统对应地图带-fileline) — 每层在 ZCode / Claude Code SDK 里的原型（带 file:line）

**做什么**（新人 = 跟着 ENGINE-ROADMAP 逐层实现；作者 = 补验证）：
- [ ] Layer 1-7 逐层实现，**每层独立 commit**（git 历史就是你的学习记录）
- [ ] 补齐 learning-plan 承诺过的单元测试：llm 流累积、tool happy/fail path、permission 拦截、prompt 四段结构（当前缺口，见 feature_list 的 `test-001`）
- [ ] 跑通 `examples/01_repo_qa.ts` 全链路
- [ ] 完成 ENGINE-ROADMAP 第 6 节的跨层思考题（5 题中选 2-3 题动手）

**验收**：
- [ ] `bunx tsc --noEmit` 通过
- [ ] `bun test` 通过（llm / tools / permission / prompt 各至少 1 happy + 1 fail case）
- [ ] 不看源码能画出 loop 状态机图：messages 累积、tool_use↔tool_result、三个退出条件
- [ ] 能回答"加 X 改哪几层"——边界意识比"知道每层 API"更重要

---

## 阶段 2 · 造环境（1 周）— 环境侧起步

**目标**：把五子系统装进一个真实仓库，让同一个 agent 同一个任务的成功率可感知地上升。

**前置**：阶段 1（知道 loop 里有 events/tools，环境工件才不是咒语）。

**读什么**：
1. 课程 [L03 仓库必须成为唯一事实来源](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/) — agent 看不到的就不存在
2. 课程 [L04 为什么一个巨型指令文件会失败](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-04-why-one-giant-instruction-file-fails/) — 给地图不给说明书
3. 课程 [L05 长任务为什么会断片](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-05-why-long-running-tasks-lose-continuity/) / [L06 初始化为什么是独立阶段](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-06-why-initialization-needs-its-own-phase/)
4. 课程 [L07 agent 为什么贪多烂尾](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-07-why-agents-overreach-and-under-finish/) / [L08 feature list 为什么是 harness 原语](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-08-why-feature-lists-are-harness-primitives/)
5. 课程 [method-map](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/method-map) — 失败模式 → 工件对照表

**做什么**：
- 把 [`templates/`](https://github.com/wgcairui/harness-study/tree/main/templates) 七件套装进**你自己的真实项目**（不是本 repo）：AGENTS.md、init.sh、feature_list.json、progress.md、session-handoff.md、clean-state-checklist.md、evaluator-rubric.md。先装前四个，项目变复杂再补其余
- 参照本 repo 根目录的 `init.sh` + `feature_list.json` + `AGENTS.md` 验证命令段——本 repo 自己就是这套方法的第一个使用者（自审计报告见 [`ENVIRONMENT-HARNESS.md`](./ENVIRONMENT-HARNESS.md)）
- 对照课程 [P01](https://walkinglabs.github.io/learn-harness-engineering/zh/projects/project-01-baseline-vs-minimal-harness/) 做一次 A/B：同一任务，纯 prompt vs 规则驱动，记录结果差异
- 自查两条硬规则：L07 的 WIP=1（同一时间只允许一个 in_progress，贪多的代码行数和完成率负相关）；L08 的三元组（每项功能必须有 行为描述 + 验证命令 + 状态，缺一不完整）

**验收**：
- [ ] 通过 L03 的「全新会话测试」：开一个全新会话只看仓库，能答五问——什么系统 / 怎么组织 / 怎么跑 / 怎么验证 / 做到哪了
- [ ] 新会话重建成本 ≤3 分钟（L05 的标准：好 harness 能把 15 分钟压到 3 分钟）
- [ ] feature_list 里没有"假 passing"——每个 passing 都有可点开的证据
- [ ] 你能说出五个子系统在你的项目里分别由哪个文件承载

---

## 阶段 3 · 验证与可观测（1 周）

**目标**：让"完成"必须携带证据，让 agent 的每次运行可回放、可归因。

**前置**：阶段 2。

**读什么**：
1. 课程 [L09 agent 为什么提前宣告胜利](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-09-why-agents-declare-victory-too-early/) — 自信 ≠ 正确
2. 课程 [L10 端到端测试为什么改变结果](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-10-why-end-to-end-testing-changes-results/)
3. 课程 [L11 可观测性为什么属于 harness](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-11-why-observability-belongs-inside-the-harness/) / [L12 每次会话必须留下干净状态](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-12-why-every-session-must-leave-a-clean-state/)
4. [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — 评的是 model + harness 整体

**做什么**：
- 用 `templates/evaluator-rubric.md` 给你阶段 2 的 agent 输出打分，做一轮校准（对照课程模板里的 3-5 轮校准法；Anthropic 的教训：evaluator 早期会"发现问题然后说服自己不严重"）
- 把 `templates/clean-state-checklist.md` 接进你的 AGENTS.md 收尾流程（L12 的五条件：构建 / 测试 / 进度 / 工件 / 启动路径，缺一不算完）
- 把 L10 的「面向 agent 的错误消息」落地：测试失败输出带三要素——什么错了 / 为什么 / 怎么修
- （可选，深度 2 预演）给本 repo 加一个 `examples/02_transcript.ts`：把 events 流落盘成 `transcript.jsonl`，一行一事件——这正是 ZCode `~/.zcode/cli/agents/<sess>/<agent>/transcript.jsonl` 的原理
- 思考题：本 repo 的 `events.ts` 单向事件流，为什么就是课程说的"可观测性属于 harness"？（答案线索：L11 说可观测性分两层——运行时信号回答"系统做了什么"，过程工件（合同/评分标准）回答"为什么该被接受"；如果 UI 能改 messages，两层都失效，见 DESIGN.md）

**验收**：
- [ ] 完成判定走 L09 的三层终止检查：静态检查 → 运行时行为 → 端到端流程，层层递进不许跳
- [ ] 每次会话结束都过了 clean-state checklist 才 commit
- [ ] evaluator 打分与你的人工判断基本一致（校准记录在案）
- [ ] 能对一次失败给出归因：任务不清 / 上下文缺 / 环境不可复现 / 验证缺 / 状态断

---

## 阶段 4 · 循环工程（1 周）

**目标**：从"手动开一次会话"升级到"设计一个自动循环"——你站到车外设计马路。

**前置**：阶段 3。

**读什么**：
1. 课程 [L13 为什么要停止给你的 agent 写提示词](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-13-loop-engineering/) — 循环工程六原语：automations / worktrees / skills / connectors / sub-agents / external state
2. [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — planner / generator / evaluator 三角色 + context reset
3. [Addy Osmani: Loop Engineering](https://addyosmani.com/blog/loop-engineering/) — L13 的框架源头

**做什么**（对应课程 [P07](https://walkinglabs.github.io/learn-harness-engineering/zh/projects/project-07-loop-engineering-first-loop/)，三个递进实验）：
- goal loop：把任务写成 L13 的三要素——目标 / 验证方式 / 停止条件（用课程 `goal-template.md` + `loop-state-template.md`），先手动跑一遍留基线，再用 `/goal` 跑
- timer loop：把一个巡检任务变成 `/loop` 定时跑，记录发现数 / 误报率 / 你跟进花的时间，算算值不值
- maker-checker loop：maker 干活，checker 按你的 rubric 评审，不过就打回（generator/evaluator 分离——L13 的话："你的人里必须有一个不信你的"）
- 量化：自动循环 vs 手动会话的人工干预次数对比，有数字；对照 L13 的成熟度阶梯（L1 goal runner → L5 fleet orchestration）给自己定位

**验收**：
- [ ] 一个 maker-checker loop 在你的真实项目上跑完一个完整 feature
- [ ] 人工干预次数对比有数字；你能说出四种"沉默成本"里哪一种在你身上最明显

---

## 阶段 5 · 图工程与前沿对齐（1 周+，毕业阶段）

**目标**：知道 loop 什么时候该长成 graph；能对任意 agent 产品做五子系统审计。

**前置**：阶段 4。

**读什么**：
1. 课程 [L14 从单循环到图工程](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-14-graph-engineering/) — 四层堆叠（prompt→context→loop→graph）、图四零件（节点/边/共享状态/路由）、单循环三种结构性失败（Goodhart / 向上失明 / 冲突）、图 ≠ workflow（差别在节点里装的是函数还是 agent）、编排税（你的审阅带宽是串行资源）
2. 本 repo [`FRONTIER-HARNESS.md`](./FRONTIER-HARNESS.md) — Claude Code / Codex / Pi / DeepSeek 四篇拆解读本，读原文 + 做映射练习
3. [`REFERENCES.md`](./REFERENCES.md) 里的 2026 扩展阅读，按需取用

**做什么**：
- 对应课程 [P08](https://walkinglabs.github.io/learn-harness-engineering/zh/projects/project-08-graph-engineering-first-graph/)：把你阶段 4 的 maker-checker loop 画成显式 graph，加一个并行 fan-out/fan-in 节点，再加一条条件回退边 + 人工审批节点
- 动手前先过 L14 的五个判据（可独立拆分 / 有分支或回退 / 中间状态值得存 / 结果可验收 / 协作收益 > 协调成本），至少满足三条再画图
- **毕业考**：挑一个你没拆过的 agent 产品（Cursor / Devin / OpenHands…），产出一份五子系统审计：每个子系统它怎么落地、对应本 repo 哪一层、哪些机制值得抄、哪些是当前模型能力下多余的
- 做一次"逐个移除"实验：对你的 harness 逐个拆掉一个组件跑基准，量化边际贡献（Anthropic 的方法，注意先有失败归因再谈瓶颈；L12 补充：模型变强后 h​​arness 组件会编码过时假设，移除实验要按月做）

**验收（毕业标准）**：
- [ ] 审计报告能让没接触过该产品的人 10 分钟看懂它的 harness
- [ ] 你能回答：你的任务里，哪个 harness 组件边际贡献最大，证据是什么
- [ ] 你知道下一步要学什么（见下）

---

## 毕业后的深度 2 方向

本 repo 的 AGENTS.md 划定的 out-of-scope，毕业后再回来做，每个都有真实系统对标：

| 深度 2 主题 | 对标真实系统 | 入口 |
| --- | --- | --- |
| MCP（stdio/SSE/HTTP） | Claude Code 的 MCP 接入 | Claude Code 拆解的工具子系统 |
| Context compaction | Claude Code 五级压缩 | Claude Code 拆解 + LangChain context management |
| Session 持久化 + resume | ZCode transcript.jsonl / Cognition snapshot | 阶段 3 的 transcript 落盘扩展 |
| 多 agent 编排 | Anthropic 并行 Claude 团队 / OpenAI Symphony | 阶段 5 的 graph 自然延伸 |

---

## 进度跟踪

完成一个阶段就把本节勾上（会话结束前更新——这正是 L12 教的）：

- [ ] 阶段 0 · 看见问题
- [ ] 阶段 1 · 造引擎（repo 作者已完成，commit c6a90a6…7833ff7；单元测试补齐见 feature_list `test-001`）
- [ ] 阶段 2 · 造环境（本 repo 已自装工件作为示范；你自己的项目需另做）
- [ ] 阶段 3 · 验证与可观测
- [ ] 阶段 4 · 循环工程
- [ ] 阶段 5 · 图工程与前沿对齐
