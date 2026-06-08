import { z } from "zod";
import * as yaml from "js-yaml";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger.js";
import { ConfigurationError } from "./error-handler.js";

// ============================================================================
// Zod Schemas
// ============================================================================

const AWSConfigSchema = z.object({
  region: z.string().min(1),
});

const MCPServerConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  transport: z.enum(["http", "sse"]).default("http"),
  timeout: z.number().min(1000).max(300000).default(30000),
  retries: z.number().min(0).max(5).default(2),
});

const MCPConfigSchema = z.object({
  enabled: z.boolean(),
  servers: z.array(MCPServerConfigSchema).min(1),
});

const BedrockModelConfigSchema = z.object({
  modelId: z.string().min(1),
  reasoningConfig: z.object({
    enabled: z.boolean(),
    budgetTokens: z.number().min(0).max(100000),
  }),
});

const ModelsConfigSchema = z.object({
  bedrock: BedrockModelConfigSchema,
});

const AppAPIConfigSchema = z.object({
  maxMessageLength: z.number().min(1000).max(1000000).default(50000),
  maxMessages: z.number().min(1).max(1000).default(100),
  maxDuration: z.number().min(1).max(600).default(30),
});

const AppFeaturesConfigSchema = z.object({
  mcpEnabled: z.boolean().default(true),
  reasoningEnabled: z.boolean().default(true),
});

const AppLoggingConfigSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("debug"),
  format: z.enum(["json", "pretty"]).default("pretty"),
});

const AppConfigSchema = z.object({
  api: AppAPIConfigSchema,
  features: AppFeaturesConfigSchema,
  logging: AppLoggingConfigSchema,
});

const ServerConfigSchema = z.object({
  port: z.number().min(1).max(65535).default(3001),
  cors: z.object({
    origins: z.array(z.string()).default(["http://localhost:3000"]),
  }),
});

const ConfigSchema = z.object({
  aws: AWSConfigSchema,
  mcp: MCPConfigSchema,
  models: ModelsConfigSchema,
  app: AppConfigSchema,
  server: ServerConfigSchema,
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type AWSConfig = z.infer<typeof AWSConfigSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export type BedrockModelConfig = z.infer<typeof BedrockModelConfigSchema>;
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface EnvSecrets {
  awsProfile?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const sourceValue = source[key];
    const targetValue = result[key];
    if (sourceValue === undefined) continue;

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue as any;
    }
  }
  return result;
}

function loadYAML(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fileContent = fs.readFileSync(filePath, "utf8");
    return yaml.load(fileContent);
  } catch (error) {
    throw new ConfigurationError(`Failed to parse YAML file: ${filePath}`, error);
  }
}

function validateRequiredEnvVars(): void {
  const hasProfile = !!process.env.AWS_PROFILE;
  const hasExplicitCreds =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

  if (!hasProfile && !hasExplicitCreds) {
    throw new ConfigurationError(
      "Missing required AWS credentials.\n\n" +
        "At least one authentication method must be configured:\n" +
        "  - AWS_PROFILE, or\n" +
        "  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY\n\n" +
        "Set these in your .env file or export them in your shell.\n" +
        "See .env.example for details."
    );
  }
}

function loadEnvSecrets(): EnvSecrets {
  return {
    awsProfile: process.env.AWS_PROFILE,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsSessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

// ============================================================================
// Configuration Loading
// ============================================================================

let cachedConfig: Config | null = null;
let cachedSecrets: EnvSecrets | null = null;

function loadConfig(): Config {
  logger.info("Loading application configuration...");

  const projectRoot = process.cwd();
  const configPath = path.join(projectRoot, "config.yaml");
  const localConfigPath = path.join(projectRoot, "config.local.yaml");

  const mainConfig = loadYAML(configPath);
  if (!mainConfig) {
    throw new ConfigurationError(
      `Configuration file not found: ${configPath}\n` +
        `The config.yaml file should be present in the project root.`
    );
  }

  let finalConfig = mainConfig;
  const localConfig = loadYAML(localConfigPath);
  if (localConfig) {
    logger.debug("Merging config.local.yaml overrides");
    finalConfig = deepMerge(mainConfig, localConfig);
  }

  validateRequiredEnvVars();
  cachedSecrets = loadEnvSecrets();

  try {
    const validatedConfig = ConfigSchema.parse(finalConfig);
    logger.info("Configuration loaded successfully", {
      region: validatedConfig.aws.region,
      model: validatedConfig.models.bedrock.modelId,
      mcpEnabled: validatedConfig.mcp.enabled,
      port: validatedConfig.server.port,
    });
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      throw new ConfigurationError(
        `Configuration validation failed:\n  - ${messages.join("\n  - ")}`,
        error
      );
    }
    throw new ConfigurationError(
      error instanceof Error ? error.message : String(error),
      error
    );
  }
}

// ============================================================================
// Public API
// ============================================================================

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function getSecrets(): EnvSecrets {
  if (!cachedSecrets) getConfig();
  return cachedSecrets!;
}

export function getAWSConfig(): AWSConfig {
  return getConfig().aws;
}

export function getMCPConfig(): MCPConfig {
  return getConfig().mcp;
}

export function getMCPServers(): MCPServerConfig[] {
  const config = getMCPConfig();
  if (!config.servers || config.servers.length === 0) {
    throw new ConfigurationError("No MCP servers configured");
  }
  return config.servers;
}

export function getModelsConfig(): ModelsConfig {
  return getConfig().models;
}

export function getAppConfig(): AppConfig {
  return getConfig().app;
}

export function getServerConfig(): ServerConfig {
  return getConfig().server;
}

export function resetConfig(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetConfig() can only be called in test environment");
  }
  cachedConfig = null;
  cachedSecrets = null;
}
