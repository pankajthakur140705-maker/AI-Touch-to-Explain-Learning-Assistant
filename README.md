# AI "Touch-to-Explain" Learning Assistant

> A Chrome Extension + serverless backend that provides real-time, AI-powered explanations of highlighted text. Supports both mock services (for quick demo) and real AWS services (Bedrock, Polly, Textract, DynamoDB).


https://youtu.be/f7r506SgcdM


## Features

- **Highlight & Explain** — Select text on any webpage → get instant AI explanations at 3 depth levels (Quick / Normal / Detailed)
- **Knowledge Graph** — All highlights and explanations are stored automatically
- **Auto Flashcards** — Highlight the same concept 3+ times → flashcard auto-generated
- **Audio Explanations** — Click "Listen" to hear explanations read aloud (Web Speech API + AWS Polly)
- **Learning Dashboard** — Extension popup shows top concepts, stats, and flashcard review
- **OCR Support** — Image/PDF text extraction via AWS Textract (or mock)
- **Error Handling** — Circuit breakers, retry logic, rate limiting, graceful degradation
- **Dual Mode** — Runs with mocks (no credentials) or real AWS services via `.env` config

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────────────┐
│  Chrome Extension   │       │  Express.js Backend (port 3001)  │
│  (Manifest V3)      │       │  ┌──────────────────────────┐   │
│                     │ HTTPS │  │  Auth Middleware          │   │
│  content.js ────────┼──────►│  │  Rate Limiter            │   │
│  (highlight detect) │       │  │  Circuit Breaker         │   │
│  background.js      │       │  └──────────┬───────────────┘   │
│  (API bridge)       │       │             │                    │
│  popup.html/js/css  │       │  ┌──────────▼───────────────┐   │
│  (dashboard)        │       │  │  Routes                  │   │
│                     │◄──────┤  │  /explain → LLM Engine   │   │
│                     │       │  │  /audio   → Voice Svc    │   │
└─────────────────────┘       │  │  /flashcards             │   │
                              │  │  /learning-summary       │   │
                              │  │  /documents              │   │
                              │  └──────────┬───────────────┘   │
                              │             │                    │
                              │  ┌──────────▼───────────────┐   │
                              │  │  Store (DynamoDB/Memory)  │   │
                              │  └──────────┬───────────────┘   │
                              │             │                    │
                              │  ┌──────────▼───────────────┐   │
                              │  │  AWS Services (optional)  │   │
                              │  │  • Bedrock / OpenAI       │   │
                              │  │  • Polly (TTS)            │   │
                              │  │  • Textract (OCR)         │   │
                              │  │  • DynamoDB (storage)     │   │
                              │  └──────────────────────────┘   │
                              └──────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 18+ installed
- **Google Chrome** browser

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set your mode:

**Option A: Mock Mode (no AWS credentials needed)**
```env
MODE=mock
```

**Option B: AWS Mode (real services)**
```env
MODE=aws
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# LLM Provider: bedrock, openai, or mock
LLM_PROVIDER=bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Or use OpenAI instead:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# Toggle individual services (true/false)
USE_POLLY=true
USE_TEXTRACT=true
USE_DYNAMODB=true
```

### 3. Start the Backend Server

```bash
cd backend
node server.js
```

You should see:
```
╔══════════════════════════════════════════════════════════╗
║   AI "Touch-to-Explain" Learning Assistant — Backend    ║
║   Server running at: http://localhost:3001              ║
║   Service Configuration:                               ║
║     Mode:      aws                                     ║
║     LLM:       bedrock                                 ║
║     Voice:     AWS Polly                               ║
║     OCR:       AWS Textract                            ║
║     Storage:   DynamoDB                                ║
╚══════════════════════════════════════════════════════════╝
```

### 3. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `extension/` folder from this project
5. The extension icon (purple circle) should appear in your toolbar

### 4. Demo Flow

1. Navigate to **any webpage** (e.g., Wikipedia, a blog, MDN docs)
2. **Highlight text** by selecting it with your mouse
3. Click the **💡 Explain** button that appears
4. Choose a **depth level**: ⚡ Quick, 📖 Normal, or 🔬 Detailed
5. Read the AI explanation in the **overlay popup**
6. Click **🔊 Listen** to hear the explanation read aloud
7. **Repeat step 2-4** with the same concept text **3 times** → a flashcard will auto-generate
8. Click the **extension icon** in the toolbar to see the **dashboard** with stats, top concepts, and flashcard review

