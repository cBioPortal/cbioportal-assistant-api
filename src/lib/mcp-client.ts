import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { logger } from "./logger.js";
import { getMCPServers, type MCPServerConfig } from "./config.js";

export class MCPConnectionError extends Error {
  constructor(message: string, public details?: unknown) {
    super(`MCP Connection Error: ${message}`);
    this.name = "MCPConnectionError";
    Error.captureStackTrace(this, this.constructor);
  }
}

async function connectToServer(serverConfig: MCPServerConfig): Promise<MCPClient> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= serverConfig.retries + 1; attempt++) {
    try {
      const mcpClient = await createMCPClient({
        transport: {
          type: serverConfig.transport,
          url: serverConfig.url,
        },
      });

      logger.info("MCP client connected", {
        name: serverConfig.name,
        attempt,
      });

      return mcpClient;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`MCP connection attempt ${attempt} failed`, {
        server: serverConfig.name,
        error: lastError.message,
        willRetry: attempt < serverConfig.retries + 1,
      });

      if (attempt < serverConfig.retries + 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new MCPConnectionError(
    `[${serverConfig.name}] Failed to connect after ${serverConfig.retries + 1} attempts: ${lastError?.message}`,
    lastError
  );
}

/**
 * Connect to all configured MCP servers. Returns a map of server name → client.
 * Throws if no servers connect successfully.
 */
export async function initializeAllMCPClients(): Promise<Map<string, MCPClient>> {
  const servers = getMCPServers();
  const clients = new Map<string, MCPClient>();

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const client = await connectToServer(server);
      return { name: server.name, client };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      clients.set(result.value.name, result.value.client);
    } else {
      logger.warn("MCP server connection failed, skipping", {
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  return clients;
}

/**
 * Fetch tools from all connected clients, namespaced as `serverName__toolName`.
 */
export async function getAllMCPTools(clients: Map<string, MCPClient>): Promise<ToolSet> {
  const allTools: ToolSet = {};

  for (const [serverName, client] of clients) {
    try {
      const tools = await client.tools();
      for (const [toolName, toolDef] of Object.entries(tools)) {
        allTools[`${serverName}__${toolName}`] = toolDef;
      }
      logger.info("MCP tools fetched", {
        server: serverName,
        toolCount: Object.keys(tools).length,
      });
    } catch (error) {
      logger.warn("Failed to fetch tools from MCP server", {
        server: serverName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return allTools;
}

export async function closeAllMCPClients(clients: Map<string, MCPClient>): Promise<void> {
  for (const [name, client] of clients) {
    try {
      await client.close();
      logger.debug("MCP client closed", { server: name });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Failed to close MCP client gracefully", { server: name, error: message });
    }
  }
}

/**
 * Initializes all MCP servers and returns namespaced tools.
 * Gracefully degrades: failed servers are skipped, returns empty object if all fail.
 */
export async function getMCPToolsWithGracefulFallback(): Promise<ToolSet> {
  try {
    const clients = await initializeAllMCPClients();
    if (clients.size === 0) {
      logger.warn("No MCP servers connected, continuing without MCP tools");
      return {};
    }
    return await getAllMCPTools(clients);
  } catch (error) {
    logger.warn("MCP unavailable, continuing without MCP tools", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
