// examples/01_repo_qa.ts — 把 harness 跑起来的最简示例
//
// 这个 demo 期望 LLM 自己选 tool 串起来回答：
//   1) glob 找 README* — read_file
//   2) read_file 读 README 回答第一问
//   3) grep 在 src/loop.ts 里搜 import 列模块名 — 回答第二问
//
// 跑法：
//   cp .env.example .env.local  # 编辑 ANTHROPIC_API_KEY 等
//   bun run examples/01_repo_qa.ts

import { resolve } from "node:path";
import { Emitter } from "../src/events.ts";
import { buildSystem, runAgent } from "../src/loop.ts";
import { makePermission } from "../src/permission.ts";
import { subscribeStdio } from "../src/repl.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { readFileTool } from "../src/tools/read_file.ts";
import { globTool } from "../src/tools/glob.ts";
import { grepTool } from "../src/tools/grep.ts";
import { bashTool } from "../src/tools/bash.ts";

const cwd = resolve(import.meta.dir, "..");

const registry = new ToolRegistry();
registry.register(readFileTool());
registry.register(globTool());
registry.register(grepTool());
registry.register(bashTool());

const emitter = new Emitter();
subscribeStdio(emitter);

// 非 REPL 模式：bash 会被 ask；示例用 bypassPermissions 跳过确认，纯走 read-only 工具。
const ask = async () => false;

const system = await buildSystem({
  cwd,
  registry,
  skillPaths: [resolve(cwd, "AGENTS.md")],
});

const permission = makePermission({
  emitter,
  mode: "default",
  allowedTools: ["read_file", "glob", "grep"], // demo 故意不放 bash，让用户看见 ask 路径
  ask,
});

const result = await runAgent({
  cwd,
  model: process.env.HARNESS_MODEL ?? "GLM-5",
  system,
  registry,
  permission,
  prompt:
    "Look at this project's README: list which package managers and runtimes it supports. " +
    "Then grep src/loop.ts for the modules it imports and list them as a bullet list.",
});

console.log("\n=== stopReason =", result.stopReason, "turns =", result.turns, "===");
if (result.stopReason === "error") {
  console.error("error:", result.error);
  process.exit(1);
}
