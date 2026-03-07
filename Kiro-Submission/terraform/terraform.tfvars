# ════════════════════════════════════════════════════════════
# Dev environment defaults
# ════════════════════════════════════════════════════════════

aws_region    = "us-east-1"
environment   = "dev"
llm_provider  = "bedrock"

# Small footprint for dev
task_cpu      = 256
task_memory   = 512
desired_count = 1

enable_autoscaling = false
log_retention_days = 7
