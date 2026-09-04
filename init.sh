#!/usr/bin/env bash

# harness-study 自己的标准启动与验证路径（harness = 方法论的第一个使用者）。
# 课程模板见 templates/init.sh；这里按本 repo 实际情况实例化。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

INSTALL_CMD=(bun install)
# bun run auto-loads .env only; this project's docs reference .env.local,
# so pass it explicitly. No-op if the file is absent.
START_CMD=(bun --env-file-if-exists=.env.local run examples/01_repo_qa.ts)

echo "==> 工作目录: $PWD"
echo "==> 安装依赖"
"${INSTALL_CMD[@]}"

echo "==> 基线验证"
echo "---- 类型检查 ----"
bunx tsc --noEmit
echo "---- 单元测试 ----"
# 无测试文件时 bun test 退出码为 1；有则真跑（缺口 = feature_list 的 test-001）
if find src examples -name "*.test.ts" -o -name "*.spec.ts" | grep -q .; then
  bun test
else
  echo "（暂无测试文件，跳过。缺口见 feature_list.json 的 test-001）"
fi

echo "==> 演示命令（需 .env.local 配直连 Anthropic key）"
printf '    %q' "${START_CMD[@]}"
printf '\n'

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> 直接启动 demo"
  exec "${START_CMD[@]}"
fi

echo "（设 RUN_START_COMMAND=1 可让本脚本直接启动 demo）"
