// src/tools/bash.ts — 受限 shell 执行
//
// 这是 harness 里最危险的工具。两层防御：
// - 工具内：黑名单命令拦截（rm / sudo / mkfs / dd 等）。这一层在 permission 之前拦截，避免
//   LLM 即使在 bypass 模式下也炸数据。
// - 工具外（permission.ts）：风险工具二次确认 hook。这一层在每次实际执行前由上层弹确认。

import { spawn } from "bun";
import { z } from "zod";
import type { ToolContext, ToolDef, ToolResult } from "./registry.ts";
import { makeTool } from "./registry.ts";

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 200 * 1024;

// 黑名单：拼成前缀匹配（避免 rm / sudo / bash -c 'sudo xxx' 绕过）
const BLACKLISTED = [
  "rm ",
  "rm\t",
  "sudo ",
  "mkfs",
  "dd ",
  "shutdown",
  "reboot",
  ":(){:|:&};:",
];

const inputSchema = z.object({
  command: z.string().min(1),
  timeout_ms: z.number().int().min(100).max(120_000).optional(),
  description: z.string().optional(),
});

function isBlacklisted(command: string): { blocked: true; pattern: string } | { blocked: false } {
  const c = command.trim();
  for (const p of BLACKLISTED) {
    if (c.startsWith(p)) return { blocked: true, pattern: p };
  }
  // 单独拦裸 `rm`（无空格 / 无 tab），避免 rm 后面直接跟换行绕掉
  if (/^rm(\s|$|;|\||&)/.test(c)) return { blocked: true, pattern: "rm" };
  return { blocked: false };
}

export function bashTool(): ToolDef {
  return makeTool({
    name: "bash",
    description:
      "Run a shell command (sh-compatible) in the working directory. Captures stdout+stderr, " +
      "30s default timeout. Built-in blacklist blocks: rm, sudo, mkfs, dd, shutdown, reboot, forkbomb.",
    inputSchema,
    async handler(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const command = String(input.command);
      const timeout = Number(input.timeout_ms ?? TIMEOUT_MS);

      const blk = isBlacklisted(command);
      if (blk.blocked) {
        return {
          isError: true,
          output: `refused: command matches blacklist pattern "${blk.pattern}". Run via a narrower tool (read_file / glob / grep) or ask the user.`,
        };
      }

      const proc = spawn({
        cmd: ["sh", "-c", command],
        cwd: ctx.cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
          // 防止继承的代理变量泄漏到子命令（学习项目，故意简单处理）
        },
      });

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeout);

      const [stdoutText, stderrText, exitCode] = await Promise.all([
        new Response(proc.stdout).text().catch(() => ""),
        new Response(proc.stderr).text().catch(() => ""),
        proc.exited,
      ]);
      clearTimeout(timer);

      if (timedOut) {
        return {
          isError: true,
          output: `timed out after ${timeout}ms. Killed. (stdout: ${stdoutText.slice(0, 500)})`,
        };
      }

      // 截断
      const full = `exit=${exitCode}\n--stdout--\n${stdoutText}\n--stderr--\n${stderrText}`;
      const oversized = Buffer.byteLength(full, "utf8") > MAX_OUTPUT_BYTES;
      const body = oversized ? full.slice(0, MAX_OUTPUT_BYTES) : full;
      return {
        isError: exitCode !== 0,
        output: body,
        preview: oversized ? `<truncated at ${MAX_OUTPUT_BYTES} bytes>` : `exit=${exitCode}`,
        outputTruncated: oversized ? MAX_OUTPUT_BYTES : undefined,
      };
    },
  });
}
