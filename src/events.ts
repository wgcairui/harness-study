// src/events.ts — harness ↔ UI 事件流
//
// 所有后续层都向订阅者 emit 这套事件。REPL / 未来的 TUI 都直接 subscribe 即可，
// 不需要再写 N 套接口。
//
// 事件流向是单向的：harness → emit → UI；不允许 UI 回调改 messages。

// ── 文本流（assistant 文本）─────────────────────────────────────────

export type TextDeltaEvent = {
  type: "text_delta";
  /** 当前 turn 的 id，用于 UI 把同一段文本连续打到同一行 */
  turn: number;
  text: string;
};

export type TextDoneEvent = {
  type: "text_done";
  turn: number;
  /** 累积到本 turn 结束时，assistant 完整输出的文本 */
  text: string;
};

// ── tool 调用流（assistant 决定调 tool 时）───────────────────────────

export type ToolCallStartEvent = {
  type: "tool_call_start";
  turn: number;
  toolCallId: string;
  toolName: string;
};

export type ToolCallDeltaEvent = {
  type: "tool_call_delta";
  turn: number;
  toolCallId: string;
  /** Anthropic SDK 流上名叫 input_json_delta，是 tool 输入 JSON 的增量片段 */
  partialJson: string;
};

export type ToolCallDoneEvent = {
  type: "tool_call_done";
  turn: number;
  toolCallId: string;
  toolName: string;
  /** 累积到这一步已经完整的 tool input（已 parse） */
  input: Record<string, unknown>;
};

// ── tool 实际执行结果（dispatch 之后）───────────────────────────────

export type ToolResultEvent = {
  type: "tool_result";
  turn: number;
  toolCallId: string;
  toolName: string;
  /** 是否成功 */
  isError: boolean;
  /** 给 LLM 看的字符串结果；过大时 REPL 层只打预览 */
  output: string;
  /** 可选：截断的字节数；-1 表示未截断 */
  outputTruncated?: number;
};

// ── permission 层在 loop 里抛出的拦截事件 ──────────────────────────

export type PermissionAskEvent = {
  type: "permission_ask";
  turn: number;
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
};

export type PermissionDeniedEvent = {
  type: "permission_denied";
  turn: number;
  toolCallId: string;
  toolName: string;
  reason: string;
};

// ── 顶层 turn 边界 + 终止事件 ──────────────────────────────────────

export type TurnStartEvent = {
  type: "turn_start";
  turn: number;
};

export type DoneEvent = {
  type: "done";
  turns: number;
  /** "end_turn" / "max_turns" / "error" */
  reason: "end_turn" | "max_turns" | "error";
  finalText: string;
};

export type ErrorEvent = {
  type: "error";
  turn: number;
  message: string;
};

// ── discriminated union + Emitter ──────────────────────────────────

export type Event =
  | TextDeltaEvent
  | TextDoneEvent
  | ToolCallStartEvent
  | ToolCallDeltaEvent
  | ToolCallDoneEvent
  | ToolResultEvent
  | PermissionAskEvent
  | PermissionDeniedEvent
  | TurnStartEvent
  | DoneEvent
  | ErrorEvent;

export type Subscriber = (event: Event) => void;

export class Emitter {
  private subscribers = new Set<Subscriber>();

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /** 同步派发；REPL 同步打印；将来上 TUI 时这里改成微任务派发即可 */
  emit(event: Event): void {
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch (err) {
        // 单个订阅者抛错不能击穿其他订阅者
        console.error("[emitter] subscriber threw:", err);
      }
    }
  }

  /** 装一个最大缓冲队列；测试 / 离线分析时用 */
  record(): { stop: () => void; events: Event[] } {
    const events: Event[] = [];
    const unsub = this.subscribe((e) => events.push(e));
    return { stop: unsub, events };
  }
}