### Test the API directly

```bash
curl -X POST http://localhost:3001/api/v1/explain \
  -H "Authorization: Bearer demo-user-token" \
  -H "Content-Type: application/json" \
  -d '{"text":"quantum computing","depth":"normal","contentType":"text"}'
```

## Project Structure

```
├── backend/
│   ├── server.js                    # Express server entry point
│   ├── package.json                 # Backend dependencies
│   ├── config.js                    # Configuration loader (.env)
│   ├── .env                         # Environment variables (gitignored)
│   ├── .env.example                 # Environment template
│   ├── middleware/
│   │   ├── auth.js                  # Mock JWT authentication
│   │   ├── circuitBreaker.js        # Circuit breaker pattern
│   │   └── rateLimiter.js           # Rate limiting (100 req/s per user)
│   ├── routes/
│   │   ├── explain.js               # POST /api/v1/explain
│   │   ├── audio.js                 # POST /api/v1/audio
│   │   ├── flashcards.js            # GET /api/v1/flashcards
│   │   ├── learningSummary.js       # GET /api/v1/learning-summary
│   │   └── documents.js             # POST/GET /api/v1/documents
│   ├── services/
│   │   ├── llmEngine.js             # Real LLM (Bedrock / OpenAI / mock)
│   │   ├── ocrService.js            # Real OCR (Textract / mock)
│   │   ├── voiceService.js          # Real TTS (Polly / mock)
│   │   ├── mockLLM.js               # Mock AI explanation generator
│   │   ├── mockOCR.js               # Mock Textract
│   │   └── mockVoice.js             # Mock Polly
│   └── store/
│       ├── dynamoStore.js           # DynamoDB store (with in-memory fallback)
│       └── inMemoryStore.js         # In-memory store
├── extension/
│   ├── manifest.json                # Chrome Extension Manifest V3
│   ├── content.js                   # Text selection detection + overlay UI
│   ├── content.css                  # Overlay styles (scoped with .tte- prefix)
│   ├── background.js                # Service worker (API bridge)
│   ├── popup.html                   # Extension popup dashboard
│   ├── popup.js                     # Dashboard logic
│   ├── popup.css                    # Dashboard styles
│   └── icons/                       # Extension icons
├── terraform/
│   ├── main.tf                      # VPC, ECR, ECS, ALB, DynamoDB, IAM
│   ├── variables.tf                 # Input variables with defaults
│   ├── outputs.tf                   # ALB URL, ECR repo, push commands
│   └── terraform.tfvars             # Dev environment defaults
├── Dockerfile                       # Multi-stage Node.js container
├── docker-compose.yml               # Local Docker dev/test
├── .dockerignore                    # Docker build exclusions
├── Design.md                        # System design document
├── requirement.md                   # Requirements document
└── README.md                        # This file
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/explain` | Generate AI explanation for text |
| `POST` | `/api/v1/audio` | Convert text to speech |
| `GET` | `/api/v1/audio/voices` | List available TTS voices |
| `GET` | `/api/v1/flashcards` | Get user's flashcards |
| `GET` | `/api/v1/learning-summary` | Get learning analytics |
| `POST` | `/api/v1/documents` | Upload a document |
| `GET` | `/api/v1/documents` | List user's documents |
| `GET` | `/api/v1/health` | Health check |

All endpoints (except health) require `Authorization: Bearer demo-user-token` header.

## Requirements Mapping

