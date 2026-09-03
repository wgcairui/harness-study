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

1. **[OpenAI: Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)**（2026-08）
   "仓库即规范"（repo as source of truth）、repo-local context、结构性 guardrail。
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
| [OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)（2026-08） | 工业级 loop 的核心循环、工具调用、上下文增长、终止状态——和你 `src/loop.ts` 的差距清单 |
| [shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) | 同类中文学习项目：从单循环到隔离自治执行，和本 repo 互补视角 |
| 本 repo README「真实系统对应地图」 | 每一层在 ZCode transcript.jsonl / Claude Code SDK 里的原型（带 file:line） |

## 验证与评估（阶段 3）

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（2026-01） | 评的是 model + harness 整体；区分 evaluation harness 与 agent harness |
| 课程 [L09-L12](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-09-why-agents-declare-victory-too-early/) | 提前宣告胜利 / e2e / 可观测 / 干净收尾——验证子系统的四块拼图 |

## 循环工程（阶段 4）

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Addy Osmani: Loop Engineering](https://addyosmani.com/blog/loop-engineering/)（2026-06） | 六原语完整框架（automations / worktrees / skills / connectors / sub-agents / external state）+ 四种沉默成本 |
| [LangChain: Improving Deep Agents with harness engineering](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering)（2026-02） | 模型不变，只改 system prompt/tools/middleware/tracing/self-verification，Terminal Bench 2.0 Top 30 → Top 5 |
| [Thoughtworks / Martin Fowler: Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)（2026-04） | user harness = feedforward guides + feedback sensors；deterministic vs inferential controls |

## 2026 扩展（阶段 5，按需选读）

完整清单见[课程参考页](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/)。如果只挑五篇：

| 文章 | 读它解决什么问题 |
| --- | --- |
| [Cursor: Continually improving our agent harness](https://cursor.com/blog/continually-improving-agent-harness)（2026-04） | 把 harness 当持续迭代的产品系统：离线评估 + 线上指标 + 工具错误分类 |
| [Anthropic: Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)（2026-02） | 并行 agent 团队的任务锁、git 同步、容器隔离——图工程的真实案例 |
| [LangChain: Context Management for Deep Agents](https://www.langchain.com/blog/context-management-for-deepagents)（2026-01） | filesystem offloading / tool-call truncation / summarization——深度 2 的 context compaction 入门 |
| [OpenAI: Unlocking the Codex harness: the App Server](https://openai.com/index/unlocking-the-codex-harness/)（2026-08） | harness 抽象成协议：thread lifecycle / resume / fork / diff |
| [Stripe: Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents)（2026-02） | devbox 隔离、blueprints 状态机、pre-push/CI 反馈循环的一手实践 |

## 使用原则

- **按阶段读，不囤积**。每篇文章在你动手做完对应阶段的作业后再读，吸收率完全不同。
- 主轴三篇值得各读两遍：第一遍建立框架（阶段 0/2），第二遍带着自己项目的失败案例对照读（阶段 3/5）。
- 读任何一篇时问自己：这篇文章讲的机制，对应本 repo `src/` 的哪一层？回答不出来就回去看 README 的真实系统地图。

> **简介来源与核对状态**（2026-09-03）：全部链接做过可达性验证；主轴三篇、OpenAI 两篇 loop/harness
> 文章经原文核对（含 $9/$200 实验的出处确认），walkinglabs 各页面关键论断对照仓库源文核对。
> 其余条目的一句话简介转述自课程参考页的注释，供选读判断用——读完发现出入欢迎直接改本文件。
