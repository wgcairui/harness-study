#!/usr/bin/env bash

# 改编自 Learn Harness Engineering 课程模板（MIT License, © WalkingLab）
# https://walkinglabs.github.io/learn-harness-engineering/zh/resources/templates/
# 用法：换成你项目的三条命令，chmod +x init.sh，然后每次会话开工先跑它。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# ↓↓↓ 换成你项目的实际命令 ↓↓↓
INSTALL_CMD=(bun install)          # 依赖安装
VERIFY_CMD=(bunx tsc --noEmit)     # 基线验证（最低门槛）
START_CMD=(bun run examples/01_repo_qa.ts)  # 主程序/演示启动命令

echo "==> 工作目录: $PWD"
echo "==> 安装依赖"
"${INSTALL_CMD[@]}"

echo "==> 基线验证"
"${VERIFY_CMD[@]}"

echo "==> 启动命令"
printf '    %q' "${START_CMD[@]}"
printf '\n'

if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> 直接启动"
  exec "${START_CMD[@]}"
fi

echo "（设 RUN_START_COMMAND=1 可让本脚本直接启动）"
