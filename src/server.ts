import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createElasticsearchClient } from "./elasticsearch.js";
import { searchParams, handleSearch } from "./tools/search.js";
import {
  listIndicesParams,
  handleListIndices,
} from "./tools/list-indices.js";
import { getMappingParams, handleGetMapping } from "./tools/get-mapping.js";
import {
  clusterHealthParams,
  handleClusterHealth,
} from "./tools/cluster-health.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "elasticsearch-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  server.tool(
    "search",
    "Execute an Elasticsearch search query using Query DSL. Returns matching documents from the specified index.",
    searchParams,
    async (params) => {
      const client = createElasticsearchClient();
      return handleSearch(client, params);
    }
  );

  server.tool(
    "list_indices",
    "List Elasticsearch indices with health, status, document count, and store size. Supports wildcard patterns.",
    listIndicesParams,
    async (params) => {
      const client = createElasticsearchClient();
      return handleListIndices(client, params);
    }
  );

  server.tool(
    "get_mapping",
    "Get the field mapping definitions for an Elasticsearch index. Shows field names, types, and analyzers.",
    getMappingParams,
    async (params) => {
      const client = createElasticsearchClient();
      return handleGetMapping(client, params);
    }
  );

  server.tool(
    "cluster_health",
    "Get the Elasticsearch cluster health status including node count, shard allocation, and index health.",
    clusterHealthParams,
    async (params) => {
      const client = createElasticsearchClient();
      return handleClusterHealth(client, params);
    }
  );

  return server;
}
