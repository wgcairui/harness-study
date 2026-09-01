// src/tools/read_file.ts — 受限文件读取
//
// 规则：
// - 路径必须是绝对路径，或者 ctx.cwd 下的相对路径
// - 默认 limit=2000 行、offset=0；不允许读大文件全量
// - 二进制文件直接报错（isError）
// - 自动限制单次返回字节数（300KB），超出标 outputTruncated

import { z } from "zod";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import type { ToolContext, ToolDef, ToolResult } from "./registry.ts";
import { makeTool } from "./registry.ts";

const MAX_BYTES = 300 * 1024;

const inputSchema = z.object({
  file_path: z.string().min(1),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(10_000).optional(),
});

export function readFileTool(): ToolDef {
  return makeTool({
    name: "read_file",
    description:
      "Read a file by absolute path, or a path relative to the working directory. " +
      "Returns the file content with line numbers. Supports offset (0-based line) and limit.",
    inputSchema,
    async handler(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
      const filePath = String(input.file_path);
      const offset = (input.offset as number | undefined) ?? 0;
      const limit = (input.limit as number | undefined) ?? 2000;
      const abs = resolve(ctx.cwd, filePath);

      let st;
      try {
        st = await stat(abs);
      } catch (e) {
        return { isError: true, output: `cannot stat ${abs}: ${(e as Error).message}` };
      }
      if (!st.isFile()) {
        return { isError: true, output: `not a regular file: ${abs}` };
      }

      // 粗检 binary：读前 4 个 byte 是否出现 NUL
      const head = await readHead(abs, 4);
      if (head.includes(0)) {
        return { isError: true, output: `binary file refused: ${abs}` };
      }

      const startLine = offset;
      const endLine = offset + limit;
      let lineNo = 0;
      let bytes = 0;
      const out: string[] = [];
      let truncated = false;
      await new Promise<void>((resolveDone, rejectDone) => {
        const rs = createReadStream(abs, { encoding: "utf8" });
        rs.on("data", (chunk) => {
          const text = chunk as string;
          for (const line of text.split("\n")) {
            if (lineNo >= endLine) {
              truncated = true;
              rs.destroy();
              return;
            }
            if (lineNo >= startLine) {
              out.push(`${lineNo + 1}\t${line}`);
              bytes += Buffer.byteLength(line, "utf8") + 1;
              if (bytes > MAX_BYTES) {
                truncated = true;
                rs.destroy();
                return;
              }
            }
            lineNo += 1;
          }
        });
        rs.on("end", () => resolveDone());
        rs.on("close", () => resolveDone());
        rs.on("error", (e) => rejectDone(e));
      });

      const body = out.join("\n");
      if (truncated) {
        return {
          isError: false,
          output: body,
          preview: `<truncated to ${MAX_BYTES} bytes at line ${lineNo}>`,
          outputTruncated: MAX_BYTES,
        };
      }
      return { isError: false, output: body || "<empty>" };
    },
  });
}

async function readHead(path: string, n: number): Promise<Buffer> {
  return await new Promise<Buffer>((res, rej) => {
    const buf: Buffer[] = [];
    const rs = createReadStream(path, { start: 0, end: n - 1 });
    rs.on("data", (c) => buf.push(c as Buffer));
    rs.on("end", () => res(Buffer.concat(buf)));
    rs.on("error", rej);
  });
}
