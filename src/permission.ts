// src/permission.ts — allowedTools 白名单 + 风险工具二次确认
//
// 所有 tool 调用必须经 `decide()` 这一个出口；loop 不允许直接 dispatch。
//
// 三种模式（对应 Claude Code SDK 的 permissionMode）：
//   "default"         — 白名单内跳过确认；bash 等 RISKY_TOOLS 自动 ask
//   "acceptEdits"     — RISKY_TOOLS 也跳过确认（学习项目内 demo 用）
//   "bypassPermissions" — 不拦截；用于 CI / 自动化
//
// ask hook 是可注入的：REPL 注入交互式 ask；examples / tests 注入 mock。

import type { Emitter } from "./events.ts";

// 哪些工具属于"风险" — 本项目里只有 bash；后续加入 write_file / edit_file 时
// 直接在这里 append。
const RISKY_TOOLS = new Set(["bash"]);

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export type AskFn = (event: {
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
}) => Promise<boolean>;

export type Decision =
  | { kind: "allow" }
  | { kind: "ask"; reason: string }
  | { kind: "deny"; reason: string };

export type PermissionContext = {
  mode: PermissionMode;
  allowedTools: ReadonlySet<string>;
};

export function makePermission(opts: {
  emitter: Emitter;
  mode: PermissionMode;
  allowedTools: string[];
  ask: AskFn;
}) {
  const ctx: PermissionContext = {
    mode: opts.mode,
    allowedTools: new Set(opts.allowedTools),
  };

  return {
    ctx,

    /**
     * 唯一决策入口。return 之前 emit 事件；REPL 据此做 UX。
     */
    async decide(toolName: string, input: Record<string, unknown>): Promise<Decision> {
      // 1) 白名单 — 不在白名单直接 deny
      if (!ctx.allowedTools.has(toolName)) {
        const reason = `tool "${toolName}" is not in allowedTools (${[...ctx.allowedTools].join(", ") || "<empty>"})`;
        opts.emitter.emit({
          type: "permission_denied",
          turn: -1,
          toolCallId: input.__callId as string ?? "?",
          toolName,
          reason,
        });
        return { kind: "deny", reason };
      }

      // 2) bypass — 全过
      if (ctx.mode === "bypassPermissions") {
        return { kind: "allow" };
      }

      // 3) acceptEdits — 跳过风险 ask
      if (ctx.mode === "acceptEdits") {
        return { kind: "allow" };
      }

      // 4) default：风险工具 ask
      if (RISKY_TOOLS.has(toolName)) {
        const reason = `${toolName} is a risky tool (mode=default)`;
        opts.emitter.emit({
          type: "permission_ask",
          turn: -1,
          toolCallId: input.__callId as string ?? "?",
          toolName,
          input,
          reason,
        });
        const ok = await opts.ask({ toolName, input, reason });
        if (!ok) {
          opts.emitter.emit({
            type: "permission_denied",
            turn: -1,
            toolCallId: input.__callId as string ?? "?",
            toolName,
            reason: "user declined",
          });
          return { kind: "deny", reason: "user declined" };
        }
      }

      return { kind: "allow" };
    },
  };
}
