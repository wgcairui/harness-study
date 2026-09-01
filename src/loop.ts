// src/loop.ts — 状态机：把 events / llm / tools / permission / prompt 缝起来
//
// 5 个不变式（AGENTS.md §3 / DESIGN.md）：
// 1. 每条 tool 都经过 permission.decide() 才 dispatch
// 2. tool_result 必须回灌进 messages，否则 LLM 下一次不知道发生了什么
// 3. end_turn / max_turns / error 是 3 个合法 stop reason
// 4. events 是单向的；不允许外部写 messages（除了回灌 tool_result）
// 5. 不在这里读 fs；任何文件副作用只能走 tool

import type { Anthropic } from "@anthropic-ai/sdk";
import { Emitter } from "./events.ts";
import { streamChat } from "./llm.ts";
import type { PermissionContext } from "./permission.ts";
import { buildSystemPrompt } from "./prompt.ts";
import type { ToolRegistry } from "./tools/registry.ts";

export type RunAgentOpts = {
  cwd: string;
  model: string;
  system: string;
  registry: ToolRegistry;
  permission: { decide(name: string, input: Record<string, unknown>): Promise<{ kind: "allow" | "ask" | "deny"; reason?: string }>; ctx: PermissionContext };
  maxTurns?: number;
  signal?: AbortSignal;
  /** 初始 user message */
  prompt: string;
};

export type RunAgentResult = {
  turns: number;
  /** 最后一轮的 assistant 文本（end_turn 后才有意义） */
  finalText: string;
  /** 全部 messages（含 tool_result 回灌）— 仅供调试或 hook 调试用 */
  messages: Anthropic.Messages.MessageParam[];
  stopReason: "end_turn" | "max_turns" | "error";
  error?: string;
};

export async function runAgent(opts: RunAgentOpts): Promise<RunAgentResult> {
  const emitter = new Emitter();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: opts.prompt },
  ];
  const maxTurns = opts.maxTurns ?? Number(process.env.HARNESS_MAX_TURNS ?? 8);
  const tools = opts.registry.descriptors();

  let finalText = "";
  let stopReason: RunAgentResult["stopReason"] = "max_turns";
  let turns = 0;

  for (let i = 0; i < maxTurns; i++) {
    turns = i + 1;
    const { turn } = await streamChat(emitter, turns, {
      model: opts.model,
      system: opts.system,
      messages,
      tools,
      signal: opts.signal,
    });

    // 把 assistant turn 推回 messages（含 text + tool_use 块）
    const assistantContent: Anthropic.Messages.ContentBlockParam[] = [];
    for (const b of turn.contentBlocks) {
      if (b.kind === "text") {
        finalText = b.text;
        assistantContent.push({ type: "text", text: b.text });
      } else {
        assistantContent.push({
          type: "tool_use",
          id: b.id,
          name: b.name,
          input: b.input,
        });
      }
    }
    messages.push({ role: "assistant", content: assistantContent });

    // 没有 tool_use → end_turn
    if (turn.toolCalls.length === 0) {
      stopReason = "end_turn";
      emitter.emit({ type: "done", turns, reason: "end_turn", finalText });
      break;
    }

    // 工具调用循环：每个 call 都先 permission，再 dispatch
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const call of turn.toolCalls) {
      const decision = await opts.permission.decide(call.name, { ...call.input, __callId: call.id });
      if (decision.kind === "deny") {
        const msg = decision.reason ?? "permission denied";
        emitter.emit({
          type: "tool_result",
          turn: turns,
          toolCallId: call.id,
          toolName: call.name,
          isError: true,
          output: msg,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content: msg,
        });
        continue;
      }

      const result = await opts.registry.dispatch(call.name, call.input, { cwd: opts.cwd });
      emitter.emit({
        type: "tool_result",
        turn: turns,
        toolCallId: call.id,
        toolName: call.name,
        isError: result.isError,
        output: result.output,
        outputTruncated: result.outputTruncated,
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        is_error: result.isError,
        content: result.output,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // runAgent 自己 buildSystemPrompt 不是这层的职责（解耦 prompt.ts）
  // 之所以这里签名要传 system：tools 全在调用方；组装权交还调用方更清晰。
  if (turns >= maxTurns && stopReason === "max_turns") {
    emitter.emit({ type: "done", turns, reason: "max_turns", finalText });
  }

  return { turns, finalText, messages, stopReason };
}

// 辅助：从一份 registry + 装入 opts 中拼出 system prompt
export async function buildSystem(opts: {
  cwd: string;
  registry: ToolRegistry;
  skillPaths?: string[];
}): Promise<string> {
  const { loadSkills } = await import("./prompt.ts");
  const skills = await loadSkills(opts.skillPaths ?? []);
  return buildSystemPrompt({
    role: "You are a precise coding agent inside a learning harness. Prefer narrow tools.",
    cwd: opts.cwd,
    tools: opts.registry.descriptors(),
    skills,
  });
}
