# Map these outputs to the GitHub Actions repo secrets/variables referenced
# by .github/workflows/deploy.yml. See infra/terraform/README.md for the
# step-by-step mapping.

output "aws_region" {
  description = "-> repo variable AWS_REGION"
  value       = var.aws_region
}

output "ecr_repository_name" {
  description = "-> repo variable ECR_REPOSITORY"
  value       = aws_ecr_repository.backend.name
}

output "ecr_repository_url" {
  description = "ECR repository URL (for reference / manual pushes)"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "-> repo variable ECS_CLUSTER"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "-> repo variable ECS_SERVICE"
  value       = aws_ecs_service.backend.name
}

output "ecs_task_definition_family" {
  description = "-> repo variable ECS_TASK_DEFINITION_FAMILY"
  value       = aws_ecs_task_definition.backend.family
}

output "ecs_container_name" {
  description = "-> repo variable ECS_CONTAINER_NAME"
  value       = "backend"
}

output "s3_bucket_frontend" {
  description = "-> repo variable S3_BUCKET_FRONTEND"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "-> repo variable CLOUDFRONT_DISTRIBUTION_ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain serving the frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "github_deploy_role_arn" {
  description = "-> repo secret AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_deploy.arn
}

output "alb_dns_name" {
  description = "Public DNS name of the backend ALB (point a DNS record / FRONTEND_URL's API base at this, or use directly)"
  value       = aws_lb.backend.dns_name
}

output "backend_env_secret_name" {
  description = "Secrets Manager secret to populate with real backend env values after apply"
  value       = aws_secretsmanager_secret.backend_env.name
}
