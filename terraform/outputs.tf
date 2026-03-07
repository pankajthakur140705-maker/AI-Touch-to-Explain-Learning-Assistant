# ════════════════════════════════════════════════════════════
# Outputs — AI Touch-to-Explain Learning Assistant
# ════════════════════════════════════════════════════════════

output "alb_dns_name" {
  description = "Application Load Balancer DNS name (API base URL)"
  value       = "http://${aws_lb.app.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for docker push"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "dynamodb_table_highlights" {
  description = "DynamoDB highlights table name"
  value       = aws_dynamodb_table.highlights.name
}

output "dynamodb_table_flashcards" {
  description = "DynamoDB flashcards table name"
  value       = aws_dynamodb_table.flashcards.name
}

output "dynamodb_table_documents" {
  description = "DynamoDB documents table name"
  value       = aws_dynamodb_table.documents.name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.app.name
}

output "docker_push_commands" {
  description = "Commands to build and push the Docker image"
  value       = <<-EOT
    # Authenticate Docker to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com

    # Build & push
    docker build -t ${aws_ecr_repository.app.repository_url}:latest .
    docker push ${aws_ecr_repository.app.repository_url}:latest

    # Force new deployment
    aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.app.name} --force-new-deployment --region ${var.aws_region}
  EOT
}
