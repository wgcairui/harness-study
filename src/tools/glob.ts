// src/tools/glob.ts — 文件名 glob
//
// Bun 自带 Bun.Glob；优先用之，避免拉 micromatch。
// 限制：单次最多 200 条结果；skip node_modules / .git。

import { Glob } from "bun";
import { resolve, isAbsolute } from "node:path";
import { z } from "zod";
import type { ToolContext, ToolDef, ToolResult } from "./registry.ts";
import { makeTool } from "./registry.ts";

const MAX_ENTRIES = 200;

const inputSchema = z.object({
  pattern: z.string().min(1),
  cwd: z.string().optional(),
});

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "out", "coverage"]);

export function globTool(): ToolDef {
  return makeTool({
    name: "glob",
    description:
      "Find files matching a glob pattern (e.g. '**/*.ts', 'src/**/*.md'). " +
      "Skips node_modules, .git, dist, out, coverage. Returns up to 200 paths.",
    inputSchema,
    async handler(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const pattern = String(input.pattern);
      const cwd = isAbsolute(String(input.cwd ?? ""))
        ? String(input.cwd)
        : resolve(ctx.cwd, String(input.cwd ?? "."));

      const allFiles: string[] = [];
      const glob = new Glob(pattern);
      for await (const file of glob.scan({ cwd, dot: false })) {
        // 内置过滤：跳过命中 SKIP_DIRS 的路径
        const parts = file.split("/");
        if (parts.some((p) => SKIP_DIRS.has(p))) continue;
        allFiles.push(file);
        if (allFiles.length >= MAX_ENTRIES) break;
      }

      if (allFiles.length === 0) {
        return { isError: false, output: "<no matches>" };
      }
      const truncated = allFiles.length === MAX_ENTRIES;
      const body = allFiles.join("\n");
      return {
        isError: false,
        output: body,
        preview: truncated ? `<truncated at ${MAX_ENTRIES} entries>` : undefined,
        outputTruncated: truncated ? MAX_ENTRIES : undefined,
      };
    },
  });
}
