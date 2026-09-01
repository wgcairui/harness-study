// src/tools/grep.ts — 内容 grep
//
// 用 Bun.spawn 调系统 grep（如未装则降级到 node 自实现）。
// 返回每行命中：行号 + 文件 + 行内容。
// 限制：最多 100 条结果；自动跳过 node_modules / .git / dist。

import { spawn } from "bun";
import { z } from "zod";
import type { ToolContext, ToolDef, ToolResult } from "./registry.ts";
import { makeTool } from "./registry.ts";

const MAX_HITS = 100;
const SKIP_DIRS = ["--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=dist", "--exclude-dir=out"];

const inputSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  glob_filter: z.string().optional(),
  ignore_case: z.boolean().optional(),
});

export function grepTool(): ToolDef {
  return makeTool({
    name: "grep",
    description:
      "Regex-grep search across files. Returns matches as 'path:lineno: content'. " +
      "Skips node_modules, .git, dist. Limits to 100 hits.",
    inputSchema,
    async handler(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const pattern = String(input.pattern);
      const path = input.path ? String(input.path) : ctx.cwd;
      const globFilter = input.glob_filter ? String(input.glob_filter) : undefined;
      const ignoreCase = Boolean(input.ignore_case);

      const args = [
        "-nH",
        ...SKIP_DIRS,
        ...(ignoreCase ? ["-i"] : []),
        ...(globFilter ? [`--include=${globFilter}`] : []),
        "-E",
        "-e",
        pattern,
        path,
      ];

      let proc;
      try {
        proc = spawn({
          cmd: ["grep", ...args],
          stdout: "pipe",
          stderr: "pipe",
        });
      } catch (e) {
        return {
          isError: true,
          output: `failed to spawn grep: ${(e as Error).message}. Is grep installed?`,
        };
      }

      const out = await new Response(proc.stdout).text();
      const code = await proc.exited;
      if (code !== 0 && code !== 1) {
        // 1 = no matches, which is fine
        const errText = await new Response(proc.stderr).text();
        return { isError: true, output: `grep exited ${code}: ${errText.slice(0, 500)}` };
      }

      const lines = out.split("\n").filter(Boolean);
      if (lines.length === 0) {
        return { isError: false, output: "<no matches>" };
      }
      const truncated = lines.length > MAX_HITS;
      const keep = lines.slice(0, MAX_HITS);
      const body = keep.join("\n");
      return {
        isError: false,
        output: body,
        preview: truncated ? `<truncated at ${MAX_HITS} hits>` : undefined,
        outputTruncated: truncated ? MAX_HITS : undefined,
      };
    },
  });
}
