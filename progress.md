# 进度日志

> 结构采用课程模板（templates/progress.md）。开工先读本文件，收尾前更新——这是 L05/L12 教的状态子系统。

## 当前已验证状态

- 仓库根目录：`~/Code/harness-study`
- 标准启动路径：`./init.sh`（装依赖 → `bunx tsc --noEmit` → `bun test` → 打印 demo 命令）
- 标准验证路径：`./init.sh` 或 `bunx tsc --noEmit && bun test`
- 当前最高优先级未完成功能：`test-001` 补齐单元测试（见 feature_list.json）
- 当前 blocker：`smoke-001` demo 真机 smoke——plan key 绑 ZCode 网关直调 401，需直连 Anthropic key

## 会话记录

### 会话 001（2026-09-01，Wk 1）

- 本轮目标：起项目骨架 + 起草文档 + 完成七层引擎 + 跑通 demo
- 已完成：全部完成——骨架、6 份文档、Layer 1-7、demo 代码 `examples/01_repo_qa.ts`
- 运行过的验证：`bunx tsc --noEmit` 通过；**`bun test` 未跑（无测试文件——learning-plan 承诺的单测没写，登记为 `test-001`）**；demo 真机未跑通
- 已记录证据：见下表各层 commit + feature_list.json evidence 字段
- 已知风险或未解决问题：401（见 blocker）；单测缺口（见 test-001）

**逐层记录**（计划 vs 实际）：

