# 环境侧五子系统 · 实操指南

> 对应 [ROADMAP 阶段 2-3](./ROADMAP.md)。这一篇回答两个问题：
> ① 五子系统具体怎么装进一个仓库（模板在哪、先装哪个）；
> ② 本 repo 自己是怎么装的——附 2026-09-03 的自审计结果，包括审计时发现的三个真实问题。
> 本 repo 是这套方法的第一个使用者：**它的文档结构本身就是教学材料**。

## 五子系统速查

| 子系统 | 回答的问题 | 承载文件（本 repo 为例） | 装它要花多久 |
| --- | --- | --- | --- |
| **指令** | agent 该做什么、按什么顺序、先读什么 | `AGENTS.md` | 1 小时 |
| **工具** | agent 能动什么、边界在哪 | 引擎侧：`src/tools/*` + `permission.ts`；环境侧：AGENTS.md 里的允许范围 | 已有 |
| **环境** | 依赖、版本、启动方式是否自描述 | `package.json` + `.env.example` + `init.sh` | 30 分钟 |
| **状态** | 上次干到哪了、下次从哪续 | `progress.md` + `feature_list.json` + git log | 30 分钟 |
| **反馈** | 怎么证明做对了、不合格怎么办 | AGENTS.md 验证命令段 + `bunx tsc` / `bun test` + evaluator-rubric | 1 小时 + 长期校准 |

投入产出比排序（Anthropic 的观察，课程 L02 也强调）：**反馈子系统通常回报最高**——
先在 AGENTS.md 里把验证命令写清楚，这一小时的收益超过其他所有工件。

## 七件模板套装（templates/）

改编自 [walkinglabs 课程模板库](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/templates/)（MIT License, © WalkingLab），按本 repo 的语境改写并保留原意：

| 模板 | 什么时候装 | 作用 |
| --- | --- | --- |
| [`AGENTS.md`](https://github.com/wgcairui/harness-study/blob/main/templates/AGENTS.md) | 第 1 顺位 | 根指令：开工流程、工作规则、完成定义 |
| [`init.sh`](https://github.com/wgcairui/harness-study/blob/main/templates/init.sh) | 第 2 顺位 | 一条命令完成装依赖 + 基线验证 + 打印启动命令 |
| [`feature_list.json`](https://github.com/wgcairui/harness-study/blob/main/templates/feature_list.json) | 第 3 顺位 | 机器可读的范围边界：一次只许一个 in_progress |
| [`progress.md`](https://github.com/wgcairui/harness-study/blob/main/templates/progress.md) | 第 4 顺位 | 会话进度日志：下会话开头读它，结束前写它 |
| [`session-handoff.md`](https://github.com/wgcairui/harness-study/blob/main/templates/session-handoff.md) | 长会话再加 | 交接摘要：哪可用、哪坏了、下一步 |
| [`clean-state-checklist.md`](https://github.com/wgcairui/harness-study/blob/main/templates/clean-state-checklist.md) | 长会话再加 | 收尾清单：不过完不许 commit |
| [`evaluator-rubric.md`](https://github.com/wgcairui/harness-study/blob/main/templates/evaluator-rubric.md) | 阶段 3 再加 | 六维度评分表：正确性/验证/范围/可靠性/可维护性/交接 |

安装要领（详细字段说明见[课程模板使用指南](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/templates/)）：

1. 复制后**先改验证命令**，再改其余——模板里的命令是占位符，不改就是假 harness。
2. feature_list 的规则段不要删：`passing_requires_evidence: true` 是防"假 passing"的根螺栓。
3. 优先补 method-map 里你当前失败模式对应的那个工件，**不要一次全堆上**（课程 L04：给地图不给说明书，对工件本身同样适用）。

## 本 repo 自审计（2026-09-03）

按五子系统给 harness-study 打分。审计方法 = 课程 L02 练习 1 的"五元组审计"。

### 审计时的状态与发现

| 子系统 | 审计前状态 | 发现的问题 | 本次处置 |
| --- | --- | --- | --- |
| 指令 | `AGENTS.md` 有设计原则和阅读序 | **没有显式验证命令段**（反馈靠口口相传） | 新增「验证命令」段 |
| 工具 | 七层引擎完整，permission 独立 | — | （引擎侧强项） |
| 环境 | bun + `.env.example`，凭据隔离正确 | **没有 init.sh**，启动路径没固化 | 根目录新增 `init.sh` |
| 状态 | `progress.md` 有会话记录 | **状态腐化**：表格里有 6 行假"待办"残留（layers 2-7 实际已完成但表里仍标待办）——正是课程 L05 说的下次会话摸黑根源 | 重写 progress.md 为课程模板结构，删除假行 |
| 反馈 | `bunx tsc --noEmit` 可跑但未写入任何文档 | **learning-plan 承诺的 `bun test` 单元测试不存在**——七层按"完成"提交，但每层的 Verify 标准只有 type-check 达成 | 如实登记：feature_list 新增 `test-001`（not_started）+ `smoke-001`（blocked，401 有记录）；**不把七层标成假 passing** |

三个问题的共性很说明问题：**它们都不是代码 bug，而是 harness 缺口**——
代码全部 type-check 通过，但"完成"缺证据（反馈）、"下一步"有假信号（状态）、"怎么跑"靠考古（环境）。
这就是课程核心论点在本 repo 身上的就地验证：模型/代码没问题，harness 有问题。

### 审计后的工件清单

```
harness-study/
├── AGENTS.md            # 指令：原则 + 开工流程 + 验证命令 + 完成定义
├── init.sh              # 环境：bun install → tsc → bun test → 打印 demo 命令
├── feature_list.json    # 状态+范围：七层/测试/demo 的真实状态与证据
├── progress.md          # 状态：当前已验证状态 + 会话记录（课程模板结构）
└── docs/                # 学习路线（ROADMAP / REFERENCES / FRONTIER-HARNESS / 本文件）
```

注意 AGENTS.md 的行数控制在 ~100 行内（Codex 的目录页标准）：项目背景给一段，
细节指向 DESIGN.md / learning-plan.md / docs/。

## 对你自己的项目做同样的审计（阶段 2 作业）

1. 拿你天天用 agent 的真实项目，照上表逐子系统打 1-5 分。
2. 找出**最低分**的那个，只补那一个工件，用 30 分钟。
3. 让 agent 干同一件中等任务，对比前后表现（建议留好前后两次的输出做证据）。
4. 一周后再审计一轮——harness 和代码一样会腐化，课程 L02 说"像还技术债一样还 harness 债"。

## 常见误区

- **把 harness 当成堆文件**。每个工件都对应一类失败模式（method-map），没有那类失败就先别装那个文件。
- **假 passing**。`status: passing` 而证据为空 = 比没有 feature_list 更糟，因为它污染了下次会话的决策依据。
- **验证命令写完就完**。命令会失效（依赖升级、目录重构），每次会话开工跑一遍 init.sh 就是在校验 harness 本身。
- **把规则写进 prompt 而不是写进机制**。agent 会忽略叮嘱，但绕不过 `permission.ts` 和 init.sh——确定性约束 > 提示词恳求（Claude Code 拆解的结论，本 repo 的 `permission.ts` 是同一哲学）。
