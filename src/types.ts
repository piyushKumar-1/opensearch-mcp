import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult };

export function textResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `Error: ${message}`,
      },
    ],
    isError: true,
  };
}
