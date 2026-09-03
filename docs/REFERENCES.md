# 知识库 — Harness / Loop / Graph 前沿实践

> 这一页是**站内的知识**，不是清单。所有条目都先讲清楚"它教什么、为什么这样设计、什么时候用"，
> 文末才放原文链接——点出去看，是"想读到原文级别的细节"，不是"被迫跳转"。
>
> 每条都对应 [`ROADMAP`](./ROADMAP) 里的一个阶段，按阶段顺序读就行。

---

## 0. Harness 的核心机制（看所有文章之前的前置）

如果你只读一段，先读这段：

**harness = 模型权重之外的一切工程基础设施**。它的全部意义是：让一个本身足够聪明的模型，在真实仓库里可靠地完成任务，而不是做出看着像但实际跑不通的东西。

它由五个子系统组成——这一页里你读到的所有机制都能塞进这五格：

| 子系统 | 回答的问题 | 典型承载 |
| --- | --- | --- |
| **指令** | agent 该做什么、按什么顺序 | `AGENTS.md` / `CLAUDE.md` |
| **工具** | agent 能动什么、边界在哪 | tool schema + permission gate |
| **环境** | 依赖、版本、启动方式是否自描述 | `init.sh` / `package.json` / lockfile |
| **状态** | 上次干到哪了、下次从哪续 | `progress.md` / `feature_list.json` / git |
| **反馈** | 怎么证明做对了 | 验证命令 + tsc/test + 评审校准 |

一个常见误解：把 harness 等同于"写更好的 prompt"。**不是。** prompt 是给模型的指令文本；harness 是围绕模型的整套工作系统——指令只是其中一格。OpenAI 在他们的实践里把 harness 当成"仓库即规范"（repo as source of truth）：所有必要的上下文都必须存在于仓库里、agent 看得到的地方。

下一个常见误解：以为模型越强 harness 越不重要。Anthropic 的对照实验直接打脸：同一模型（Opus 4.5）、同一任务（做一个 2D 复古游戏编辑器）——无 harness 时 20 分钟花 $9 产出跑不起来；有 harness 时 6 小时花 $200 产出可玩。换的是马具，不是马。

带着这两条继续往下读，你会看到每篇文章都在不同侧面回答同一组问题。

---

## 1. 引擎侧：先懂 loop 怎么转（阶段 1 用）

### 1.1 agent loop 的最小骨架

一个 coding agent 的核心循环其实只有三步：

1. 把当前状态（system prompt + 历史消息）喂给模型
2. 模型要么返回 text（结束本轮），要么返回 tool_use 块
3. 执行 tool，把结果作为 tool_result 塞回 messages，再回到第 1 步

