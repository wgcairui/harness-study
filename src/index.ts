// src/index.ts — CLI 入口：拼 5 层 + 跑 demo
//
// 用法：
//   bun run src/index.ts --prompt "list src files"
//   bun run src/index.ts --mode default --allow read_file,glob,grep,bash --prompt "..."

import { resolve } from "node:path";
import { Emitter } from "./events.ts";
import { buildSystem, runAgent } from "./loop.ts";
import { makePermission, type PermissionMode } from "./permission.ts";
import { subscribeStdio, makeStdioAsk } from "./repl.ts";
import { ToolRegistry } from "./tools/registry.ts";
import { readFileTool } from "./tools/read_file.ts";
import { globTool } from "./tools/glob.ts";
import { grepTool } from "./tools/grep.ts";
import { bashTool } from "./tools/bash.ts";

const DEFAULT_ALLOWED = ["read_file", "glob", "grep", "bash"];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function main() {
  const prompt = arg("--prompt");
  if (!prompt) {
    console.error(
      "usage: bun run src/index.ts --prompt <text> [--allow t1,t2] [--mode default|acceptEdits|bypassPermissions] [--cwd <dir>] [--skills <path1,path2>]",
    );
    process.exit(2);
  }

  const mode = (arg("--mode", "default") ?? "default") as PermissionMode;
  const allowStr = arg("--allow", DEFAULT_ALLOWED.join(","));
  const allowedTools = allowStr!.split(",").map((s) => s.trim()).filter(Boolean);
  const cwd = resolve(arg("--cwd", process.cwd()) ?? process.cwd());
  const skillsArg = arg("--skills", "");
  const skillPaths = skillsArg ? skillsArg.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const registry = new ToolRegistry();
  registry.register(readFileTool());
  registry.register(globTool());
  registry.register(grepTool());
  registry.register(bashTool());

  const emitter = new Emitter();
  subscribeStdio(emitter);

  (async () => {
    const system = await buildSystem({ cwd, registry, skillPaths });
    const ask = mode === "default" ? makeStdioAsk() : async () => true;
    const permission = makePermission({ emitter, mode, allowedTools, ask });

    const result = await runAgent({
      cwd,
      model: process.env.HARNESS_MODEL ?? "GLM-5",
      system,
      registry,
      permission,
      prompt,
    });

    if (result.stopReason === "error") {
      console.error(result.error);
      process.exit(1);
    }
    process.exit(0);
  })().catch((e) => {
    console.error("[main] crashed:", e);
    process.exit(1);
  });
}

main();
