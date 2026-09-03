---
layout: home
title: harness-study
hero:
  name: harness-study
  text: 从零学 agent harness
  tagline: 引擎侧（造 loop）+ 环境侧（给 loop 修路）双维度渐进教程
  actions:
    - theme: brand
      text: 开始学习（路线总览）
      link: /ROADMAP.html
    - theme: alt
      text: 前沿拆解
      link: /FRONTIER-HARNESS.html
    - theme: alt
      text: 五子系统实操
      link: /ENVIRONMENT-HARNESS.html
features:
  - icon: 🧭
    title: 一条路线，两个维度
    details: 引擎侧亲手造七层 loop（events / llm / tools / permission / prompt / loop / repl），环境侧给仓库装五子系统（指令 / 工具 / 环境 / 状态 / 反馈）。两条都走通，才能对任意 agent 产品做审计。
  - icon: 📚
    title: 按阶段阅读清单
    details: 每阶段标了要读什么、要做什么、怎么算过。文档里所有 42 个外链都做过内容级通读核对，没有凭空转述。
  - icon: 🛠️
    title: 吃自己的狗粮
    details: 本仓库用 init.sh + feature_list.json + progress.md 把环境侧方法论自己装了一遍——读源码能直接对照五子系统落地的真实样子。
---

## 当前进度

| 阶段 | 主题 | 状态 |
| --- | --- | --- |
| 0 | 看见问题：为什么强模型不可靠 | 待办 |
| 1 | 造引擎：七层 loop | 七层 ✓ / 单元测试待补（`test-001`） |
| 2 | 造环境：五子系统工件 | 本 repo 已示范 |
| 3 | 验证与可观测 | 待办 |
| 4 | 循环工程 | 待办 |
| 5 | 图工程与前沿对齐 | 待办 |

完整路线与各阶段验收标准见 [ROADMAP](/ROADMAP)。

## 学习路径怎么选

- **新人**（从零跟学）：[ROADMAP](/ROADMAP) → 按阶段走，每阶段都有读什么/做什么/验收。
- **只想读懂引擎**（老手快进）：根目录 README（[GitHub](https://github.com/wgcairui/harness-study#readme)）→ DESIGN.md → `src/` 七层。
- **想学环境侧**：[ENVIRONMENT-HARNESS](/ENVIRONMENT-HARNESS)（含本 repo 的五子系统自审计）→ [`templates/` 拿模板装进你自己的项目](https://github.com/wgcairui/harness-study/tree/main/templates)。
