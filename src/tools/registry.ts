// src/tools/registry.ts — tool 注册表 + 通用类型
//
// DESIGN 原则（AGENTS.md §3）：
// - Tool 注册必须填齐 name / description / input_schema（zod）；缺一项即注册失败。
// - Registry 是 Map<string, ToolDef>；不放在模块顶层，调用方可独立构造一份用于测试。
// - dispatch(name, input) 找不到或 schema 不匹配时返回 ToolResult isError=true。

import { z } from "zod";
import type { ToolDescriptor } from "../llm.ts";

// ── tool 定义 ──────────────────────────────────────────────────────

export type ToolResult = {
  isError: boolean;
  output: string;
  /** 给 UI 看的简短摘要；长 output 时 REPL 只显示这个 */
  preview?: string;
  /** 字节截断标记，给 LLM 看的完整 output 用 output */
  outputTruncated?: number;
};

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
};

/** 工具被执行时的上下文（cwd 等，未来扩展） */
export type ToolContext = {
  cwd: string;
};

// 注册时校验
export function makeTool(args: {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: ToolDef["handler"];
}): ToolDef {
  if (!args.name || typeof args.name !== "string") {
    throw new Error("tool.name required");
  }
  if (!args.description || args.description.length < 8) {
    throw new Error(`tool.${args.name}.description too short: ${JSON.stringify(args.description)}`);
  }
  if (!args.inputSchema) {
    throw new Error(`tool.${args.name}.inputSchema required`);
  }
  return args;
}

// ── 注册表 ─────────────────────────────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(tool: ToolDef): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  /** 给 llm 层用的 schema 列表 */
  descriptors(): ToolDescriptor[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * 找到 + 校验 input + 执行。
   * 任何一步失败都返回 isError=true，让 loop 不抛错、能继续 turn。
   */
  async dispatch(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        isError: true,
        output: `unknown tool: ${name}. available: ${this.names().join(", ")}`,
      };
    }
    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        isError: true,
        output: `invalid input for ${name}: ${parsed.error.message}`,
      };
    }
    try {
      return await tool.handler(parsed.data as Record<string, unknown>, ctx);
    } catch (e) {
      return {
        isError: true,
        output: `tool ${name} threw: ${(e as Error).message}`,
      };
    }
  }
}
