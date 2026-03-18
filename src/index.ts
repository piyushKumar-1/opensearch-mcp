import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server.js";

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// CORS – required for browser-based and cross-origin MCP clients
// (Cursor, Claude Desktop via mcp-remote, browser extensions, etc.)
// ---------------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  next();
});

app.options("*", (_req, res) => {
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Shared transport store keyed by session ID.
// Both SSE (legacy) and Streamable HTTP sessions live here so we can detect
// transport-type mismatches when a session ID arrives on the wrong endpoint.
// ---------------------------------------------------------------------------
const transports: Record<
  string,
  SSEServerTransport | StreamableHTTPServerTransport
> = {};

// ============================================================================
//  STREAMABLE HTTP TRANSPORT  –  protocol version 2025-03-26
//  Single endpoint: /mcp   Methods: POST, GET, DELETE
// ============================================================================
app.all("/mcp", async (req: Request, res: Response) => {
  // --- Method guard ---
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.status(405).set("Allow", "GET, POST, DELETE").end();
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    // ---- POST: client → server messages ----------------------------------
    if (req.method === "POST") {
      if (sessionId) {
        // Existing session
        const existing = transports[sessionId];
        if (
          !existing ||
          !(existing instanceof StreamableHTTPServerTransport)
        ) {
          res.status(404).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Session not found" },
            id: null,
          });
          return;
        }
        await existing.handleRequest(req, res, req.body);
        return;
      }

      // No session ID – must be an initialize request
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      // Create a new Streamable HTTP transport + MCP server
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          console.log(`Streamable HTTP session initialized: ${id}`);
          transports[id] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Streamable HTTP session closed: ${sid}`);
          delete transports[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // ---- GET: open SSE stream for server → client messages ---------------
    if (req.method === "GET") {
      if (!sessionId) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Missing Mcp-Session-Id header" },
          id: null,
        });
        return;
      }

      const existing = transports[sessionId];
      if (
        !existing ||
        !(existing instanceof StreamableHTTPServerTransport)
      ) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: null,
        });
        return;
      }

      await existing.handleRequest(req, res);
      return;
    }

    // ---- DELETE: terminate session ---------------------------------------
    if (req.method === "DELETE") {
      if (!sessionId) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Missing Mcp-Session-Id header" },
          id: null,
        });
        return;
      }

      const existing = transports[sessionId];
      if (
        !existing ||
        !(existing instanceof StreamableHTTPServerTransport)
      ) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: null,
        });
        return;
      }

      await existing.handleRequest(req, res);
      return;
    }
  } catch (err) {
    console.error(`Error handling ${req.method} /mcp:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// ============================================================================
//  LEGACY SSE TRANSPORT  –  protocol version 2024-11-05
//  GET  /sse       → establish SSE stream, receive `endpoint` event
//  POST /messages  → send JSON-RPC messages (sessionId in query string)
//
//  NOTE: some clients (mcp-remote, etc.) use an "http-first" strategy and
//  POST to /sse first.  If that happens we return 405 so they fall back to
//  the standard GET flow.
// ============================================================================
app.get("/sse", async (_req: Request, res: Response) => {
  console.log("New SSE connection request");

  try {
    const transport = new SSEServerTransport("/messages", res);
    const server = createServer();

    transports[transport.sessionId] = transport;

    res.on("close", () => {
      console.log(`SSE session ${transport.sessionId} closed`);
      delete transports[transport.sessionId];
      server.close();
    });

    await server.connect(transport);
    console.log(`SSE session established: ${transport.sessionId}`);
  } catch (err) {
    console.error("Error establishing SSE connection:", err);
    if (!res.headersSent) {
      res.status(500).end("Failed to establish SSE stream");
    }
  }
});

// Clients doing "http-first" will POST to /sse expecting Streamable HTTP.
// Return 405 so they fall back to GET (the standard SSE flow).
app.post("/sse", (_req: Request, res: Response) => {
  res.status(405).set("Allow", "GET").end();
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Missing sessionId query parameter" },
      id: null,
    });
    return;
  }

  const existing = transports[sessionId];

  if (!existing || !(existing instanceof SSEServerTransport)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: Session exists but uses a different transport protocol",
      },
      id: null,
    });
    return;
  }

  try {
    // Pass req.body so the SDK does not try to re-read the already-consumed
    // request stream (Express's json() middleware already parsed it).
    await existing.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error("Error handling SSE message:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
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
} else {
  httpServer = http.createServer(app);
}

httpServer.listen(port, () => {
  const scheme = certPath ? "https" : "http";
  console.log(`MCP server listening on ${scheme}://0.0.0.0:${port}`);
  console.log("");
  console.log("Supported transports:");
  console.log("  1. Streamable HTTP (2025-03-26)");
  console.log("     POST|GET|DELETE /mcp");
  console.log("  2. HTTP+SSE (2024-11-05, legacy)");
  console.log("     GET /sse  →  POST /messages?sessionId=<id>");
  console.log("");
  console.log("  Health: GET /health");
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown() {
  console.log("Shutting down...");
  for (const id of Object.keys(transports)) {
    try {
      transports[id].close();
    } catch {
      // best-effort
    }
    delete transports[id];
  }
  httpServer.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
