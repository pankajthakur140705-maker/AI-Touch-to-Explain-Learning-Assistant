# ════════════════════════════════════════════════════════════
# AI Touch-to-Explain Learning Assistant — Dockerfile
# ════════════════════════════════════════════════════════════
# Multi-stage build: install deps → production image
# ════════════════════════════════════════════════════════════

# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production image ──
FROM node:20-alpine AS runtime

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY backend/ ./

# Remove dev/config files not needed in container
RUN rm -f .env .env.example .env.local 2>/dev/null || true

# Set default environment variables (overridden at runtime)
ENV NODE_ENV=production \
    PORT=3001 \
    MODE=aws \
    LLM_PROVIDER=bedrock \
    BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0 \
    USE_POLLY=true \
    POLLY_VOICE_ID=Joanna \
    USE_TEXTRACT=true \
    USE_DYNAMODB=true \
    DYNAMODB_HIGHLIGHTS_TABLE=ai-learning-highlights \
    DYNAMODB_FLASHCARDS_TABLE=ai-learning-flashcards \
    DYNAMODB_DOCUMENTS_TABLE=ai-learning-documents \
    AWS_REGION=us-east-1

EXPOSE 3001

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "server.js"]
