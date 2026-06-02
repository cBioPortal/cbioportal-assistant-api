import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromIni } from "@aws-sdk/credential-providers";
import { getAWSConfig, getSecrets } from "./config.js";
import { logger } from "./logger.js";

let cachedBedrock: ReturnType<typeof createAmazonBedrock> | null = null;

export async function getBedrockClient() {
  if (cachedBedrock) return cachedBedrock;

  const awsConfig = getAWSConfig();
  const secrets = getSecrets();

  const bedrockConfig: Record<string, any> = {
    region: awsConfig.region,
  };

  if (secrets.awsProfile) {
    bedrockConfig.credentialProvider = async () => {
      const credentials = await fromIni({ profile: secrets.awsProfile })();
      return {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      };
    };
  } else if (secrets.awsAccessKeyId && secrets.awsSecretAccessKey) {
    bedrockConfig.accessKeyId = secrets.awsAccessKeyId;
    bedrockConfig.secretAccessKey = secrets.awsSecretAccessKey;
    if (secrets.awsSessionToken) {
      bedrockConfig.sessionToken = secrets.awsSessionToken;
    }
  }

  logger.info("Bedrock client initialized", { region: awsConfig.region });
  cachedBedrock = createAmazonBedrock(bedrockConfig);
  return cachedBedrock;
}
