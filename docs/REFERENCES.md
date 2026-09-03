# 精选阅读清单

> 筛选标准和 walkinglabs 课程一致：只收**能直接解释 harness 机制**的文章——即正文直接涉及
> agent loop、工具执行、沙箱、状态、上下文、验证、终止条件、控制平面、观测反馈的材料。
> 泛泛的 prompt engineering 和 agent 产品发布稿不收。
>
> 每条都标了「什么时候读」——对应 [`ROADMAP.md`](./ROADMAP.md) 的阶段。不要从头到尾刷清单，
> 到哪个阶段读哪篇。

## 课程内部参考（先于外部文章）

walkinglabs 课程自带的四份方法参考，短小、可操作，是所有外部文章的"落地索引"：

| 文档 | 一句话 | 什么时候读 |
| --- | --- | --- |
| [method-map](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/method-map) | 六种长任务失败模式 → 最先该补的工件对照表 | 阶段 0 |
| [initializer-agent-playbook](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/initializer-agent-playbook) | 初始化 agent 第一轮应该产出什么 | 阶段 2 |
| [coding-agent-startup-flow](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/coding-agent-startup-flow) | 编码 agent 每次开工的固定流程 | 阶段 2 |
| [prompt-calibration](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/prompt-calibration) | 根指令写到什么程度才合适 | 阶段 2 |

## 主轴三篇（必读，课程的立论基础）

1. **[OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)**（2026-02-11）
   AGENTS.md 只当 ~100 行目录页，知识本体放在结构化 `docs/`——那才是 system of record；
   执行不变量、不微管实现；每个变更跑在独立 git worktree 里；agent 的挣扎信号要反哺成仓库 guardrail。
   → 阶段 0 读；阶段 2 造环境时回读。

2. **[Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)**（2025-11）
   initializer agent / coding agent 双角色、feature list、progress log、跨上下文窗口交接。
   → 阶段 0 读；阶段 3 验证时回读。

3. **[Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)**（2026-03）
   planner / generator / evaluator 三角色、context reset、harness 简化与组件过期（"模型变强后，harness 里的组件会编码过时假设"）。
   $9-20min-不可用 vs $200-6h-可玩 的对照实验出处（课程 L01 也讲了这个实验）。
   → 阶段 4 读；阶段 5 做移除实验时回读。

## 引擎侧专项（阶段 1）

| 文章 | 读它解决什么问题 |
| --- | --- |
| [OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)（2026-01-23） | 工业级 loop 的核心循环（prompt→推理→tool_call→执行→回灌→再查）、上下文随对话增长、assistant message 即终止信号——和你 `src/loop.ts` 的差距清单 |
| [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) | 同类中文学习项目（MIT）：17 课从核心 agent loop 递进到 subagents / agent teams，"agent = Model + Harness" 的分解视角，与本 repo 同向互补 |
| 本 repo README「真实系统对应地图」 | 每一层在 ZCode transcript.jsonl / Claude Code SDK 里的原型（带 file:line） |

## 验证与评估（阶段 3）

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（2026-01） | 评的是 model + harness 整体；区分 agent harness 与 evaluation harness；三类评分器（code/model/human）取舍；capability eval 找短板 vs regression eval 防退化；Pass@k vs Pass^k |
| 课程 [L09-L12](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-09-why-agents-declare-victory-too-early/) | 提前宣告胜利 / e2e / 可观测 / 干净收尾——验证子系统的四块拼图 |

## 循环工程（阶段 4）

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Addy Osmani: Loop Engineering](https://addyosmani.com/blog/loop-engineering/)（2026-06-07） | Loop Engineering 命名文：六原语（automations / worktrees / skills / connectors / sub-agents / memory）——"用系统取代你自己去 prompt agent"（注意：课程 L13 讲的"四种沉默成本"是讲义的归纳，不在这篇文章里） |
| [LangChain: Improving Deep Agents with harness engineering](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering)（2026-02-17） | 模型不变，靠 harness 工程迭代提升 agent：trace 分析 skill 自动归因错误、build + self-verify、loop 检测 middleware、reasoning 预算优化 |
| [Thoughtworks / Martin Fowler: Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)（2026-04-02） | user harness = feedforward guides + feedback sensors；deterministic vs inferential controls |

## 2026 扩展（阶段 5，按需选读）

完整清单见[课程参考页](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/)。如果只挑五篇：

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Cursor: Continually improving our agent harness](https://cursor.com/blog/continually-improving-agent-harness)（2026-04-30） | 把 harness 当持续迭代的产品系统：CursorBench 离线评估 + 线上 A/B、工具错误分类与 unknown-error 率告警、按 provider/模型版本定制 |
| [Anthropic: Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)（2026-02-05） | 并行 agent 团队的一手案例：current_tasks/ 文件做任务锁、git 同步强制消解冲突、每 agent 一个 Docker 容器——~2000 sessions / $20k 产出 10 万行可编译 C 编译器 |
| [LangChain: Context Management for Deep Agents](https://www.langchain.com/blog/context-management-for-deepagents)（2026-01-28） | 大 tool result 与旧 write 参数落盘 filesystem（超阈值触发）+ 消息历史 summarization——深度 agent 的 context 管理 |
| [OpenAI: Unlocking the Codex harness: the App Server](https://openai.com/index/unlocking-the-codex-harness/)（2026-02-04） | App Server 把 harness 暴露成双向 JSON-RPC API：thread 生命周期（create / resume / fork / archive）+ 流式进度与 diff 输出 |
| [Stripe: Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents)（2026-02-09） | devbox 隔离、MCP 工具生态（400+ 内部工具）、shift-left 反馈（秒级 lint + selective CI）、Slack→CI-passing PR 的一手实践 |

## 使用原则

- **按阶段读，不囤积**。每篇文章在你动手做完对应阶段的作业后再读，吸收率完全不同。
- 主轴三篇值得各读两遍：第一遍建立框架（阶段 0/2），第二遍带着自己项目的失败案例对照读（阶段 3/5）。
- 读任何一篇时问自己：这篇文章讲的机制，对应本 repo `src/` 的哪一层？回答不出来就回去看 README 的真实系统地图。

> **简介来源与核对状态**（2026-09-03，第二轮）：本清单全部条目已逐篇对照原文核对（walkinglabs 页面
> 对照仓库源文，外部文章经全文抓取核对）。修正过的转述失真包括：Addy 文章里没有"四种沉默成本"
>（那是课程 L13 的归纳）、LangChain Deep Agents 一文里没有 Terminal Bench 名次、Stripe Minions
> 一文里没有 blueprints（在 Part 2）、LangChain context 一文是 offload 而非 truncation。
> OpenAI 三篇文章日期以页面正文显示日期为准（2026-02-11 / 2026-01-23 / 2026-02-04）。
> 后续发现出入欢迎直接改本文件。
