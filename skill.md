# elasticsearch-mcp

A standalone MCP (Model Context Protocol) server that provides **read-only** Elasticsearch/OpenSearch access over HTTPS with SSE and Streamable HTTP transports. Designed for safe data exploration by LLMs and AI clients.

## Tools

### `search`
Execute an Elasticsearch search query using Query DSL. Returns matching documents from the specified index.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | string | Yes | - | Index name or comma-separated list |
| `query` | object | Yes | - | Elasticsearch Query DSL (e.g., `{ "match": { "field": "value" } }`) |
| `size` | number (1-100) | No | 10 | Number of hits to return |
| `from` | number | No | 0 | Offset for pagination |
| `sort` | array | No | - | Sort criteria (e.g., `[{ "@timestamp": "desc" }]`) |
| `_source` | boolean or array | No | - | Source filtering |

### `list_indices`
List Elasticsearch indices with health, status, document count, and store size. Supports wildcard patterns.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `pattern` | string | No | `*` | Index pattern with wildcard support (e.g., `logs-*`) |
| `include_hidden` | boolean | No | false | Include hidden indices starting with `.` |

### `get_mapping`
Get the field mapping definitions for an Elasticsearch index. Shows field names, types, and analyzers.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | string | Yes | - | Index name or comma-separated list |

### `cluster_health`
Get the Elasticsearch cluster health status including node count, shard allocation, and index health.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `level` | enum: `cluster`, `indices`, `shards` | No | `cluster` | Detail level for health report |

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELASTICSEARCH_URL` | Yes | - | Elasticsearch cluster URL |
| `ELASTICSEARCH_API_KEY` | No | - | Base64-encoded API key for authentication |
| `ELASTICSEARCH_TLS_SKIP_VERIFY` | No | `false` | Skip TLS certificate validation |
| `PORT` | No | `3000` | Server listen port |
| `TLS_CERT_PATH` | No | - | Path to TLS certificate (enables HTTPS) |
| `TLS_KEY_PATH` | No | - | Path to TLS private key (enables HTTPS) |

## Transport Protocols

- **Streamable HTTP** (recommended): `POST /mcp` for new sessions and messages, `GET /mcp` for polling, `DELETE /mcp` to close sessions. Uses `mcp-session-id` header.
- **SSE** (legacy): `GET /sse` to initialize stream, `POST /messages?sessionId=<id>` for messages.
- **Health check**: `GET /health` returns `{ "status": "ok" }`.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Run with hot reload (tsx)
npm run build        # Compile TypeScript
npm start            # Run compiled server
npm run typecheck    # Type check without emitting
```

Requires Node.js >= 20.

## Tech Stack

- **Runtime**: TypeScript, Express, Zod
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.10.2
- **ES Client**: `@opensearch-project/opensearch` v3.5.1 (compatible with Elasticsearch)
- **Containerized**: Multi-stage Docker build (Alpine), CI/CD via GitHub Actions to GHCR
- **Kubernetes**: Deployment and Service manifests in `k8s/`
