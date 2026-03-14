import { z } from "zod";
import type { Client } from "@opensearch-project/opensearch";
import type { CallToolResult } from "../types.js";
import { textResult, errorResult } from "../types.js";

export const searchParams = {
  index: z
    .string()
    .describe(
      "The Elasticsearch index (or comma-separated indices) to search"
    ),
  query: z
    .record(z.unknown())
    .describe(
      "Elasticsearch Query DSL object (e.g., { match: { field: 'value' } })"
    ),
  size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of hits to return (1-100, default 10)"),
  from: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default 0)"),
  sort: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Sort criteria array (e.g., [{ '@timestamp': 'desc' }])"),
  _source: z
    .union([z.boolean(), z.array(z.string())])
    .optional()
    .describe(
      "Source filtering: boolean or array of field names to include"
    ),
};

export async function handleSearch(
  client: Client,
  params: {
    index: string;
    query: Record<string, unknown>;
    size: number;
    from: number;
    sort?: Record<string, unknown>[];
    _source?: boolean | string[];
  }
): Promise<CallToolResult> {
  try {
    const { body } = await client.search({
      index: params.index,
      body: {
        query: params.query,
        size: params.size,
        from: params.from,
        sort: params.sort,
        _source: params._source,
      },
    });

    return textResult({
      took: body.took,
      timed_out: body.timed_out,
      total:
        typeof body.hits.total === "number"
          ? body.hits.total
          : body.hits.total?.value,
      hits: body.hits.hits.map((hit: any) => ({
        _index: hit._index,
        _id: hit._id,
        _score: hit._score,
        _source: hit._source,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Search failed: ${message}`);
  }
}
