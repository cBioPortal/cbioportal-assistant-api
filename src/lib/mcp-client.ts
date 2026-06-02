import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import { logger } from "./logger.js";
import { getPrimaryMCPServer, getSecrets } from "./config.js";

export class MCPConnectionError extends Error {
  constructor(message: string, public details?: unknown) {
    super(`MCP Connection Error: ${message}`);
    this.name = "MCPConnectionError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export async function initializeMCPClient(): Promise<MCPClient> {
  const serverConfig = getPrimaryMCPServer();
  const secrets = getSecrets();
  const authToken = secrets.mcpServerAuthToken;

  logger.debug("Initializing MCP client", {
    name: serverConfig.name,
    url: serverConfig.url,
    transport: serverConfig.transport,
    hasAuth: !!authToken,
  });

  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= serverConfig.retries + 1; attempt++) {
    try {
      const mcpClient = await createMCPClient({
        transport: {
          type: serverConfig.transport,
          url: serverConfig.url,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
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
        error: lastError.message,
        willRetry: attempt < serverConfig.retries + 1,
      });

      if (attempt < serverConfig.retries + 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new MCPConnectionError(
    `Failed to connect after ${serverConfig.retries + 1} attempts: ${lastError?.message}`,
    lastError
  );
}

export async function getMCPTools(client: MCPClient): Promise<ToolSet> {
  logger.debug("Fetching MCP tools");
  const tools = await client.tools();
  logger.info("MCP tools fetched", { toolCount: Object.keys(tools).length });
  return tools;
}

export async function closeMCPClient(client: MCPClient): Promise<void> {
  try {
    await client.close();
    logger.debug("MCP client closed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Failed to close MCP client gracefully", { error: message });
  }
}

/**
 * Initializes MCP and returns tools, or empty object on failure (graceful degradation).
 */
export async function getMCPToolsWithGracefulFallback(): Promise<ToolSet> {
  try {
    const client = await initializeMCPClient();
    const tools = await getMCPTools(client);
    return tools;
  } catch (error) {
    logger.warn("MCP unavailable, continuing without MCP tools", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
