// src/prompt.ts — system prompt 拼装
//
// 4 段固定结构：
//   1. role + working dir
//   2. 硬约束（不能做的事 + 必须做的事）
//   3. tool 描述块（每个 tool 的 name + description + input_schema 摘要）
//   4. skills frontmatter 列表（最小演示用）
//
// 严禁拼接网络内容进 system prompt。
//
// AGENTS.md frontmatter 解析：用一行很简单的 yaml-ish front-matter splitter，
// 仅识别 --- 起头的 key:value 对，避免依赖 yaml 包。失败时退回到空 skills 列表。

import type { ToolDescriptor } from "./llm.ts";
import type { z } from "zod";

// ── AGENTS.md / SKILL.md frontmatter 解析（最小实现） ───────────────

export type SkillFrontmatter = {
  name: string;
  description: string;
  /** raw 行，只取已识别的几对 key:value */
  raw: Record<string, string>;
};

export function parseFrontmatter(text: string): SkillFrontmatter | null {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m || !m[1]) return null;
  const body = m[1];
  const raw: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv || !kv[1] || kv[2] === undefined) continue;
    const key = kv[1];
    let val: string = kv[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    raw[key] = val;
  }
  const name = raw["name"] ?? "";
  const description = raw["description"] ?? "";
  return { name, description, raw };
}

// ── skill 装载：只接受本地 AGENTS.md / SKILL.md，绝对不取网络 ───

export async function loadSkills(paths: string[]): Promise<SkillFrontmatter[]> {
  const skills: SkillFrontmatter[] = [];
  for (const p of paths) {
    try {
      const txt = await Bun.file(p).text();
      const fm = parseFrontmatter(txt);
      if (fm && fm.name) skills.push(fm);
    } catch {
      // 缺失时静默跳过；skill 是渐进增强
    }
  }
  return skills;
}

// ── tool 描述块 ────────────────────────────────────────────────────

/**
 * 不打印完整 JSON Schema（太大），只打印 name + description + 字段级 description。
 * 字段 description 用 zod 字段上的 .describe() 注入。
 */
export function renderTools(tools: ToolDescriptor[]): string {
  return tools
    .map((t) => {
      const lines = [`- ${t.name}: ${t.description}`];
      const def = (t.inputSchema as unknown as { _def?: { shape?: Record<string, z.ZodTypeAny>; description?: string } })._def;
      if (def?.shape) {
        const fields: string[] = [];
        for (const [k, v] of Object.entries(def.shape)) {
          const fdesc = (v as unknown as { _def?: { description?: string } })._def?.description;
          if (fdesc) fields.push(`${k}: ${fdesc}`);
        }
        if (fields.length) {
          lines.push("  args: " + fields.join("; "));
        }
      }
      return lines.join("\n");
    })
    .join("\n");
}

// ── 主入口 ───────────────────────────────────────────────────────

export type BuildPromptArgs = {
  role: string;
  cwd: string;
  tools: ToolDescriptor[];
  skills: SkillFrontmatter[];
  /** 自由补充，调用方可塞日期、用户名等 */
  extras?: string[];
};

export function buildSystemPrompt(args: BuildPromptArgs): string {
  const sections: string[] = [];

  sections.push(
    `# Role\n${args.role}\n\nWorking directory: ${args.cwd}`,
  );

  sections.push(
    `# Hard rules\n` +
      `- Tool calls must go through the registered tools; do not bypass.\n` +
      `- You may not invent file paths; if a file is missing, report it.\n` +
      `- Prefer narrow tools (read_file / glob / grep) before bash.\n` +
      `- If a tool returns an error, read it and adjust — don't retry blindly.\n` +
      `- Output should be concise. Do not narrate tool calls; the harness displays them.`,
  );

  sections.push(`# Available tools\n${renderTools(args.tools)}`);

  if (args.skills.length) {
    const blocks = args.skills
      .map((s) => `- ${s.name}: ${s.description || "(no description)"}`)
      .join("\n");
    sections.push(`# Skills\n${blocks}`);
  }

  if (args.extras?.length) {
    sections.push(`# Extras\n${args.extras.join("\n")}`);
  }

  return sections.join("\n\n");
}
