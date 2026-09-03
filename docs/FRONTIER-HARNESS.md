# 前沿 Harness 拆解 — Pi / Claude Code / Codex / DeepSeek

> 这一页把四个前沿产品的 harness 拆给你看。先讲它们各自的设计哲学、各子系统怎么落地、相互之间有什么关键取舍，**然后**才给出映射和原文链接。
> 对应 [`ROADMAP`](./ROADMAP) 阶段 5。读之前最好先看完 [`ROADMAP`](./ROADMAP) 阶段 2-3 五子系统那一段——四个产品的差别就是"同样五格，他们怎么填"。

---

## 0. 同一个问题，四种回答

四个产品都对"harness 应该怎么设计"给出了回答——但答案不一样：

| 产品 | 一句话哲学 | 设计取向 | 把判断权交给谁 |
| --- | --- | --- | --- |
| **Claude Code** | 循环是骨架，骨架之外的系统才决定可靠性 | **加法**：记忆/权限/压缩/子智能体全做进内核 | Anthropic 团队 |
| **Codex** | 可复用的部分是 agent loop；仓库即事实来源 | **减法**：内核克制，责任放给仓库约定 + worktree 隔离 | 仓库结构 + 约定 |
| **Pi** | 内核最小化 + 扩展可编程化，什么都不替你决定 | **开放**：把决定权做成扩展点 | 你（装什么扩展由你） |
| **DeepSeek Harness** | harness 是独立于模型的操作系统，Everything is a Plugin | **解构**：连 agent loop 本身都是插件 | 你（连内核都能换） |

它们面对的不是同一类用户：Claude Code 给"想要开箱即用"的 CLI 交互者；Codex 给"想嵌入自己产品"的平台工程师；Pi 给"想自己定义"的开发者；DeepSeek Harness 给"模型无关部署"的研究员/企业。**没有谁对谁错——只是取舍边界不同。**

接下来每一节都按"哲学 → 子系统落地 → 关键取舍 → 对本 repo 的映射 → 值得抄的设计"展开。

---

## 1. Claude Code — "什么都替你装好的运行环境"

**哲学**：让 agent 在一个完整、可扩展、可观测的运行时里工作，开发者不需要从零搭环境。Anthropic 官方把 Claude Code 直接归入 **agentic harness**——它本身就是这门方法的产品化样本。

**子系统落地**：

- **指令**：CLAUDE.md 分四级作用域（组织策略 / 用户级 / 项目级 / 本地级），按加载顺序从宽到严；子目录级按需加载（agent 读该目录文件时才进入上下文）；auto memory 自动写笔记（每会话最多前 200 行或 25KB）。**层级化不是装饰——越具体的指令越晚进入上下文，避免被通用指令稀释。**
- **工具**：四种扩展机制严格分工——Skills（过程性知识，触发词加载）、MCP（外部系统 JSON-RPC 桥）、Hooks（PreToolUse / PostToolUse / Stop 生命周期事件脚本）、Sub-agents（专门化 agent）。**CLAUDE.md 管"是什么"、Skills 管"怎么做"、MCP 管"连到哪"、Hooks 管"何时强制"**——混用就会出现上下文渗漏。
- **状态**：五层压缩管线（先无损后损——先剪枝冗余工具结果，再结构化提炼，最后才动用有损 LLM 摘要，配套熔断机制防止过度压缩）；追加式会话存储 `history.jsonl` 支持 `/resume` + fork。
- **权限**：七种模式 + 一个 ML 分类器；低风险放行、高风险按策略询问或拒绝——把"给 agent 划清边界"做成运行时强制，不是写在 prompt 里的希望。
- **可观测性**：agent 宣称完成时 `Stop` 钩子强制跑检查；`PostToolUse` 钩子把检查结果写回上下文；子智能体对话存独立 sidechain，不膨胀父智能体上下文。

