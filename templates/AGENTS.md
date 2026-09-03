<!--
改编自 Learn Harness Engineering 课程模板（MIT License, © WalkingLab）
https://walkinglabs.github.io/learn-harness-engineering/zh/resources/templates/
复制到你的项目根目录后，把命令、路径、规则换成你自己项目的。
-->

# AGENTS.md

本仓库为长时 coding-agent 工作设计。目标不是最大化单次产出，而是让下一次会话
不需要猜就能接续。

## 开工流程

写代码之前：

1. `pwd` 确认工作目录。
2. 读 `progress.md`，了解当前已验证状态和下一步。
3. 读 `feature_list.json`，选最高优先级的未完成功能。
4. `git log --oneline -5` 回顾最近改动。
5. 运行 `./init.sh`。
6. 开工前先跑一遍基线验证，确认起点是健康的。

基线验证已经失败时，先修基线。**不要在坏起点上叠新功能。**

## 工作规则

- 一次只做一个功能。
- 代码加了不等于功能完成——没有验证证据不许标记 passing。
- 改动保持在选定功能范围内；blocker 逼出来的窄修复除外，且要记录。
- 实现过程中不许悄悄改验证规则。
- 持久化产物优先于聊天记录：状态写文件，不写对话。

## 必需工件

- `feature_list.json`：功能状态的唯一事实来源
- `progress.md`：会话日志 + 当前已验证状态
- `init.sh`：标准启动与验证路径
- `session-handoff.md`：长会话可选交接摘要

## 验证命令

按你项目实际替换（这是整个 harness 里投入产出比最高的一段，别留占位符）：

```
- 类型检查：bunx tsc --noEmit
- 单元测试：bun test
- 完整验证：./init.sh（含以上全部）
```

## 完成定义（Definition Of Done）

一个功能算完成，必须同时满足：

- 目标行为已实现
- 要求的验证**真的跑过**（不是"应该能过"）
- 证据记录在 `feature_list.json` 或 `progress.md` 里
- 仓库仍能从标准启动路径重启

## 会话收尾

结束会话前：

1. 更新 `progress.md`。
2. 更新 `feature_list.json`。
3. 记录未解决的风险或 blocker。
4. 工作处于安全状态时才 commit，commit message 说清楚做了什么。
5. 让仓库干净到下次会话能直接跑 `./init.sh` 开工。
