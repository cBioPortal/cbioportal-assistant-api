import { Router } from "express";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { getBedrockClient } from "../lib/bedrock.js";
import { getMCPToolsWithGracefulFallback } from "../lib/mcp-client.js";
import { clientTools } from "../lib/tools.js";
import { getModelsConfig, getAppConfig } from "../lib/config.js";
import { ValidationError } from "../lib/error-handler.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/chat", async (req, res, next) => {
  try {
    const { messages }: { messages: UIMessage[] } = req.body;
    const { maxMessageLength, maxMessages } = getAppConfig().api;

    // Validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ValidationError("messages array is required and must not be empty");
    }
    if (messages.length > maxMessages) {
      throw new ValidationError(`Maximum ${maxMessages} messages allowed`);
    }

    // Validate message content length
    for (const message of messages) {
      let contentLength = 0;
      if ("parts" in message && Array.isArray(message.parts)) {
        contentLength = message.parts.reduce((acc, part: any) => {
          if (part?.type === "text" && typeof part.text === "string") {
            return acc + part.text.length;
          }
          return acc;
        }, 0);
      }
      if (contentLength > maxMessageLength) {
        throw new ValidationError(
          `Message content too long: maximum ${maxMessageLength} characters per message`
        );
      }
    }

    logger.info("Processing chat request", { messageCount: messages.length });

    // Load tools (MCP + client-side)
    const mcpTools = await getMCPToolsWithGracefulFallback();
    const allTools = { ...clientTools, ...mcpTools };

    // Stream response
    const bedrock = await getBedrockClient();
    const modelsConfig = getModelsConfig();
    const modelId = modelsConfig.bedrock.modelId;
    const reasoningEnabled = modelsConfig.bedrock.reasoningConfig.enabled;
    const budgetTokens = modelsConfig.bedrock.reasoningConfig.budgetTokens;

    const result = streamText({
      model: bedrock(modelId),
      messages: await convertToModelMessages(messages, { tools: allTools }),
      tools: allTools,
      ...(reasoningEnabled && {
        providerOptions: {
          bedrock: {
            reasoningConfig: { type: "enabled", budgetTokens },
          },
        },
      }),
      onFinish: ({ usage }) => {
        logger.info("Chat completed", { usage });
      },
    });

    result.pipeUIMessageStreamToResponse(res);
  } catch (error) {
    next(error);
  }
});

export default router;
