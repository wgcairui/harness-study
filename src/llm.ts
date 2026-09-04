// src/llm.ts — Anthropic Messages API 流式客户端
//
// 这一层把"模型是怎么被调用的"封死。loop 层只需要：
//   for await (const turn of streamChat({ messages, system, tools })) {
//     if (turn.toolCalls.length) dispatch(turn.toolCalls);
//   }
//
// 设计原则（DESIGN.md）：
// - 不在这一层处理 permission / dispatch
// - 不在这一层处理 messages 持久化
// - 所有 SDK 字段（content blocks、input_json_delta）都先归一化成自有的
//   ToolCallDelta / AssistantTurn，再 emit 到 events。

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Emitter, Event } from "./events.ts";

// ── 类型：跨越 SDK 边界时用我们自有的类型 ────────────────────────────

export type ToolDescriptor = {
  name: string;
  description: string;
  /** zod schema，loop/prompt 渲染 description 时用它 */
  inputSchema: z.ZodTypeAny;
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AssistantTurn = {
  /** turn 内全部 content blocks（含 text + tool_use），按 SDK 原顺序 */
  contentBlocks: Array<
    | { kind: "text"; text: string }
    | { kind: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  /** 拼接出的纯文本，方便上层 end_turn 后直接 render */
  text: string;
  toolCalls: ToolCall[];
  stopReason: string | null;
  /** tokens 来自 SDK 的 usage；非生产用途，仅为学习可见 */
  inputTokens: number;
  outputTokens: number;
};

export type StreamChatParams = {
  model: string;
  system: string;
  messages: Anthropic.Messages.MessageParam[];
  tools: ToolDescriptor[];
  maxTokens?: number;
  signal?: AbortSignal;
};

// ── 凭据校验 ─────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `missing env var ${name}. Copy .env.example to .env.local and set ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / HARNESS_MODEL.`,
    );
  }
  return v;
}

export function makeClient(): Anthropic {
  return new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
}

// ── zod → Anthropic input_schema 转换（只支持 JSON Schema 子集）───

/**
 * 把 zod schema 的形状翻译成 Anthropic 期望的 JSON Schema 结构。
 *
 * Anthropic 接收 `tools[i].input_schema = { type: 'object', properties: {...}, required: [...] }`。
 * 我们手动生成这一结构，避免依赖 `zod-to-json-schema`（npm 上各家版本差距很大）。
 *
 * 不支持 union / refine / transform 等高级类型 —— 这是学习项目，按需扩展。
 */
export function zodToInputSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // zod 4 用 `_def.typeName === 'ZodObject'`；用 `def.type` 也行。
  // 优先用 internal `z.toJSONSchema`（zod 4 自带），回退到手动展开。
  // 这里采用 zod 自带 toJSONSchema（zod 4.5 有）。
  try {
    const fn = (z as unknown as { toJSONSchema?: (s: z.ZodTypeAny) => unknown }).toJSONSchema;
    if (typeof fn === "function") {
      const out = fn(schema) as Record<string, unknown>;
      // Anthropic 需要 `type: 'object'` 顶层；剥掉 `$schema` 等保留字段
      delete (out as { $schema?: unknown }).$schema;
      return out;
    }
  } catch {
    // fall through to manual fallback
  }

  // 兜底：只认 ZodObject
  const def = (schema as unknown as { _def?: { typeName?: string; shape?: Record<string, z.ZodTypeAny> } })._def;
  if (def?.typeName !== "ZodObject") {
    throw new Error("only ZodObject is supported without z.toJSONSchema");
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [k, v] of Object.entries(def.shape ?? {})) {
    properties[k] = zodFieldToJSON(v);
    if (!isOptional(v)) required.push(k);
  }
  return { type: "object", properties, required };
}

