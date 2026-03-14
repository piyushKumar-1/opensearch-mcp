import { z } from "zod";
import type { Client } from "@opensearch-project/opensearch";
import type { CallToolResult } from "../types.js";
import { textResult, errorResult } from "../types.js";

export const listIndicesParams = {
  pattern: z
    .string()
    .default("*")
    .describe(
      "Index name pattern with wildcard support (default '*'). Example: 'logs-*'"
    ),
  include_hidden: z
    .boolean()
    .default(false)
    .describe(
      "Whether to include hidden indices (those starting with '.')"
    ),
};

export async function handleListIndices(
  client: Client,
  params: { pattern: string; include_hidden: boolean }
): Promise<CallToolResult> {
  try {
    const { body } = await client.cat.indices({
      index: params.pattern,
      format: "json",
      h: ["index", "health", "status", "docs.count", "store.size", "pri", "rep"],
      expand_wildcards: params.include_hidden ? "all" : "open",
    });

    const indices = (body as Array<Record<string, string>>).map(
      (idx) => ({
        index: idx.index,
        health: idx.health,
        status: idx.status,
        docs_count: idx["docs.count"],
        store_size: idx["store.size"],
        primary_shards: idx.pri,
        replica_shards: idx.rep,
      })
    );

    return textResult({
      total: indices.length,
      indices,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Failed to list indices: ${message}`);
  }
}
