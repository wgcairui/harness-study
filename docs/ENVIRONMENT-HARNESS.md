# 环境侧 Harness — 五子系统实操指南

> 对应 [`ROADMAP`](./ROADMAP) 阶段 2-3。这一页**先讲清楚每件事为什么这样做**，然后给模板和自审计——你拿到的不是"清单"，是"为什么和怎么做"都解释透的指南。
> 本 repo 自己就是这套方法的第一个使用者（结尾有 2026-09-03 的真实自审计结果，包括审计时发现的三个真实问题）。

---

## 0. 一个项目从开工到可靠的最小路径

如果你读一个项目，每天早晨坐下来第一件事是什么？打开 IDE、看 git log、回想上次做到哪了。

agent 每天早晨坐下来**没**这件事。它醒来的整个工作世界 = system prompt + 任务描述 + 仓库内容 + 工具输出。它看不到你的 Slack 历史、Confluence、Jira、工单脑子里记得的隐性约定。**仓库看不到的，对 agent 来说就不存在。**

所以"环境侧 harness"要回答的不是"怎么让 agent 更聪明"，而是"怎么让仓库里 agent 看到的内容，能让它可靠地完成任务"。这就是 OpenAI 说的"仓库即规范"（repo as source of truth）。

后面四节，按工件的分类讲：

- **第 1 节** 讲三个**最小必须**先装的工件（AGENTS.md、init.sh、feature_list.json），装完 agent 才能开工
- **第 2 节** 讲**长会话才需要**的工件（progress.md、session-handoff.md、clean-state-checklist.md、evaluator-rubric.md）
- **第 3 节** 讲五子系统自审计怎么跑，**第 4 节** 是本 repo 自己的自审计结果
- **第 5 节** 讲你自己的项目怎么照做

---

## 1. 三个最小必须先装的工件

投入产出比排序按 Anthropic 的观察：反馈子系统（验证命令）通常回报最高。但你的项目如果连"agent 能启动、能看进度、能选功能"都还没建起来，先装下面这三个再加反馈——前三个是骨架，反馈是肉。

### 1.1 AGENTS.md — agent 的着陆页（指令子系统）

**为什么必须**：agent 开局读取这个文件。它不是百科全书——是着陆页，回答三个问题就够："这是什么项目"、"怎么跑"、"怎么验证"。

**怎么写**（50-200 行是合理区间；本 repo 自己的 AGENTS.md 是 88 行）：

- 项目目的（一两句话讲清楚是什么 + 给谁用）
- 开工流程（步骤序列）
- **验证命令**（必须可执行：`bunx tsc --noEmit && bun test` 这种，不是"应该能过"）
- 完成定义（功能"做完了"的可验证条件）
- 设计原则 / 不变量（5-10 条 不可违反的硬约束；不要罗列软建议）

**反面**：600 行的"过去每次失败都往里加一句"的累加文件。这种文件用 LLM 的"中间迷失"效应——关键约束埋在中间段被忽略，且把 agent 的上下文预算挤占光（10-20k tokens 浪费在读不相关历史）。

**Codex 给出的标准**：~100 行；细节拆进 `docs/` 子文档，从 AGENTS.md 链接过去。本 repo 的 AGENTS.md 就是这么维护的（你可以打开看它的链接结构）。

### 1.2 init.sh — 标准启动与验证脚本（环境子系统）

**为什么必须**：agent 不知道你的项目用什么包管理器、依赖锁文件在哪、启动命令是什么。把这些固化到一条命令里——agent 每次开工跑一次 `./init.sh`，成功说明环境是健康的，失败说明基线坏了先修这个。

**最小骨架**（30 行 bash 就能写完）：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_CMD=(npm install)        # 或 bun install / pip install
VERIFY_CMD=(npm test)            # 或 bun test / pytest
START_CMD=(npm run dev)          # 启动开发服务器