function isOptional(s: z.ZodTypeAny): boolean {
  const def = (s as unknown as { _def?: { typeName?: string; innerType?: z.ZodTypeAny } })._def;
  if (def?.typeName === "ZodOptional" || def?.typeName === "ZodDefault") return true;
  return false;
}

function zodFieldToJSON(s: z.ZodTypeAny): Record<string, unknown> {
  const def = (s as unknown as { _def?: { typeName?: string; innerType?: z.ZodTypeAny; description?: string } })._def;
  const desc = def?.description;
  const out: Record<string, unknown> = {};
  if (desc) out.description = desc;
  switch (def?.typeName) {
    case "ZodString":
      out.type = "string";
      break;
    case "ZodNumber":
      out.type = "number";
      break;
    case "ZodBoolean":
      out.type = "boolean";
      break;
    case "ZodArray": {
      out.type = "array";
      const inner = zodFieldToJSON(def.innerType ?? (s as unknown as z.ZodTypeAny));
      out.items = inner;
      break;
    }
    case "ZodOptional":
    case "ZodDefault":
      return zodFieldToJSON(def.innerType ?? (s as unknown as z.ZodTypeAny));
    case "ZodObject":
      out.type = "object";
      return out;
    default:
      out.type = "string";
  }
  return out;
}

// ── 把 ToolDescriptor[] 喂给 SDK ────────────────────────────────────

function toSdkTools(tools: ToolDescriptor[]): Anthropic.Messages.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToInputSchema(t.inputSchema) as Anthropic.Messages.Tool.InputSchema,
  }));
}

// ── streamChat：单 turn 的流式调用 ─────────────────────────────────
//
// Anthropic 的 MessageStream 事件不是 async iterator friendly（事件触发快、
// finalMessage() 会等待 stream 结束），但 on() API 已经够用。我们 wrap 出：
//   - emit text_delta / tool_call_start / tool_call_delta
//   - 把累积结果返回成 AssistantTurn 让 loop 层处理。
//
// GLM-5 / MiniMax-M3 走的是 Anthropic 兼容协议；少数字段（如 stopReason）
// 与标准 Anthropic 略不同，本层按"结果为空就是 end_turn"兜底，避免
// 上层对 vendor 假设。

export type StreamChatResult = {
  turn: AssistantTurn;
  events: Event[];
};

/**
 * 决定一条 input_json_delta 应该归属到哪个 tool_use 块。
 * Anthropic 官方 SDK 总是先发 content_block_start 再发 input_json_delta，
 * 但 MiniMax / GLM-5 这类 Anthropic 兼容实现的顺序可能错位。
 *
 * 兜底策略：取最后一个还没收尾（末尾不是 `}`）的 tool_use 块；
 * 如果没有就取最后一个已知的 tool_use 块。返回 null 表示当前没有
 * 任何 tool_use 块在累积——直接丢弃这条 delta（防御性，正常不会发生）。
 */
function pickOwnerId(
  _stream: unknown,
  partialInputs: Map<string, string>,
  blockMeta: Map<string, { name: string }>,
): string | null {
  if (blockMeta.size === 0) return null;
  // 1. 优先：JSON 还没收尾的最后一块
  let lastOpen: string | null = null;
  for (const [id, json] of partialInputs) {
    if (blockMeta.has(id) && !json.trimEnd().endsWith("}")) {
      lastOpen = id;
    }
  }
  if (lastOpen !== null) return lastOpen;
  // 2. 兜底：blockMeta 里最后注册的那块（按 Map 插入顺序）
  let last: string | null = null;
  for (const id of blockMeta.keys()) last = id;
  return last;
}

