# Map these outputs to the GitHub Actions repo secrets/variables referenced
# by .github/workflows/deploy.yml. See infra/terraform/README.md for the
# step-by-step mapping.

output "aws_region" {
  description = "-> repo variable AWS_REGION"
  value       = var.aws_region
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