echo "==> 工作目录: $PWD"
"${INSTALL_CMD[@]}"
"${VERIFY_CMD[@]}"
echo "==> 启动命令：${START_CMD[*]}"
```

**三个变量**：INSTALL_CMD / VERIFY_CMD / START_CMD，换成你的项目实际命令，加 `chmod +x init.sh` 就行。

**init.sh 不止是脚本**——它是一个**约定**：每次会话开工先跑它。Anthropic 的工作流（[coding-agent-startup-flow](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/coding-agent-startup-flow)）里 init.sh 跑通之后才能继续——基线已红就先修基线，不要在坏起点上叠新功能。

### 1.3 feature_list.json — 机器可读的范围边界（状态 + 范围子系统）

**为什么必须**：agent 天生会"贪多——同时启动多个功能，结果一个都没完成"。给它一份机器可读的功能清单，每次只能选最高优先级、且只许一个 in_progress。

**最小骨架**（直接看本 repo 的 [`feature_list.json`](https://github.com/wgcairui/harness-study/blob/main/feature_list.json) 是真实例子）：

```json
{
  "rules": {
    "single_active_feature": true,
    "passing_requires_evidence": true,
    "do_not_skip_verification": true
  },
  "features": [
    {
      "id": "auth-001",
      "priority": 1,
      "area": "auth",
      "title": "用户登录",
      "user_visible_behavior": "用户能 POST /api/login 拿到 JWT",
      "status": "not_started",        // not_started / in_progress / blocked / passing
      "verification": [
        "发送 POST /api/login with 合法凭据",
        "断言返回 200 + 含 access_token 字段"
      ],
      "evidence": [],                 // 验证通过后 agent 填证据
      "notes": ""
    }
  ]
}
```

**两个规则不能删**：

- `passing_requires_evidence: true` — 没有证据不许标 passing。这是防"假 passing"的根螺栓——`status: passing` 但 `evidence` 为空，比没有 feature_list 更糟，因为它污染了下次会话的决策。
- `single_active_feature: true` — 同时只许一个 in_progress。课程 L07 的硬数据：WIP=1 的 agent 任务完成率比宽泛提示高 37%；代码行数和功能完成率呈负相关。

**粒度**：一个功能项应该是"一次会话能完成"的范围。"用户登录"是好粒度；"实现用户系统"太粗；"User model 加 name 字段"太细。

---

## 2. 长会话才需要的工件（按需加）

项目跑了一两周、会话拉长到多次后，再加下面四个。前三个是状态/交接基础设施，第四个是评审校准工具。

### 2.1 progress.md — 会话进度日志（状态子系统）

**为什么必须**：跨会话状态不丢。Anthropic 在 [Effective harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 里观察到一个铁律——**长任务一定会跨会话，跨会话一定会丢信息**。中间推理步骤里那些"为什么选方案 A 不选 B"的解释默认会被丢掉，下个会话看到代码却不知道为什么这么写。

**结构**（用本 repo 自己的 [progress.md](https://github.com/wgcairui/harness-study/blob/main/progress.md) 做模板）：

- **当前已验证状态**：仓库根 / 标准启动路径 / 标准验证路径 / 最高优先级未完成功能 / 当前 blocker
- **会话记录**：每轮一段（日期 / 本轮目标 / 已完成 / 跑过的验证 / 证据 / 风险 / 下一步）

**使用规则**：

- 开工先读——5 条命令内恢复全部上下文（pwd → progress → feature_list → git log → init.sh）
- 收尾前更新——这是 L12 的硬要求
- **不更新 = 给下个会话埋雷**：本 repo 第一次自审计就抓到了状态腐化（旧 progress.md 有 6 行假"待办"，layers 实际完成但表里仍标待办）

### 2.2 session-handoff.md — 会话交接摘要（状态子系统）

**为什么补**：当会话长到一小时以上，或项目有多个并行区域时，progress.md 不够用——交接摘要可以更短更结构化，专门给"下一轮接手的人"快速理解现状。

**结构**（直接抄 [session-handoff.md 模板](https://github.com/wgcairui/harness-study/blob/main/templates/session-handoff.md)）：

- 当前已验证（什么在跑 / 跑过什么验证）
- 本轮改动
- 仍损坏或未验证（已知缺陷 + 风险区）
- 下一步最佳动作（含"什么不能动"）
- 命令（启动 / 验证 / 定向调试）

**什么时候写**：长会话结束时必写；短会话可省。

### 2.3 clean-state-checklist.md — 收尾清单（反馈子系统）

**为什么补**：仓库状态默认朝熵增方向走。会话结束时如果不做清理，临时调试文件、注释掉的代码、TODO 标记会留下来，下个会话要花 30-50% 的时间在"搞清楚发生了什么"上（Anthropic 数据数据）。

**核心六条**（抄自本 repo 的 [clean-state-checklist 模板](https://github.com/wgcairui/harness-study/blob/main/templates/clean-state-checklist.md)）：

- 标准启动路径还能用
- 标准验证路径还能跑
- progress.md 已更新
- feature_list.json 真实反映 passing 与未验证（没有假 passing）
- 没有处于未记录状态的半成品
- 下次会话不需要人工修复就能继续

**使用规则**：agent 收尾流程里必须包含这张清单——过完才允许 commit。

### 2.4 evaluator-rubric.md — 评审评分表（反馈子系统）

**为什么补**：质量判断靠个人记忆和感觉，会让"评审主观"成 harness 最大的失败模式。把它变成六维度量化打分。

**六个维度**（每维度 0-2 分）：

1. **正确性** — 实现行为是否符合目标
2. **验证** — 要求的检查是否真的跑过并留证据
3. **范围纪律** — 会话是否保持在选定功能范围内
4. **可靠性** — 结果在重启/重跑后是否继续工作
5. **可维护性** — 代码和文档是否清楚到下一轮能接手
6. **交接准备度** — 新会话能否只靠仓库内文件继续推进

**结论选项**：Accept / Revise / Block。

**校准**：开箱即用的 agent 做评审很弱——它会发现问题然后说服自己通过。预计需要 3-5 轮校准：打分 →和你的人工判断对比 → 把有分歧的维度标准写更具体 → 重跑 → 直到基本一致。每轮记录改了什么、为什么改。

完整模板见 [evaluator-rubric.md](https://github.com/wgcairui/harness-study/blob/main/templates/evaluator-rubric.md)。

---

## 3. 怎么给一个真实仓库做五子系统自审计

不要一次性建完美 harness——Anthropic 的对照实验显示：装上验证命令（harness 第二阶段）之后成功率从 60% 升到 80%，加进度文件（harness 第三阶段）后稳定到 80-100%。**逐次装、观察效果，再装下一个。**

审计步骤：

1. **按五子系统表**（下面那个）对每个子系统打 1-5 分——本 repo 的自审计结果见第 4 节
2. **找出最低分的子系统**——一次只补那一个（别一次全堆上，这正是 L04 的告诫："给地图不给说明书"对工件本身同样适用）
3. **让 agent 干同一件中等任务**，对比补前补后的成功率（用同一个任务、同样的时间上限）
4. **一周后再审计一轮**——harness 和代码一样会腐化，定期还债

五子系统速查（用于审计打分）：

| 子系统 | 回答的问题 | 检查项 |
| --- | --- | --- |
| **指令** | agent 该做什么、按什么顺序 | AGENTS.md/CLAUDE.md 存在且 ≤200 行；验证命令写明且可跑 |
| **工具** | agent 能动什么、边界在哪 | tool schema 完整 + 边界权限配置 + 危险操作需确认 |
| **环境** | 依赖、版本、启动方式是否自描述 | init.sh 一条命令完成 setup + verify；lockfile 锁定版本 |
| **状态** | 上次干到哪了、下次从哪续 | progress.md / feature_list.json / git log 三件齐 |
| **反馈** | 怎么证明做对了 | 验证命令真跑过 + 评分标准存在 + 完成定义可执行 |

## 4. 本 repo 自审计（2026-09-03）

按上面的方法给 harness-study 自己打分。审计方法 = L02 练习 1 的"五元组审计"。

### 审计时的状态与发现

| 子系统 | 审计前状态 | 发现的问题 | 本次处置 |
| --- | --- | --- | --- |
| 指令 | `AGENTS.md` 有设计原则和阅读序 | **没有显式验证命令段**（反馈靠口口相传） | 新增「验证命令」段 |
| 工具 | 七层引擎完整，permission 独立 | — | （引擎侧强项） |
| 环境 | bun + `.env.example`，凭据隔离正确 | **没有 init.sh**，启动路径没固化 | 根目录新增 `init.sh` |
| 状态 | `progress.md` 有会话记录 | **状态腐化**：表格里有 6 行假"待办"残留（layers 2-7 实际已完成但表里仍标待办） | 重写 progress.md 为课程模板结构，删除假行 |
| 反馈 | `bunx tsc --noEmit` 可跑但未写入任何文档 | **learning-plan 承诺的 `bun test` 单元测试不存在**——七层按"完成"提交，但每层的 Verify 标准只有 type-check 达成 | 如实登记：feature_list 新增 `test-001`（not_started）+ `smoke-001`（blocked，401 有记录）；**不把七层标成假 passing** |

三个问题的共性很说明问题：**它们都不是代码 bug，而是 harness 缺口**——代码全部 type-check 通过，但"完成"缺证据（反馈）、"下一步"有假信号（状态）、"怎么跑"靠考古（环境）。这就是课程核心论点在本 repo 身上的就地验证：模型/代码没问题，harness 有问题。

### 审计后的工件清单

```
harness-study/
├── AGENTS.md            # 指令：原则 + 开工流程 + 验证命令 + 完成定义
├── init.sh              # 环境：bun install → tsc → bun test → 打印 demo 命令
├── feature_list.json    # 状态+范围：七层/测试/demo 的真实状态与证据
├── progress.md          # 状态：当前已验证状态 + 会话记录（课程模板结构）
└── docs/                # 学习学习路线（ROADMAP / REFERENCES / FRONTIER-HARNESS / 本文件）
```

注意 AGENTS.md 的行数控制在 ~100 行内（Codex 的目录页标准）：项目背景给一段，细节指向 DESIGN.md / learning-plan.md / docs/。

## 5. 对你自己的项目做同样的审计（阶段 2 作业）

1. 拿你天天用 agent 的真实项目，照上表逐子系统打 1-5 分
2. 找出**最低分**的那个，只补那一个工件，用 30 分钟
3. 让 agent 干同一件中等任务，对比前后表现（建议留好前后两次的输出做证据）
4. 一周后再审计一轮——harness 和代码一样会腐化，课程 L02 说"像还技术债一样还 harness 债"

## 6. 常见误区

- **把 harness 当成堆文件**。每个工件都对应一类失败模式（[method-map](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/reference/method-map)），没有那类失败就先别装那个文件。
- **假 passing**。`status: passing` 而证据为空 = 比没有 feature_list 更糟，因为它污染了下次会话的决策依据。
- **验证命令写完就完**。命令会失效（依赖升级、目录重构），每次会话开工跑一遍 init.sh 就是在校验 harness 本身。
- **把规则写进 prompt 而不是写进机制**。agent 会忽略叮嘱，但绕不过 `permission.ts` 和 init.sh——确定性约束 > 提示词恳求（Claude Code 拆解的结论，本 repo 的 `permission.ts` 是同一哲学）。

---

## 附录 A — 七个模板快速索引

本 repo 根目录的 [`templates/`](https://github.com/wgcairui/harness-study/tree/main/templates) 目录里有七件开箱即用的模板（改编自 [walkinglabs 课程模板库](https://walkinglabs.github.io/learn-harness-engineering/zh/resources/templates/)，MIT 许可保留署名）：

| 模板 | 适用 | 一句话 |
| --- | --- | --- |
| [`AGENTS.md`](https://github.com/wgcairui/harness-study/blob/main/templates/AGENTS.md) | 第 1 顺位 | 根指令：开工流程、工作规则、完成定义 |
| [`init.sh`](https://github.com/wgcairui/harness-study/blob/main/templates/init.sh) | 第 2 顺位 | 一条命令完成装依赖 + 基线验证 + 打印启动命令 |
| [`feature_list.json`](https://github.com/wgcairui/harness-study/blob/main/templates/feature_list.json) | 第 3 顺位 | 机器可读的范围边界：一次只许一个 in_progress |
| [`progress.md`](https://github.com/wgcairui/harness-study/blob/main/templates/progress.md) | 第 4 顺位 | 会话进度日志：下会话开头读它，结束前写它 |
| [`session-handoff.md`](https://github.com/wgcairui/harness-study/blob/main/templates/session-handoff.md) | 长会话再加 | 交接摘要：哪可用、哪坏了、下一步 |
| [`clean-state-checklist.md`](https://github.com/wgcairui/harness-study/blob/main/templates/clean-state-checklist.md) | 长会话再加 | 收尾清单：不过完不许 commit |
| [`evaluator-rubric.md`](https://github.com/wgcairui/harness-study/blob/main/templates/evaluator-rubric.md) | 阶段 3 再加 | 六维度评分表：正确性/验证/范围/可靠性/可维护性/交接 |