export async function streamChat(
  emitter: Emitter,
  turnNumber: number,
  params: StreamChatParams,
): Promise<StreamChatResult> {
  const client = makeClient();
  const events: Event[] = [];

  emitter.emit({ type: "turn_start", turn: turnNumber });
  events.push({ type: "turn_start", turn: turnNumber });

  const stream = client.messages.stream(
    {
      model: params.model,
      max_tokens: params.maxTokens ?? 8192,
      system: params.system,
      messages: params.messages,
      tools: toSdkTools(params.tools),
    },
    params.signal ? { signal: params.signal } : {},
  );

  const toolCalls: ToolCall[] = [];
  // 按 blockId 分别累积 input JSON。Anthropic 兼容实现（MiniMax / GLM-5）
  // 不保证 contentBlock 事件早于 inputJson 事件到达，所以不能用单一全局
  // currentToolJson；多个 tool_use 块并发时也会互相覆盖。
  const partialInputs = new Map<string, string>();
  const blockMeta = new Map<string, { name: string }>();

  let text = "";

  const flushTurnEvents = (e: Event) => {
    events.push(e);
    emitter.emit(e);
  };

  stream.on("text", (delta) => {
    text += delta;
    flushTurnEvents({ type: "text_delta", turn: turnNumber, text: delta });
  });

  stream.on("inputJson", (partialJson) => {
    // SDK 文档说 input_json_delta 总是紧跟在它所属的 content_block_start 之后，
    // 但部分 provider 不严格遵循；用最近的 tool_use 作为兜底归属。
    const ownerId = pickOwnerId(stream, partialInputs, blockMeta);
    if (ownerId === null) return;
    partialInputs.set(ownerId, (partialInputs.get(ownerId) ?? "") + partialJson);
    flushTurnEvents({
      type: "tool_call_delta",
      turn: turnNumber,
      toolCallId: ownerId,
      partialJson,
    });
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use") {
      blockMeta.set(block.id, { name: block.name });
      // 不要在这里清空 partialInputs——inputJson 可能已经先到了，
      // 重置会把已累积的 JSON 丢掉。
      flushTurnEvents({
        type: "tool_call_start",
        turn: turnNumber,
        toolCallId: block.id,
        toolName: block.name,
      });
    }
  });

  // SDK 流结束或完成后，从 finalMessage 取完整 content blocks 与 usage
  const final = await stream.finalMessage().catch((e) => {
    flushTurnEvents({
      type: "error",
      turn: turnNumber,
      message: `stream failed: ${(e as Error).message}`,
    });
    throw e;
  });

  // 把累积到的 tool_use 输入 JSON parse 成对象，并固化为 toolCalls
  const contentBlocks: AssistantTurn["contentBlocks"] = [];
  for (const block of final.content) {
    if (block.type === "text") {
      contentBlocks.push({ kind: "text", text: block.text });
    } else if (block.type === "tool_use") {
      let parsed: Record<string, unknown> = {};
      const accumulated = partialInputs.get(block.id);
      if (accumulated && accumulated.length > 0) {
        try {
          parsed = JSON.parse(accumulated) as Record<string, unknown>;
        } catch {
          // 累积 JSON 损坏时回落到 SDK 提供的 input
          parsed = (block.input ?? {}) as Record<string, unknown>;
        }
      } else if (block.input && Object.keys(block.input).length > 0) {
        // 没有累积到任何 partial（罕见，例如 server-side-only 流），
        // 直接用 SDK 解析好的 input
        parsed = block.input as Record<string, unknown>;
      }
      const call: ToolCall = { id: block.id, name: block.name, input: parsed };
      toolCalls.push(call);
      contentBlocks.push({ kind: "tool_use", id: block.id, name: block.name, input: parsed });
      flushTurnEvents({
        type: "tool_call_done",
        turn: turnNumber,
        toolCallId: block.id,
        toolName: block.name,
        input: parsed,
      });
    }
  }

  flushTurnEvents({ type: "text_done", turn: turnNumber, text });

  return {
    turn: {
      contentBlocks,
      text,
      toolCalls,
      stopReason: final.stop_reason ?? null,
      inputTokens: final.usage?.input_tokens ?? 0,
      outputTokens: final.usage?.output_tokens ?? 0,
    },
    events,
  };
}
