// src/repl.ts — stdio REPL：把 Event 流打字到 stdout；permission_ask 时 y/N
//
// 设计目标：能用即可；不追求花哨。
// - text_delta / tool_call_delta 直接打印
// - tool_call_done / tool_result 用括号注释显示，避免长行
// - permission_ask 阻塞读 stdin 一行 y/N
// - done 后退出

import { createInterface } from "node:readline";
import type { Event } from "./events.ts";
import type { AskFn } from "./permission.ts";

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export function subscribeStdio(emitter: { subscribe: (fn: (e: Event) => void) => () => void }): () => void {
  return emitter.subscribe((event) => {
    switch (event.type) {
      case "turn_start":
        process.stdout.write(`${C.dim}[turn ${event.turn}]${C.reset}\n`);
        break;
      case "text_delta":
        process.stdout.write(event.text);
        break;
      case "tool_call_start":
        process.stdout.write(`${C.cyan}\n→ ${event.toolName} (${event.toolCallId})${C.reset}\n`);
        break;
      case "tool_call_delta":
        // 拼装 JSON 增量，不打印（最后 tool_call_done 才打印）
        break;
      case "tool_call_done":
        process.stdout.write(`${C.dim}  args = ${JSON.stringify(event.input)}${C.reset}\n`);
        break;
      case "tool_result":
        {
          const tag = event.isError ? `${C.red}✗${C.reset}` : `${C.green}✓${C.reset}`;
          const preview = (event.output ?? "").split("\n").slice(0, 6).join("\n");
          const more =
            event.output && event.output.split("\n").length > 6 ? `${C.dim}\n  …(truncated for display)${C.reset}` : "";
          process.stdout.write(`  ${tag} ${preview}${more}\n`);
        }
        break;
      case "permission_ask":
        // REPL ask 不在这里处理；下面单独 readline
        break;
      case "permission_denied":
        process.stdout.write(`${C.yellow}  ⌥ permission denied for ${event.toolName}: ${event.reason}${C.reset}\n`);
        break;
      case "done":
        process.stdout.write(
          `\n${C.dim}[done after ${event.turns} turns: ${event.reason}]${C.reset}\n`,
        );
        break;
      case "error":
        process.stdout.write(`${C.red}  ⚠ error (turn ${event.turn}): ${event.message}${C.reset}\n`);
        break;
    }
  });
}

/**
 * stdio 的 ask hook：阻塞读 stdin 一行，y/yes 视为 allow，其他视为 deny。
 * 用 readline.createInterface 写一行。
 */
export function makeStdioAsk(): AskFn {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  const queue: ((ans: boolean) => void)[] = [];

  rl.on("line", (line) => {
    const next = queue.shift();
    if (next) next(/^y(es)?$/i.test(line.trim()));
  });
  rl.on("close", () => {
    while (queue.length) {
      const next = queue.shift()!;
      next(false);
    }
  });

  return ({ toolName, input, reason }) =>
    new Promise<boolean>((resolveAns) => {
      process.stderr.write(`${C.yellow}? ${toolName} (${reason}) — args=${JSON.stringify(input)} [y/N]: ${C.reset}`);
      queue.push(resolveAns);
    });
}
