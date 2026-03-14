import { z } from "zod";
import type { Client } from "@opensearch-project/opensearch";
import type { CallToolResult } from "../types.js";
import { textResult, errorResult } from "../types.js";

export const getMappingParams = {
  index: z
    .string()
    .describe(
      "The index name (or comma-separated index names) to get mappings for"
    ),
};

export async function handleGetMapping(
  client: Client,
  params: { index: string }
): Promise<CallToolResult> {
  try {
    const { body } = await client.indices.getMapping({
      index: params.index,
    });

    return textResult(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Failed to get mapping: ${message}`);
  }
}