| layer | 计划 | 实际 | commit | 偏差原因 |
| --- | --- | --- | --- | --- |
| 0 | docs 骨架 | 完成 | (docs commit) | — |
| 1 | events.ts | 完成 | c6a90a6 | — |
| 2 | llm.ts | 完成 | dd1e891 | — |
| 3 | tools/* | 完成 | 02e1102 | type-check 撞到 Bun GlobScanOptions 没有 follow 字段；删掉 |
| 4 | permission | 完成 | 457d8be | — |
| 5 | prompt | 完成 | 2ff710d | strict regexp 在 TS 上出现 `string \| undefined`，加 None 拦截 |
| 6 | loop | 完成 | 17d40fe | — |
| 7 | repl + index | 完成 | adb88b9 | — |
| 8 | demo + smoke | 代码完成，smoke blocked | — | 401（见 blocker），代码路径 type-check 通过 |

**本轮决策记录**：

- 用 Bun + 直接打 `@anthropic-ai/sdk`，不依赖 `@anthropic-ai/claude-code` SDK。后者把循环包死，看不到点子上。
- provider 选 Anthropic-compatible `bigmodel-start-plan`（GLM-5 / glm-5-turbo，baseURL `https://zcode.z.ai/api/v1/zcode-plan/anthropic`）。凭据从环境变量读，不读 ~/.zcode 凭据 — 学习项目要和生产配置隔离。
- `bun init` 默认生成 `CLAUDE.md`；重命名为 `AGENTS.md` 与 ZCode 项目级协议对齐。
- Zod 4.5 与 Anthropic SDK 0.122 都用最新；zod 3 写过的代码要避免直接拷过来。

### 会话 002（2026-09-03）

- 本轮目标：文档重构——按 Learn Harness Engineering 课程方法论，把项目改造成"个人学习 + 新人渐进教程"双身份
- 已完成：
  - 新增 `docs/` 四篇：ROADMAP（阶段 0-5 总课程表）、REFERENCES（按阶段阅读清单）、FRONTIER-HARNESS（四产品拆解 → 七层映射）、ENVIRONMENT-HARNESS（五子系统实操）
  - 新增 `templates/` 七件（改编自课程模板，MIT 署名）
  - 自装环境侧工件：根目录 `init.sh` + `feature_list.json`（诚实状态：`test-001` not_started / `smoke-001` blocked）
  - 重写 README（双身份 + 路线总览）；AGENTS.md 加开工流程 + 验证命令段；learning-plan 加定位头
- 运行过的验证：`bunx tsc --noEmit` 通过；`bash init.sh` 基线验证通过
- 已记录证据：本 commit；feature_list.json `docs-001`
- 已知风险或未解决问题：五子系统审计发现的问题（无验证命令段 / 无 init.sh / progress.md 假待办行 / 单测缺口）已在本轮修复或登记，详见 docs/ENVIRONMENT-HARNESS.md
- 下一步最佳动作：`test-001` 补齐七层单元测试（llm 流累积 / tools happy+fail / permission 拦截 / prompt 四段）

### 会话 003（2026-09-03）

- 本轮目标：应用户要求，把文档里全部 42 个外链从"可达性验证"升级为"内容级通读"，并据此补全文档
- 已完成：
  - walkinglabs 14 篇讲义 + 3 个项目页（P01/P07/P08）+ 4 篇前沿拆解 + 7 模板 + 3 内部参考，全部在本地克隆中通读
  - 10 篇外部文章经子代理全文抓取核对（Addy / Fowler / shareAI-lab / LangChain ×2 / Stripe / Cursor / Anthropic ×2 / OpenAI ×3）
  - 修正转述失真 5 处：Addy 文章无"四种沉默成本"（系 L13 归纳）；LangChain Deep Agents 无 Terminal Bench 名次；Stripe Minions 无 blueprints（在 Part 2）；LangChain context 是 offload 非 truncation；"repo as source of truth" 主体是 docs/ 而非 AGENTS.md
  - 日期回修：OpenAI 三篇以页面正文日期为准（2026-02-11 / 2026-01-23 / 2026-02-04）——会话 002 按 meta publishedTime 改成 2026-08 是误判
  - ROADMAP 各阶段充入通读所得硬细节：L03 五问测试、L05 重建成本 3 分钟、L07 WIP=1、L08 三元组、L09 三层终止检查、L10 错误消息三要素、L11 双层可观测、L12 五条件、L13 三要素 + 成熟度阶梯、L14 五判据 + 三种结构性失败
- 运行过的验证：`bunx tsc --noEmit` 通过（本轮只动文档）；`grep` 确认无不可见字符混入
- 已记录证据：本 commit；docs/REFERENCES.md 底部核对状态注记
- 已知风险或未解决问题：外部文章后续可能改版，简介以核对当日为准
- 下一步最佳动作：`test-001` 补齐单元测试（不变）

### 会话 004（2026-09-03）

- 本轮目标：把学习文档发布到 GitHub Pages，平板浏览器可读
- 已完成：
  - 新增 VitePress 1.6.4 依赖（devDeps）+ `docs:dev` / `docs:build` / `docs:preview` 三个 scripts
  - 新增 `docs/.vitepress/config.mts`（base = `/harness-study/`，暗色/亮色自动、侧边栏按章节折叠、顶栏 GitHub 链接）
  - 新增 `docs/index.md` 首页（hero + features 三段 + 当前进度表 + 路径选择）
  - 新增 `docs/public/favicon.svg`（橙色方块上的 h）
  - 新增 `.github/workflows/docs.yml`：push to main → bun install → docs:build → 上传 artifacts → deploy to Pages
  - 修正 docs/ROADMAP.md 与 docs/ENVIRONMENT-HARNESS.md 中 9 处跨目录相对链接（templates/、learning-plan.md）——这些是上一轮我自己写的 `../templates/...`，VitePress 不识别，已改为 GitHub 绝对路径，两套渲染器（GitHub Markdown / VitePress）都正常
- 运行过的验证：`bun run docs:build` 通过（0 警告 0 死链）；`bun run docs:preview` 起本地服务，curl 6 个核心 URL 全部 200（含暗色/亮色样式表资源）
- 已记录证据：本次 commit；本会话段
- 已知风险或未解决问题：**用户在 GitHub 仓库 Settings → Pages → Source 必须手动选 "GitHub Actions" 才会启用**（这是 GitHub 安全策略，workflow 没法替你打开）。启用后 push 才会自动部署。
- 下一步最佳动作：`test-001` 补齐单元测试（不变）
- 一次性手动步骤：合并本 PR 后去 https://github.com/wgcairui/harness-study/settings/pages 把 Source 设为 "GitHub Actions"，几分钟后 https://wgcairui.github.io/harness-study/ 即可访问

### 状态卫生注记

会话 001 的旧版 progress.md 表格里残留 6 行假"待办"（layers 2-7 实际已完成却仍标待办）——
这正是课程 L05 说的状态腐化：下次会话读到假信号就会重做已完成的工作。会话 002 重写时删除。
教训：**收尾时不更新状态 = 给下个会话埋雷**（clean-state-checklist 的第 4 条就是防这个）。