Claude Code、Codex、Aider、Cursor 的 agent 内部都是这个循环——区别只在每一步的实现复杂度和外围加了哪些 hook。这件事容易被人忽略，所以 OpenAI 的 *Unrolling the Codex agent loop*（[原文](https://openai.com/index/unrolling-the-codex-agent-loop/)）值得专门读一遍：它把这条循环展开到最低层级，说明 prompt怎么编码、tool_call 怎么累积、上下文怎么随对话增长、assistant message 怎么当终止信号。

你写的 mini harness（[`src/loop.ts`](https://github.com/wgcairui/harness-study/blob/main/src/loop.ts)）就是这条循环的最简实现：调 LLM → permission 拦 → dispatch tool → tool_result 回灌 messages → end_turn / max_turns / error 三退出。读 *Unrolling* 之后再看自己的代码，会看到 Codex 在哪里做了"消息累积策略"、"tool_use 块序列化"、"final assistant message 提取"——这些点都是可以下钻学的地方。

### 1.2 Model + Harness 是两件独立的事

[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 是一个同类的中文学习项目，它的核心观点是：

> agency 来自训练好的模型，不是来自编排代码。**一个 agent 产品 = Model + Harness。**

听起来废话，但拆出来用有真效果：你写 agent 时遇到的瓶颈，可以二分到"模型本身不够"或"harness 没装好"。本 repo 的学习路线也是基于这个分解——阶段 1 造 Model + Harness 里 Harness 的引擎部分（loop / events / permission），阶段 2-5 装 Harness 里的环境部分（AGENTS.md / init.sh / feature_list / progress）。

### 1.3 你的 mini harness 在真实系统里的原型

本 repo 顶层 [README 的「真实系统对应地图」](https://github.com/wgcairui/harness-study#真实系统对应地图带-fileline) 列出每一层（events / llm / tools / permission / prompt / loop / repl）在 ZCode `transcript.jsonl` 和 Claude Code SDK 里的对应源码——每条都带 file:line。学完阶段 1 后看这张表，能把你的代码映射到工业级实现，理解"哪些是骨架必须、哪些是装饰可选"。

---

## 2. 环境侧：给 loop 修路（阶段 2 用）

### 2.1 OpenAI 的"仓库即规范"是怎么落地的

[OpenAI: Harness engineering](https://openai.com/index/harness-engineering/)（2026-02-11）是这套方法的"宣言"。整篇文章用一个真实实验开场：三个工程师花了 5 个月用 Codex 写一个产品，从空仓库到 100 万行代码，平均每人每天 3.5 个 PR。结论：模型没换、换的是 harness。

这篇文章里值得抄到你自己项目的有四条硬设计：

1. **AGENTS.md 只当 ~100 行的目录页**，真正的知识放在结构化 `docs/` 目录——那才是 system of record。AGENTS.md 装不下就拆，拆出去指向，但不能让 AGENTS.md 自己膨胀。
2. **执行不变量、不微管实现**。AGENTS.md 只写"API 必须走 OAuth 2.0"，不写"用某某库的某某方法实现 OAuth 2.0"。后者是约束模型自由度的死手。
3. **每个变更跑在独立 git worktree 里**。worktree 隔离是 task 边界的物理实现，不是写在 prompt 里的希望。
4. **agent 挣扎的反哺信号 → 仓库 guardrail**。当 agent 重复犯同一类错误，把那条规则编码进 AGENTS.md 或自定义 lint。harness 每个月都会比上个月强。

### 2.2 Anthropic 的"上下文连续 + 五层压缩"

[Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)（2025-11）是另一个互补的视角——它强调的不是"仓库即规范"，而是"跨上下文窗口的会话交接"。

长任务一定会跨会话，跨会话一定会丢信息（中间推理步骤里那些"为什么选方案 A 不选 B"的解释）。Anthropic 的解法是 initializer agent + coding agent 双角色：initializer 第一轮把仓库现状摸清，建立 feature list 和 progress log；coding agent 每轮开工读这两个文件就知道自己处于任务树的位置。**状态持久化是 harness 的硬基础设施**，不是 nice-to-have。

更关键的是它对"为什么上下文焦虑会发生"的诊断：当 agent 感觉上下文快满，会匆忙结束当前工作跳过验证步骤（Anthropic 称之为"context anxiety"）。所以压缩策略不能"满了就摘要"——而要分级：无损剪枝 → 结构化提炼 → 有损 LLM 摘要，配合熔断机制。Claude Code 的五级压缩管线（先剪枝后摘要）就是这套思路的产品化。

### 2.3 失败模式 ↔ 工件对照（最快上手的一页）

课程的 [method-map](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/method-map) 是一张"症状→疗法"对照表，最实用的部分：

| 失败模式 | 实际表现 | 最先该补的工件 |
| --- | --- | --- |
| 新会话摸黑 | 每次重新摸索项目状态和启动方式 | `claude-progress.md` |
| 范围蔓延 | 一次启动多个功能，最后一个都没收尾 | `feature_list.json`（一次只许一个 in_progress） |
| 提前宣布完成 | 代码改了就说"完成"，但没证据 | `clean-state-checklist.md` + 验证命令写进 `AGENTS.md` |
| 启动脆弱 | 每轮会话都要重新学怎么启动 | `init.sh` |
| 交接薄弱 | 下一轮看不出哪里可用、哪里坏了 | `session-handoff.md` |
| 评审主观 | 质量判断靠个人记忆和感觉 | `evaluator-rubric.md` |

优先补**当前正在发生**的那种失败的对应工件，不要一次全堆上。

### 2.4 init.sh 和开工流程

[`initializer-agent-playbook`](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/initializer-agent-playbook) 给了仓库初始化阶段该产出的工件清单：根指令文件、机器可读功能面、持久进度工件、标准启动脚本、初始安全 commit。其中 init.sh 是把"启动路径"固化成 shell 脚本——你跑 `bun run docs:build` 都行，但一定要有一条命令把"装依赖 + 跑基线验证 + 打印启动命令"做完。

[`coding-agent-startup-flow`](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/coding-agent-startup-flow) 是编码 agent 每轮开工的固定流程：`pwd` 确认根目录 → 读 progress → 读 feature_list → 看 git log → 跑 init.sh → 跑基线 smoke → 选最高优先级未完成功能 → 只围绕这一项工作。这个序列不能乱——`pwd` 防在错目录干活，progress + feature 文件先恢复持久状态，init.sh 让启动标准化不靠记忆，基线验证先跑防止在坏状态上叠改动。

### 2.5 根指令写到多细合适

[`prompt-calibration`](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/prompt-calibration) 给了"该不该放进 AGENTS.md"的判定：

**该放**：仓库用途与范围、启动路径、验证路径、不可违反的约束、必需的状态工件、会话结束规则。

**不该放**：过长的历史边角案例、只属于某个子系统的局部架构笔记、过去每次失败都往里塞一条的累加——这些是入口文件膨胀的根源，应该拆到 `docs/` 子文档里再回头链。

---

## 3. 验证与可观测（阶段 3 用）

### 3.1 agent 系统性地过度自信

[Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（2026-01）里最值得记的两条：

**第一**：评 agent 时评的是 **model + harness 整体**，不是模型本身。同一模型在不同 harness 下分数天差地别。这也是为什么课程坚持"harness 是工程的真正对象"。

**第二**：完成判定必须外部化，不能让 agent 自评。课程 L09 的实证：agent 评估自己时系统性偏正面（即使外部人觉得明显不达标），原因是"它就是这段代码的作者——它在生成的时候已经说服自己这条路是对的"。Anthropic 给出的解法是 generator/evaluator 分离——评估者用独立 session、专门调校成"挑刺模式"。这也是后面 loop 工程和图工程的根基。

另外文章里给出三类评分器取舍（code-based 客观/快但 brittle；model-based 灵活/贵/非确定；human gold-standard/最贵/最慢）和两个指标区分（capability eval 找短板，pass rate 应从低开始；regression eval 防退化，pass rate 应接近 100%）。Pass@k vs Pass^k 的区别（"至少一次对" vs "每次都对"）是评估非确定性 agent 的关键工具。

### 3.2 验证子系统的四块拼图

课程的 [L09](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-09-why-agents-declare-victory-too-early/)（防止提前宣告完成）/ [L10](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-10-why-end-to-end-testing-changes-results/)（端到端测试才是真验证）/ [L11](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-11-why-observability-belongs-inside-the-harness/)（可观测性属于 harness）/ [L12](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-12-why-every-session-must-leave-a-clean-state/)（会话结束前必须干净）是验证子系统的四块拼图。读这四讲比读任何单篇外部文章都值——每讲都附一硬数据案例（L10 的 5 个组件边界缺陷都是端到端测试捕获的、L12 的 12 周数据差 29-34 个百分点）。

### 3.3 异常退化的信号

[Anthropic: Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)（2026-02-05）里给出了一个非常具体的反例：**任务验证器必须接近完美，否则 Claude 会解决错误的问题**。他们让多个 Claude agent 并行写一个 C 编译器，最后一千多个 session 跑通了——但他们强调那是因为验证脚本判断编译器能否通过几乎是布尔判定，没什么灰色地带。如果你的验证脚本本身就是软的（比如"看起来不错"），那并行再多 agent 也只是产出更多"看起来不错"的结果。

---

## 4. Loop 工程：从手动开车到设计马路（阶段 4 用）

### 4.1 从 `/goal` 出发

[Addy Osmani: Loop Engineering](https://addyosmani.com/blog/loop-engineering/)（2026-06-07）是这个概念的命名文。Osmani 把"loop"拆成五个组件（外加一个记忆层）：

| 原语 | 回答的问题 |
| --- | --- |
| Automations | 谁触发 loop？（手动 / `/goal` / `/loop` / cron / webhook） |
| Worktrees | 多个 agent 怎么避免文件碰撞？ |
| Skills | 项目知识怎么不每次重新解释？ |
| Connectors | agent 怎么够到外部系统？（MCP / API） |
| Sub-agents | 谁干活、谁检查？ |
| External State | loop 状态存在哪里？（mark down 文件 / issue tracker） |

不需要全用上，但**需要知道什么时候该装哪一个**。文章还强调：让 agent 能改自己的 harness（如果扩展面够开放，"优化 agent 行为"这件事本身就能半自动完成）。注意课程 L13 讲的"四种沉默成本"（验证负债/理解腐烂/认知投降/令牌爆炸）是讲义自己的归纳，不在 Osmani 这篇文章里——但确实是 loop 跑久了会撞上的真问题。

### 4.2 harness 工程化是反复迭代

[LangChain: Improving Deep Agents with harness engineering](https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering)（2026-02-17）的硬贡献是把它做成可复制的工程过程。它用了一个 trace 分析 skill（并行 error-analysis agent 自动诊断 harness 的失败模式）+ build + self-verify 强制 + loop 检测 middleware（追踪 per-file edit count 检测 doom loops）+ reasoning 预算优化（reasoning sandwich 模式）。这一套不在 harness 第一次装就全用上，而是**每个失败模式对应一个 trace、一个 middleware、一个 review checklist**——迭代式强化。

注意：文章里常被引用的"Terminal Bench 2.0 Top 30→Top 5"的具体名次是 benchmark 报告里的数字，不是这一篇文章里给出的——别当成这篇文章的论据，引用时以原 benchmark 为准。

### 4.3 user harness = 引导 + 传感

[Thoughtworks / Martin Fowler: Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)（2026-04-02）从用户视角看 harness：harness = feedforward guides（事前提示，AGENTS.md / skills）+ feedback sensors（事后感知，evals / trace）。控制类型二分：deterministic（CI 检查、permission gate）和 inferential（LLM 评分）。理解这两组二分，能解释为什么有些规则必须落到代码里（确定性）而有些只能落到 prompt 里（推理性）。

---

## 5. 图工程与持续迭代（阶段 5 用）

### 5.1 把循环固定到现实

[eigent.ai: Graph Engineering for AI Agents](https://www.eigent.ai/blog/graph-engineering-ai-agents)（2026-07）讲的是 loop 长大了之后会撞到的三种**结构性**失败——不是某次跑的 bug，是 loop 架构本身的盲区：

- **Goodhart**：把单一指标推到极致，它会停止测量你以为它在测量的东西。客服 loop 优化"工单解决率"，三个月后续费率翻倍——bot 学会了关闭工单。
- **向上失明**：loop 内部没人问"这个指标对吗"。恒温器不会问 68°F 是不是对的温度。
- **冲突**：独立 loop 互相拆台。响应速度 loop 拆深度质量 loop 的台。

eigent 强调"anchors"——把 loop 钉在真实业务结果、ground truth、人工抽查上。图工程最容易跳过的部分，但也是最不能省的。

### 5.2 形状不是承重墙

[iii.dev: Loops, Graphs, and the Layer That Matters](https://iii.dev/blog/loops-graphs-and-the-layer-that-matters/)（2026-07）是最清醒的反方观点：loop 就是只有一个节点的图，状态机跑了几十年。别被"图工程是新发明"的话术骗了。**形状是容易的部分，承重的是可重放、可观测、可恢复**——出问题能回放、运行中能观察、挂了能接着跑。这些能力图引擎不会替你造。

### 5.3 harness 是持续迭代的产品

[Cursor: Continually improving our agent harness](https://cursor.com/blog/continually-improving-agent-harness)（2026-04-30）的视角更工业：把 harness 当持续迭代的产品系统。具体做法：离线用 CursorBench + 公开 benchmark 评估，线上 A/B 测试真实流量，工具错误必须分类（InvalidArguments / UnexpectedEnvironment / ProviderError 等），错误率异常时自动告警，模型定制深入到 provider 甚至版本级别（不同模型用不同 patch 格式）。它还预言"未来是 multi-agent"——单 agent 的并行调试效率上不去。Cursor 的实践能让你看到 harness 工程在生产环境的真实长什么样。

### 5.4 你的图值得画吗

课程的 [L14](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-14-graph-engineering/) 给出了"该不该画图"的五个判据（可独立拆分 / 有分支或回退 / 中间状态值得存 / 结果可验收 / 协作收益 > 协调成本）。同时警惕**编排税**——启动 agent 便宜、关 loop 贵（要审结果、要对齐冲突）。你加速的不是 prompt，是 agent 数量；但你的判断力是串行资源，不并行。

---

## 6. 上下文管理（深度 2 的预习）

阶段 5 之后想继续深挖上下文压缩：

[LangChain: Context Management for Deep Agents](https://www.langchain.com/blog/context-management-for-deepagents)（2026-01-28）把上下文管理切成三个动作：大 tool result 落盘 filesystem（>20k token 时触发）/ 旧 write 参数落盘（context 超 85% window 时）/ 消息历史 summarization。注意原文用的是 offload（替换为指针），不是截断（truncation 来自其他文章的概念）。

---

## 附录 A — 文章分类速查表

| 维度 | 文章 | 关键论点 |
| --- | --- | --- |
| 引擎 | Unrolling the Codex agent loop | 工业级 loop 的最小展开 |
| 引擎 | shareAI-lab/learn-claude-code | agent = Model + Harness 的分解 |
| 环境 | OpenAI: Harness engineering | 仓库即规范、~100 行 AGENTS.md、不变量、worktree |
| 环境 | Anthropic: Effective harnesses | initializer/coding 双角色、context anxiety |
| 环境 | method-map | 失败模式 ↔ 工件对照 |
| 环境 | initializer-agent-playbook | 初始化阶段产出清单 |
| 环境 | coding-agent-startup-flow | 编码 agent 每轮开工固定流程 |
| 环境 | prompt-calibration | 根指令写到多细 |
| 验证 | Demystifying evals | 评 model+harness；分离评分器 |
| 验证 | L09-L12 | 完成判定 / e2e / 可观测 / 干净收尾 |
| 验证 | C compiler with parallel Claudes | 验证器必须接近完美 |
| Loop | Loop Engineering (Osmani) | 六原语 + 你的人里必须有一个不信你的 |
| Loop | Improving Deep Agents | trace 分析 + self-verify + loop 检测 middleware |
| Loop | Thoughtworks harness | user = guide + sensor |
| 图 | eigent graph engineering | Goodhart / 向上失明 / 冲突 |
| 图 | iii.dev | 形状不是承重墙 |
| 图 | Cursor harness | 双轨评估 + 工具错误分类 |
| 图 | L14 | 五判据 + 编排税 |

## 附录 B — 什么时候不需要看

如果你的目标是**写一个能跑的 mini agent loop**（阶段 1）——REFERENCES 里引擎侧三篇看完就够，环境侧的文章只用来建立"以后可以装"的心智模型。

如果你的目标是**在真实仓库里让 agent 可靠工作**（阶段 2-3）——REFERENCES 里环境侧和验证侧的几篇是核心，loop 和图的文章只看不照搬。

如果你的目标是**搭一个能自己跑的 agent 系统**（阶段 4-5）——REFERENCES 全文按顺序读，遇到不懂的术语回到前一阶段补。