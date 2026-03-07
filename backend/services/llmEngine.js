/**
 * Real LLM Engine
 * 
 * Supports AWS Bedrock (Claude/Llama) and OpenAI (GPT-4).
 * Falls back to mock if service is unavailable.
 * 
 * Validates: Requirements 6.1-6.7 (AI Explanation Generation)
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { config, getAWSConfig, isAWSMode } = require('../config');

// Initialize OpenAI lazily
let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const { default: OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: config.llm.openai.apiKey });
  }
  return openaiClient;
}

// Initialize Bedrock client lazily
let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient(getAWSConfig());
  }
  return bedrockClient;
}

// ── Prompt Templates ──
const PROMPTS = {
  'very-short': (text) => `Explain this concept in 2-3 sentences (50-100 words). Use simple language, avoid jargon, and focus on the core idea. Include a brief example if possible.\n\nConcept: "${text}"`,

  'normal': (text) => `Explain this concept in a clear paragraph (100-200 words). Include:\n- What it is\n- Why it matters\n- A simple example\n\nUse simple language and avoid unnecessary jargon.\n\nConcept: "${text}"`,

  'detailed': (text) => `Provide a detailed explanation of this concept (200-400 words). Include:\n- Clear definition\n- Step-by-step breakdown\n- Multiple examples\n- Common misconceptions\n- Practical applications\n\nUse simple language, avoid jargon, and make it accessible to learners.\n\nConcept: "${text}"`,
};

const MAX_TOKENS = {
  'very-short': 200,
  'normal': 500,
  'detailed': 1000,
};

/**
 * Generate explanation using the configured LLM provider
 */
async function generateExplanation(text, depth = 'normal') {
  // In mock mode, always use mock LLM regardless of provider setting
  if (!isAWSMode()) {
    return await generateMock(text, depth);
  }

  const provider = config.llm.provider;
  const prompt = PROMPTS[depth](text);
  const maxTokens = MAX_TOKENS[depth] || 500;

  switch (provider) {
    case 'bedrock':
      return await generateWithBedrock(prompt, maxTokens);
    case 'openai':
      return await generateWithOpenAI(prompt, maxTokens);
    case 'mock':
    default:
      return await generateMock(text, depth);
  }
}

/**
 * AWS Bedrock (Claude) — Real LLM
 */
async function generateWithBedrock(prompt, maxTokens) {
  const client = getBedrockClient();
  const modelId = config.llm.bedrock.modelId;

  let body;

  // Handle different model families
  if (modelId.startsWith('anthropic.claude')) {
    // Claude models use Messages API
    body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
  } else if (modelId.startsWith('meta.llama')) {
    // Llama models
    body = JSON.stringify({
      prompt: `<s>[INST] ${prompt} [/INST]`,
      max_gen_len: maxTokens,
      temperature: 0.7,
    });
  } else if (modelId.startsWith('amazon.titan')) {
    // Amazon Titan
    body = JSON.stringify({
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: maxTokens,
        temperature: 0.7,
      },
    });
  } else {
    // Default to Claude format
    body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Extract text based on model family
  if (modelId.startsWith('anthropic.claude')) {
    return responseBody.content?.[0]?.text || '';
  } else if (modelId.startsWith('meta.llama')) {
    return responseBody.generation || '';
  } else if (modelId.startsWith('amazon.titan')) {
    return responseBody.results?.[0]?.outputText || '';
  }

  return responseBody.content?.[0]?.text || JSON.stringify(responseBody);
}

/**
 * OpenAI (GPT-4) — Real LLM
 */
async function generateWithOpenAI(prompt, maxTokens) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: config.llm.openai.model,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful learning assistant. Provide clear, concise explanations using simple language. Avoid unnecessary jargon and include examples where relevant.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });

  return response.choices?.[0]?.message?.content || '';
}

/**
 * Mock LLM — Fallback with template responses
 */
async function generateMock(text, depth) {
  const mockLLM = require('./mockLLM');
  return await mockLLM.generateExplanation(text, depth);
}

/**
 * Validate depth preference
 */
function isValidDepth(depth) {
  return ['very-short', 'normal', 'detailed'].includes(depth);
}

module.exports = { generateExplanation, isValidDepth };
