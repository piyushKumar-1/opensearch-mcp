import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// SSE transport sessions (legacy: GET /sse + POST /messages)
// ---------------------------------------------------------------------------
const sseSessions = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createServer();

  sseSessions.set(transport.sessionId, transport);

  res.on("close", () => {
    sseSessions.delete(transport.sessionId);
    server.close();
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sseSessions.get(sessionId);

  if (!transport) {
    res.status(400).json({ error: "Invalid or expired session ID" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

// ---------------------------------------------------------------------------
// Streamable HTTP transport (works behind ALB / any reverse proxy)
// Handles POST /mcp, GET /mcp, DELETE /mcp
// ---------------------------------------------------------------------------
const streamableSessions = new Map<string, { transport: StreamableHTTPServerTransport; server: ReturnType<typeof createServer> }>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session – route the message
  if (sessionId) {
    const entry = streamableSessions.get(sessionId);
    if (!entry) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await entry.transport.handleRequest(req, res, req.body);
    return;
  }

  // New session – create transport + MCP server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createServer();
  await server.connect(transport);

  // handleRequest processes the initialize request and sets sessionId
  await transport.handleRequest(req, res, req.body);

  if (transport.sessionId) {
    streamableSessions.set(transport.sessionId, { transport, server });
  }

  transport.onclose = () => {
    if (transport.sessionId) {
      streamableSessions.delete(transport.sessionId);
    }
    server.close();
  };
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const entry = sessionId ? streamableSessions.get(sessionId) : undefined;

  if (!entry) {
    res.status(400).json({ error: "Invalid or missing session" });
    return;
  }

  await entry.transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const entry = sessionId ? streamableSessions.get(sessionId) : undefined;

  if (!entry) {
    res.status(400).json({ error: "Invalid or missing session" });
    return;
  }

  await entry.transport.handleRequest(req, res);
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT || "3000", 10);
const certPath = process.env.TLS_CERT_PATH;
const keyPath = process.env.TLS_KEY_PATH;

let httpServer: http.Server | https.Server;

if (certPath && keyPath) {
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  httpServer = https.createServer({ cert, key }, app);
  httpServer.listen(port, () => {
    console.log(`MCP server listening on https://0.0.0.0:${port}`);
    console.log(`Streamable HTTP endpoint: /mcp`);
    console.log(`SSE endpoint: /sse`);
  });
} else {
  httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    console.log(`MCP server listening on http://0.0.0.0:${port}`);
    console.log(`Streamable HTTP endpoint: /mcp`);
    console.log(`SSE endpoint: /sse`);
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown() {
  console.log("Shutting down...");
  for (const transport of sseSessions.values()) {
    transport.close();
  }
  sseSessions.clear();
  for (const { transport, server } of streamableSessions.values()) {
    transport.close();
    server.close();
  }
  streamableSessions.clear();
  httpServer.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
