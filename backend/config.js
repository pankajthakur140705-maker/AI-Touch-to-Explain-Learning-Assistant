/**
 * Configuration Module
 * 
 * Loads environment variables from .env and provides
 * a unified config object with defaults and validation.
 */

require('dotenv').config();

const config = {
  // Mode
  mode: process.env.MODE || 'mock', // 'aws' or 'mock'

  // Server
  port: parseInt(process.env.PORT) || 3001,

  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // LLM
  llm: {
    provider: process.env.LLM_PROVIDER || 'mock', // 'bedrock', 'openai', 'mock'
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
  },

  // Polly
  polly: {
    enabled: process.env.USE_POLLY === 'true',
    voiceId: process.env.POLLY_VOICE_ID || 'Joanna',
  },

  // Textract
  textract: {
    enabled: process.env.USE_TEXTRACT === 'true',
  },

  // DynamoDB
  dynamodb: {
    enabled: process.env.USE_DYNAMODB === 'true',
    tables: {
      highlights: process.env.DYNAMODB_HIGHLIGHTS_TABLE || 'ai-learning-highlights',
      flashcards: process.env.DYNAMODB_FLASHCARDS_TABLE || 'ai-learning-flashcards',
      documents: process.env.DYNAMODB_DOCUMENTS_TABLE || 'ai-learning-documents',
    },
  },
};

/**
 * Get AWS credentials config for SDK clients
 */
function getAWSConfig() {
  const awsConfig = { region: config.aws.region };

  if (config.aws.accessKeyId && config.aws.secretAccessKey) {
    awsConfig.credentials = {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    };
  }
  // If no explicit credentials, SDK will use default credential chain
  // (env vars, shared credentials file, IAM role, etc.)

  return awsConfig;
}

/**
 * Check if real AWS services should be used
 */
function isAWSMode() {
  return config.mode === 'aws';
}

/**
 * Validate configuration and warn about missing values
 */
function validateConfig() {
  const warnings = [];

  if (isAWSMode()) {
    if (!config.aws.accessKeyId && !process.env.AWS_PROFILE) {
      warnings.push('AWS_ACCESS_KEY_ID not set — will use default credential chain');
    }

    if (config.llm.provider === 'openai' && !config.llm.openai.apiKey) {
      warnings.push('OPENAI_API_KEY not set but LLM_PROVIDER is "openai"');
    }

    if (config.llm.provider === 'bedrock' && !config.aws.accessKeyId && !process.env.AWS_PROFILE) {
      warnings.push('Bedrock requires AWS credentials — ensure they are configured');
    }
  }

  return warnings;
}

module.exports = { config, getAWSConfig, isAWSMode, validateConfig };