| Requirement | Component | Status |
|-------------|-----------|--------|
| 1. Text Highlighting | extension/content.js | ✅ |
| 2. API Validation | backend/server.js + routes | ✅ |
| 3. Authentication | backend/middleware/auth.js | ✅ |
| 4. Content Type Detection | backend/routes/explain.js | ✅ |
| 5. OCR Text Extraction | backend/services/ocrService.js (Textract) | ✅ |
| 6. AI Explanation | backend/services/llmEngine.js (Bedrock/OpenAI) | ✅ |
| 7. Knowledge Graph | backend/store/dynamoStore.js (DynamoDB) | ✅ |
| 8. Auto Flashcards | backend/routes/explain.js | ✅ |
| 9. Audio Synthesis | backend/services/voiceService.js (Polly) + Web Speech API | ✅ |
| 10. Document Upload | backend/routes/documents.js | ✅ |
| 11. Overlay UI | extension/content.js + content.css | ✅ |
| 12. Monitoring/Logging | backend/store/inMemoryStore.js | ✅ |
| 13. Learning Analytics | backend/routes/learningSummary.js | ✅ |
| 14. Error Handling | Circuit breaker + retry + graceful degradation | ✅ |
| 15. Performance | Rate limiting + timeouts | ✅ |
| 16. Data Lifecycle | DynamoDB TTL / Mock S3 lifecycle | ✅ |
| 17. Accessibility | Keyboard nav + color contrast + audio controls | ✅ |

## AWS IAM Permissions

If running in AWS mode, your IAM user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/ai-learning-*"
      ]
    }
  ]
}
```

## DynamoDB Table Setup

If using DynamoDB, create these tables in your AWS account (us-east-1):

| Table Name | Partition Key | Sort Key |
|------------|--------------|----------|
| `ai-learning-highlights` | `userId` (S) | `createdAt` (N) |
| `ai-learning-flashcards` | `userId` (S) | `flashcardId` (S) |
| `ai-learning-documents` | `userId` (S) | `documentId` (S) |

You can create them via the AWS Console or CLI:

```bash
aws dynamodb create-table --table-name ai-learning-highlights \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=N \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=createdAt,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

aws dynamodb create-table --table-name ai-learning-flashcards \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=flashcardId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=flashcardId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

aws dynamodb create-table --table-name ai-learning-documents \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=documentId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=documentId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

## Docker

### Build & Run Locally

```bash
# Build the image
docker build -t ai-learning-backend .

# Run with mock mode (no AWS credentials needed)
docker run -p 3001:3001 -e MODE=mock ai-learning-backend

# Run with AWS credentials
docker run -p 3001:3001 \
  -e MODE=aws \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  -e AWS_REGION=us-east-1 \
  -e LLM_PROVIDER=bedrock \
  ai-learning-backend
```

### Using Docker Compose

```bash
# Uses backend/.env for configuration
docker compose up --build

# Background
docker compose up -d --build

# Tear down
docker compose down
```

## Terraform — AWS Deployment

The `terraform/` directory provisions a full production-ready AWS stack:

| Resource | Purpose |
|----------|----------|
| VPC + Subnets | Isolated network (2 public + 2 private subnets) |
| NAT Gateway | Outbound internet for containers in private subnets |
| ECR | Docker image registry |
| ECS Fargate | Serverless container orchestration |
| ALB | Load balancer with `/api/v1/health` health checks |
| DynamoDB (x3) | Highlights, Flashcards, Documents tables |
| IAM Roles | Least-privilege Bedrock, Polly, Textract, DynamoDB |
| CloudWatch Logs | Centralized container logging |
| Auto Scaling | Optional CPU-based scaling (disabled in dev) |

### Deploy

```bash
cd terraform

# Initialize providers
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

### Push Docker Image & Deploy

After `terraform apply`, use the output commands:

```bash
# 1. Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# 2. Build & push
docker build -t <ecr-repo-url>:latest .
docker push <ecr-repo-url>:latest

# 3. Force ECS to pull the new image
aws ecs update-service \
  --cluster ai-learn-dev-cluster \
  --service ai-learn-dev-service \
  --force-new-deployment
```

### Customize

Edit `terraform.tfvars` or pass overrides:

```bash
terraform apply \
  -var="environment=prod" \
  -var="desired_count=2" \
  -var="enable_autoscaling=true" \
  -var="task_cpu=512" \
  -var="task_memory=1024"
```

### Tear Down

```bash
terraform destroy
```

## Demo Notes

- **Mock mode requires no API keys** — Toggle with `MODE=mock` in `.env`
- **AWS mode** — Set `MODE=aws` and fill in credentials for real AI/TTS/OCR/storage
- **Hardcoded auth** — Use token `demo-user-token` (maps to user `demo-user`)
- **Audio uses Web Speech API** — Browser's built-in text-to-speech for actual audio playback
- **Designed for Chrome** — Manifest V3 extension, tested on Chrome 120+

- **DynamoDB tables** — Created automatically by Terraform, or manually with CLI commands above

