import { z } from "zod";
import type { Client } from "@opensearch-project/opensearch";
import type { CallToolResult } from "../types.js";
import { textResult, errorResult } from "../types.js";

export const clusterHealthParams = {
  level: z
    .enum(["cluster", "indices", "shards"])
    .default("cluster")
    .describe(
      "Detail level: 'cluster' (summary), 'indices' (per-index), or 'shards' (per-shard)"
    ),
};

export async function handleClusterHealth(
  client: Client,
  params: { level: "cluster" | "indices" | "shards" }
): Promise<CallToolResult> {
  try {
    const { body } = await client.cluster.health({
      level: params.level,
    });

    return textResult(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Failed to get cluster health: ${message}`);
  }
}
