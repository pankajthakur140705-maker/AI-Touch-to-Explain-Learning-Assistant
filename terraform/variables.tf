
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# ── Networking ──

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# ── Container / ECS ──

variable "container_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 3001
}

variable "task_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

variable "max_count" {
  description = "Maximum number of ECS tasks for auto-scaling"
  type        = number
  default     = 4
}

variable "enable_autoscaling" {
  description = "Enable CPU-based auto-scaling for ECS service"
  type        = bool
  default     = false
}

# ── LLM Configuration ──

variable "llm_provider" {
  description = "LLM provider to use (bedrock, openai, mock)"
  type        = string
  default     = "bedrock"

  validation {
    condition     = contains(["bedrock", "openai", "mock"], var.llm_provider)
    error_message = "LLM provider must be one of: bedrock, openai, mock."
  }
}

variable "bedrock_model_id" {
  description = "AWS Bedrock model ID"
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}

# ── DynamoDB ──

variable "dynamodb_highlights_table" {
  description = "DynamoDB table name for highlights"
  type        = string
  default     = "ai-learning-highlights"
}

variable "dynamodb_flashcards_table" {
  description = "DynamoDB table name for flashcards"
  type        = string
  default     = "ai-learning-flashcards"
}

variable "dynamodb_documents_table" {
  description = "DynamoDB table name for documents"
  type        = string
  default     = "ai-learning-documents"
}

# ── Logging ──

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}