**关键取舍**：把"记忆/权限/压缩/子智能体"全做进内核。代价是体积大、对新模型/新工具的适配周期长；好处是开箱即用，Anthropic 团队经验可复制到用户。

**对本 repo 的映射**：

| Claude Code 机制 | 本 repo 的雏形 | 留给深度 2 |
| --- | --- | --- |
| CLAUDE.md 四级作用域 | `src/prompt.ts` 只拼本地 frontmatter（AGENTS.md 设计原则 4） | auto memory、子目录按需加载 |
| 权限七模式 + ML 分类器 | `src/permission.ts`（allowedTools + ask + bash 黑名单双层防御） | plan 模式、风险分类器 |
| 五层压缩管线 | — | context compaction |
| 追加 history.jsonl + /resume + fork | README 真实系统地图里的 `transcript.jsonl` | session 持久化 + resume |
| 子智能体 sidechain 隔离 | — | 多 agent 编排 |
| PostToolUse 钩子强制验证 | — | 思考题：把"执行后检查"加进事件流要改哪几处？ |

**值得抄的设计**：

1. **指令按作用域分层**——不堆在一个文件里，目录级就近加载
2. **压缩是分级漏斗**——先无损后损，别一上来就全文摘要
3. **用钩子做确定性检查**——防提前宣告完成靠运行时强制，不是 prompt 恳求
4. **子智能体上下文隔离**——拆任务同时也拆上下文，别让子任务结果污染主循环
5. **会话存储追加式 + 可重放**——交接不靠记忆，靠存储层保证

