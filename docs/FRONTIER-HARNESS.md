# 前沿 Harness 拆解 · 读本

> 对应 [ROADMAP 阶段 5](./ROADMAP.md)。walkinglabs 课程用五子系统框架拆了四个前沿产品的 harness
> （[Claude Code](https://walkinglabs.github.io/learn-harness-engineering/zh/harness-designs/claude-code/) /
> [Codex](https://walkinglabs.github.io/learn-harness-engineering/zh/harness-designs/codex/) /
> [Pi](https://walkinglabs.github.io/learn-harness-engineering/zh/harness-designs/pi/) /
> [DeepSeek](https://walkinglabs.github.io/learn-harness-engineering/zh/harness-designs/deepseek/)）。
> 本文件是它们的**导读 + 对本 repo 七层的映射表**——读原文前先看这张地图，读完后做文末的练习。
>
> 和 README 的「真实系统对应地图」分工：那边是"本 repo 每层 ↔ ZCode/Claude Code SDK 里的原型"，
> 这边是"四个产品的 harness 设计 ↔ 本 repo 哪一层承载了它的雏形、哪些留给深度 2"。

## 先建立一个问题意识

四个产品对"harness 是什么"给出了四种不同答案：

| 产品 | 一句话哲学 | 设计取向 |
| --- | --- | --- |
| **Claude Code** | 循环是骨架，骨架之外的系统才决定可靠性 | **加法**：记忆/权限/压缩/子智能体全做进内核 |
| **Codex** | 可复用的部分是 agent loop；仓库即事实来源 | **减法**：内核克制，责任放给仓库约定 + worktree 隔离 |
| **Pi** | 内核最小化 + 扩展可编程化，什么都不替你决定 | **开放**：把决定权做成扩展点 |
| **DeepSeek Harness** | harness 是独立于模型的操作系统，Everything is a Plugin | **解构**：连 agent loop 本身都是插件 |

读四篇时带着这个问题：**同一套五子系统，为什么四个团队给出了不同的取舍边界？**
答案不在对错，在各自的用户与场景（CLI 交互者 / 平台嵌入者 / 开发者定制者 / 模型无关部署者）。

## 映射表：产品机制 → 本 repo 哪一层

读每篇拆解时对照这张表。**"本 repo 的雏形"** = 你已经写过的对应代码；
**"留给深度 2"** = 本 repo 划为 out-of-scope、毕业后回补的方向。

| 产品机制（原文出处见各拆解篇） | 本 repo 的雏形 | 留给深度 2 |
| --- | --- | --- |
| Claude Code · CLAUDE.md 四级作用域（组织/用户/项目/本地） | `src/prompt.ts` 只拼本地 frontmatter（设计原则 4） | auto memory、子目录按需加载 |
| Claude Code · 权限七模式 + ML 分类器 | `src/permission.ts`（allowedTools + ask + bash 黑名单双层防御） | plan 模式、风险分类器 |
| Claude Code · 五层压缩管线（先无损后损） | — | context compaction |
| Claude Code · 追加式 history.jsonl + /resume + fork | README 真实系统地图里的 `transcript.jsonl` | session 持久化 + resume |
| Claude Code · 子智能体 sidechain 上下文隔离 | — | 多 agent 编排 |
| Codex · AGENTS.md 当目录页（~100 行，细节进 docs/） | 本 repo 根目录 `AGENTS.md` 就是这么写的（见 §4） | — |
| Codex · 验证命令写进 AGENTS.md | 本 repo `AGENTS.md` 的「验证命令」段（本次新增，见 §4） | CI 自动修复 |
| Codex · worktree 隔离 + 沙箱策略 | — | 任务级环境隔离 |
| Codex · app-server 的 Thread/Turn/Item 原语 | `src/events.ts`（Event union + Emitter 就是"把循环变成事件流"的最小版） | thread/resume/fork/rollback 协议 |
| Pi · 扩展挂生命周期事件（pre-step / request / pre-execute） | `src/events.ts` Emitter + `permission.ts` hook 点 | 可编程扩展面 |
| Pi · 压缩策略可插拔、会话树 | — | compaction 接口化、session tree |
| DeepSeek · Turn flow 事件流水线（turn/* → tools/pre-execute → …） | **`src/events.ts` + `src/loop.ts` 的展开就是这条流水线的迷你版**——对照两边的序列看 | 插件化内核 |
| DeepSeek · 能力接缝（Service Definition → Provider → Consumer） | `src/tools/registry.ts`（interface + Map 即"声明接口→实现→消费者"的最简版） | FS/Shell/沙箱 Provider 整块替换 |
| DeepSeek · "Model-visible means logged"（append-only） | `transcript.jsonl` 事件序列（README 真实系统地图） | 运行时不变量强制 |

三个特别值得停下来体会的对照：

1. **DeepSeek 的事件流水线 vs 你的 `loop.ts`**：把 DeepSeek 那条
   `turn/start → assemble → llm/stream → tool/call → tools/pre-execute → tools/execute → tool/result`
   和你 `loop.ts` 里"调 LLM → permission 拦 → dispatch → tool_result 回灌"逐行对照，
   你会发现七层小 harness 已经把流水线的**拓扑**走通了，缺的只是把每一步做成可监听的事件点。
2. **Codex 的 AGENTS.md 目录页 vs 课程 L04**：课程讲"巨型指令文件会失败"的道理，
   Codex 给出可执行的标准——约 100 行、只写不变量和验证命令、细节拆进 docs/。
   本 repo 的 AGENTS.md 刻意按这个标准维护。
3. **Claude Code 钩子 vs 你的 permission 层**：PostToolUse 钩子强制跑检查 = "干活的人和检查的人分开"的运行时实现。
   你的 `permission.ts` 只在"执行前"拦；思考：把"执行后检查"加进事件流要改哪几处？（阶段 3 的思考题）

## 读法

1. 先读课程 [L02](https://walkinglabs.github.io/learn-harness-engineering/zh/lectures/lecture-02-what-a-harness-actually-is/) 确保五子系统框架在手（阶段 0 就该完成）。
2. 按顺序读四篇拆解原文（每篇 15-20 分钟），每篇末尾都有「映射到课程框架」和「值得借鉴的设计」两节。
3. 每读完一篇，回到上面的映射表填一行你自己的发现：这个机制在你 `src/` 里对应什么？为什么 mini 版可以不做？
4. 全部读完做下面的练习。

## 练习（毕业考的一部分）

1. **审计一个没拆过的产品**：挑 Cursor / Devin / OpenHands / Aider 任一，产出五子系统审计
   （格式照抄四篇拆解的「映射到课程框架」表）。
2. **归因取舍**：Claude Code（加法）和 Codex（减法）在"状态子系统"上的设计完全不同
   （内建记忆 vs 仓库约定）。写下：什么条件下你会选哪边？用你自己项目的失败案例做证据。
3. **反推本 repo 的下一层**：四个产品各有你最想抄的一个机制，把它加进本 repo 的深度 2 清单
   （README「不做的事」），并注明它对应哪一层、需要动哪些文件。
