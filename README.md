# elasticsearch-mcp

A standalone MCP (Model Context Protocol) server that provides **read-only** access to Elasticsearch and OpenSearch clusters. Supports HTTPS, SSE, and Streamable HTTP transports.

Designed for safe data exploration by LLMs and AI clients — no write or delete operations are exposed.

## Features

- **Read-only** — only exposes search, mappings, index listing, and cluster health
- **Dual transport** — Streamable HTTP (`/mcp`) and SSE (`/sse`)
- **HTTPS/TLS** — optional TLS termination at the server
- **Elasticsearch & OpenSearch** — works with both
- **Containerized** — multi-stage Docker build, Kubernetes manifests included
- **CI/CD** — GitHub Actions workflow for automated image builds to GHCR

## Tools

| Tool | Description |
|------|-------------|
| `search` | Execute queries using Elasticsearch Query DSL |
| `list_indices` | List indices with health, doc count, and store size |
| `get_mapping` | Get field mapping definitions for an index |
| `cluster_health` | Get cluster health status and metrics |

### search

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | string | Yes | Index name or comma-separated list |
| `query` | object | Yes | Elasticsearch Query DSL |
| `size` | number | No | Max hits, 1–100 (default 10) |
| `from` | number | No | Pagination offset (default 0) |
| `sort` | array | No | Sort criteria, e.g. `[{ "@timestamp": "desc" }]` |
| `_source` | boolean \| array | No | Source field filtering |

### list_indices

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | No | Index wildcard pattern (default `*`) |
| `include_hidden` | boolean | No | Include hidden `.` indices (default false) |

### get_mapping

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | string | Yes | Index name or comma-separated list |

### cluster_health

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `level` | enum | No | `cluster`, `indices`, or `shards` (default `cluster`) |

## Configuration

All configuration is via environment variables. See `.env.example` for a template.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELASTICSEARCH_URL` | Yes | — | Elasticsearch/OpenSearch URL |
| `ELASTICSEARCH_API_KEY` | No | — | Base64-encoded API key |
| `ELASTICSEARCH_TLS_SKIP_VERIFY` | No | `false` | Skip TLS cert verification |
| `PORT` | No | `3000` | Server listen port |
| `TLS_CERT_PATH` | No | — | Path to TLS certificate (enables HTTPS) |
| `TLS_KEY_PATH` | No | — | Path to TLS private key (enables HTTPS) |

## Quick Start

### Prerequisites

- Node.js >= 20

### Run locally

```bash
npm install
cp .env.example .env   # edit with your cluster details
npm run dev             # development with hot reload
```

### Build and run for production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t elasticsearch-mcp .

docker run -p 3000:3000 \
  -e ELASTICSEARCH_URL=https://your-cluster:9243 \
  -e ELASTICSEARCH_API_KEY=your-base64-key \
  elasticsearch-mcp
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | Streamable HTTP — send messages (new session or existing via `mcp-session-id` header) |
| `GET` | `/mcp` | Streamable HTTP — receive messages (requires `mcp-session-id` header) |
| `DELETE` | `/mcp` | Streamable HTTP — close session |
| `GET` | `/sse` | SSE — initiate event stream |
| `POST` | `/messages?sessionId=<id>` | SSE — send messages to session |
| `GET` | `/health` | Health check (`{ "status": "ok" }`) |

## Kubernetes

Manifests are in `k8s/`. The deployment targets the `monitoring` namespace with liveness/readiness probes on `/health`.

```bash
kubectl apply -f k8s/
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with hot reload (tsx) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check without emitting |

## Project Structure

```
src/
  index.ts             # Express server, transport setup, TLS
  server.ts            # MCP server creation, tool registration
  elasticsearch.ts     # Elasticsearch/OpenSearch client factory
  types.ts             # Type definitions and result helpers
  tools/
    search.ts          # search tool
    list-indices.ts    # list_indices tool
    get-mapping.ts     # get_mapping tool
    cluster-health.ts  # cluster_health tool
k8s/
  deployment.yaml      # Kubernetes Deployment
  service.yaml         # Kubernetes Service
```

## License

MIT