原文参考：[Claude Code 官方文档](https://code.claude.com/docs/en/memory)、[VILA Lab《Dive into Claude Code》](https://zhiqiangshen.com/projects/Claude_Code_Report/Claude_Code_Report.pdf)。

---

## 2. Codex — "仓库即规范、内核克制"

**哲学**：可复用的部分是 agent loop，仓库是事实来源，AGENTS.md 只是目录页，工程的价值在于设计环境、表达意图、构建反馈循环。OpenAI 把整个 Codex harness 用 Apache-2.0 协议开源，把"agent 循环"变成了可嵌入其他产品的引擎。

**子系统落地**：

- **指令**：AGENTS.md 控制在 ~100 行（这是 Codex 给出的具体数字），复杂细节进结构化 `docs/`。**AGENTS.md 是路由器不是百科全书。**
- **上下文**：Write-Select-Compress-Isolate 四策略——Write 把上下文持久化到窗口之外（写进文件）；Select 只把需要的 token 拉进窗口（按需读文件）；Compress 用自动压缩或 `/compact` 手动触发；Isolate 用 subagent 隔离不同任务的上下文（前端 subagent 永远看不到后端 schema）。**环境上下文只传增量**——`build_environment_update_item` 只输出变更字段（CWD/git 分支/文件系统），不每轮重复完整系统上下文。
- **环境**：每个任务跑在独立 git worktree，配合本地可观测性栈（logs/metrics/tracing）。ARC-AGI-3 硬数据：保留推理 + 压缩两个开关把 GPT-5.6 Sol 得分从 13.3% 拉到 38.3%，输出 token 减少 6 倍。
- **工具**：三层集成入口——`codex exec`（非交互 CLI，--json / --output-schema / --sandbox / --ephemeral）/ Codex SDK（TypeScript / Python 程序化）/ Codex App Server（产品嵌入的 JSON-RPC 协议）。共享同一个开源 harness 内核，集成深度可选。
- **状态**：app-server 的 Thread / Turn / Item 三原语——Thread 是用户与 agent 的一段对话（含多个 Turn）；Turn 是一次用户请求及随后的 agent 工作；Item 是输入或输出的最小单位。支持 thread/resume/fork/rollback/compact。
- **反馈**：验证命令写进 AGENTS.md（必须可执行）；审批策略和 plan mode 把"任务边界"和"人类决策权"做成运行时控制；CI 流水线接 codex exec 做自动修复。

**关键取舍**：内核尽量克制，把责任放在仓库约定和上下文工程上。和 Claude Code 形成鲜明对照——Claude Code 是加法（记忆权限全做进内核），Codex 是减法（约定优先、内核只做最小约定支撑）。

**对本 repo 的映射**：

| Codex 机制 | 本 repo 的雏形 | 留给深度 2 |
| --- | --- | --- |
| AGENTS.md 当目录页（~100 行） | 本 repo 根目录 `AGENTS.md` 就是这么维护的 | — |
| 验证命令写进 AGENTS.md | 本 repo `AGENTS.md` 的「验证命令」段 | CI 自动修复 |
| worktree 隔离 + 沙箱策略 | — | 任务级环境隔离 |
| app-server Thread/Turn/Item 原语 | `src/events.ts`（Event union + Emitter 就是"把循环变成事件流"的最小版） | thread/resume/fork/rollback 协议 |
| Write-Select-Compress-Isolate | "Write" 对应 `progress.md` 写盘；"Select" 对应按需读 docs/ | context compaction + subagent 隔离 |

**值得抄的设计**：

1. **AGENTS.md 当目录页**——~100 行，细节进 `docs/`，可机械化检查
2. **执行不变量、不微管实现**——硬约束 + 验证命令，剩下交给模型
3. **保留推理 + 压缩**——别用滚动截断丢弃模型刚想的思路，用压缩保留学到的知识（ARC-AGI-3 3 倍提升是证据）
4. **用 worktree 做环境隔离**——任务边界靠环境强制，不靠指令恳求
5. **环境上下文只传增量**——每轮只输出变更字段，别重复粘贴完整系统上下文
6. **把 agent 循环做成可嵌入的协议**——Thread/Turn/Item 原语 + 生命周期控制
7. **子智能体做上下文隔离**——拆任务的同时拆上下文

原文参考：[Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform)、[Harness Engineering](https://openai.com/index/harness-engineering/)、[ARC-AGI-3 数据](https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/)。

---

## 3. Pi — "最小内核 + 你来扩展"

**哲学**：官方定位刻意把内核做小、把决定权交还给你——"Ask Pi to build what you want, or install a package that does it your way"。把 harness 拆成四层可定制物：扩展（生命周期钩子）、技能（按需加载能力包）、提示模板（`/name` 展开的 Markdown）、主题（TUI 外观）。**把"模型能看到什么、什么时候能看到"完全交给规则和扩展，而不是写死在内核里。**

**子系统落地**：

- **指令**：AGENTS.md 三级加载顺序（全局 `~/.pi/agent/AGENTS.md` → 父目录链 → 当前目录，也兼容 CLAUDE.md）。SYSTEM.md 可以按项目 replace 或 append 默认系统提示——是 Pi 允许你动系统提示的唯一正式入口。
- **状态与上下文**：Pi 拆得最细——压缩策略**可插拔**（默认自动压缩可被扩展覆盖，比如基于话题的压缩、代码感知的摘要、甚至换摘要模型）；动态上下文（扩展可在每轮推理前注入消息、过滤历史、做 RAG）；**会话树**（`/tree` 回任意历史节点继续，所有分支保存在同一文件，可导出 HTML）。
- **工具**：Skills 按需加载（包含指令和工具，遵循 Agent Skills 标准，渐进式披露不打爆 prompt cache——这是成本角度的设计）；扩展挂生命周期事件（pre-step / request / pre-execute / post-step）。
- **反馈**：社区 harness `pi-agent-harness` 用扩展结构化"反馈回路"——session-summary 维护 PROGRESS.md、extract-patterns 沉淀 LESSONS.md、telemetry 记录 token 用量。
- **环境**：System-of-record 风格的 `VISION.md` / `PROGRESS.md` / `LESSONS.md` / `STANDARDS.md` 四件套。

**关键取舍**：什么都不替你决定。代价是你要么自己写扩展，要么装别人写好的包；好处是 harness 的每一处都可以被你改、最终长成你想要的样子。

**对本 repo 的映射**：

| Pi 机制 | 本 repo 的雏形 | 留给深度 2 |
| --- | --- | --- |
| AGENTS.md 三级加载 | `AGENTS.md` 设计原则 5（只读本地 frontmatter） | 全局级 / 用户级 scope |
| SYSTEM.md replace/append | `src/prompt.ts` buildSystemPrompt | 多层级 system prompt 拼装 |
| 压缩可插拔 | — | context compaction 接口化 |
| 会话树（可回到任意历史节点） | — | 思考题：transcript.jsonl 事件序列能不能长成树？ |
| 扩展挂生命周期事件 | `src/events.ts` Emitter + `permission.ts` hook 点 | 可编程扩展面（pre-step / pre-execute 等） |

**值得抄的设计**：

1. **压缩策略做成可插拔**——你的 harness 里"上下文怎么压缩"应该是策略接口而非写死参数
2. **用会话树替代硬摘要**——跨会话恢复不一定要靠"上一轮总结"，结构化重放历史往往是更可靠的状态子系统
3. **提示缓存友好**——按需加载技能，别把全部规则一次性塞进 system（同时是上下文工程和成本工程）
4. **让 agent 能改自己的 harness**——扩展面够开放，"优化 agent 行为"这件事就能半自动完成

原文参考：[pi.dev 官网](https://pi.dev/)、[Pi Coding Agent 源码 README](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)、[pi-agent-harness 社区仓库](https://github.com/LabidySabidy/pi-agent-harness)。

---

## 4. DeepSeek Harness — "Everything is a Plugin"

**哲学**：**Agent = Model + Environment + Tools + State**。harness 本身可以脱离模型成为独立运行时。"产品的每一部分都是插件，包括模型适配器、工具注册表、会话日志，甚至 agent 循环本身。"（[架构文档原文](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)）

**子系统落地**：

- **架构核心 1 — 能力接缝（Capability Seam）**：每个能力都拆三层——Service Definition（声明接口）/ Service Provider（实现接口，Local FS、E2B FS、Remote FS 是不同 Provider）/ Consumer（使用接口，模型面工具）。同一套结构覆盖 FS、Shell、Subprocess、Sandbox、Web、LLM、SubAgent。**依赖"能力接口"而非"具体工具"——换一个 Provider，工具对模型暴露的样子不变，但环境彻底变了。**
- **架构核心 2 — 事件流水线**：内部不是简单 LLM→工具→LLM，而是一条事件流水线——`turn/start → claim input → assemble (system/context/tools) → agent/pre-step → step/start → LLM request → llm/stream → assistant/message → tool/call → tools/pre-execute (permission/guard/policy/hook) → tools/execute → tools/post-execute → tool/result → step/end`。**大量功能根本不用修改 agent 循环本身**——想在工具执行前做安全检查？监听 `tools/pre-execute`；想加记忆？在 `agent/pre-step` 注入；想改模型请求？挂钩 `agent/request`；想决定是否继续推理？监听 `agent/turn-stopping`。
- **架构核心 3 — Session Event Log**："**Model-visible means logged.** Anything that reaches a model request must be reconstructable from the log, and a runtime invariant asserts it."（任何进入模型请求的东西都必须能从日志重建，且有运行时不变量强制。）append-only、只追加不覆写、会话状态可重放——可观测性不是事后补的日志，是 harness 的第一性约束。
- **指令**：插件化——规则/技能以插件形态注入，没有内置的 "CLAUDE.md" 惯例。
- **环境**：沙箱/FS/Shell 全部可换 Provider（含远程 E2B）。
- **反馈**：tools/pre-execute 上的 permission / guard / policy / hook——反馈机制事件化。

**关键取舍**：把 harness 定义成独立于模型的操作系统，agent 本身只是这套 OS 上的一个可替换应用。代价：配置成本高（自由度高的另一面）。Developer Preview 阶段"先尝鲜、机制尚在演进"的定位诚实承认了这一点。

**对本 repo 的映射**：

| DeepSeek 机制 | 本 repo 的雏形 | 留给深度 2 |
| --- | --- | --- |
| 事件流水线（turn/* → tools/pre-execute → tool/result → step/end） | **`src/events.ts` + `src/loop.ts` 的展开就是这条流水线的迷你版**——对照两边的序列看 | 插件化内核 |
| 能力接缝 Service Def→Provider→Consumer | `src/tools/registry.ts`（interface + Map 即"声明接口→实现→消费者"的最简版） | FS/Shell/沙箱 Provider 整块替换 |
| "Model-visible means logged"（append-only） | `transcript.jsonl` 事件序列（README 真实系统地图） | 运行时不变量强制 |
| tools/pre-execute 上的 permission hook | `src/permission.ts`（在 loop 调用前先过它） | tools/post-execute 钩子（Claude Code 同款防提前宣告完成） |

三个特别值得停下来体会的对照：

1. **DeepSeek 事件流水线 vs 你的 `loop.ts`**：把 DeepSeek 的 `turn/start → assemble → llm/stream → tool/call → tools/pre-execute → tools/execute → tool/result` 和你 `loop.ts` 里"调 LLM → permission 拦 → dispatch → tool_result 回灌"逐行对照——你的 mini harness 已经把流水线的**拓扑**走通了，缺的是把每一步做成可监听的事件点。
2. **"Model-visible means logged" 是运行时不变量**——不是建议，是强约束。本 repo `events.ts` 是单向事件流（harness → UI），），这同样是这种精神的约束的：可不可回回放、可不可从日志重建模型看到的一切。
3. **能力接缝 vs 具体工具**：你的 `src/tools/registry.ts` 是 Map<string, ToolDef>，ToolDef 是 interface——这已经是"声明接口→实现"的雏形。DeepSeek 把它标准化为三层（Service Def / Provider / Consumer），未来你想换 FS Provider（local → E2B 远程）就是 registry 里挂不同的 Provider。

**值得抄的设计**：

1. **把循环的每一步变成事件点**——权限、记忆、策略、日志作为监听者挂在循环上，不写死在循环里
2. **能力接缝标准化**——依赖"能力接口"而非"具体工具"，环境可以整块替换而不影响模型看到的工具面
3. **Model-visible means logged**——把可观测性从"加分项"变成"第一性约束"
4. **append-only 会话日志**——状态可重放，交接可靠

原文参考：[DeepSeek Harness 架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)、[官网定义](https://deepseek.com/harness)。

---

## 5. 怎么读这一页

1. 先读完本 repo [`ROADMAP`](./ROADMAP) 阶段 0-3，建立五子系统的心智模型——四个产品的差别就是"同样五格，他们怎么填"。
2. 按上面 1-4 节顺序读，每节末尾的"值得抄的设计"是按"投入产出比"排序的——抄第 1 条比第 4 条容易且回报高。
3. 读完后做下面三个练习。

## 6. 练习（毕业考的一部分）

1. **审计一个没拆过的产品**：挑 Cursor / Devin / OpenHands / Aider 任一，产出五子系统审计（格式照抄上面"子系统落地 / 关键取舍 / 映射 / 值得抄"四段）。
2. **归因取舍**：Claude Code（加法）和 Codex（减法）在"状态子系统"上设计完全不同（内建记忆 vs 仓库约定）。写下：什么条件下你会选哪边？用你自己项目的失败案例做证据。
3. **反推本 repo 的下一层**：四个产品各有你最想抄的一个机制，把它加进本 repo 的深度 2 清单（README「不做的事」），并注明它对应哪一层、需要动哪些文件。