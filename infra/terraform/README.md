# AWS infrastructure for developer-connection

This Terraform configuration provisions everything the [`Deploy`](../../.github/workflows/deploy.yml)
GitHub Actions workflow needs:

- VPC with 2 public subnets, IGW, route table (`networking.tf`)
- Security groups for the ALB and ECS tasks (`security_groups.tf`)
- ECR repository for the backend image (`ecr.tf`)
- Secrets Manager secret holding the backend's env vars (`secrets.tf`)
- IAM roles: ECS task execution role, ECS task role, GitHub OIDC provider +
  deploy role (`iam.tf`)
- Application Load Balancer + target group + listener, health check on
  `/health` (`alb.tf`)
- ECS Fargate cluster, task definition, and service (`ecs.tf`)
- ElastiCache Redis (cache, queues, pub/sub, presence) with a security group
  scoped to the ECS tasks; its endpoint is injected into the tasks as
  `REDIS_URL` (`elasticache.tf`)
- A second ECS Fargate service running the BullMQ worker on the same image
  with `command = ["node","src/worker.js"]` (`ecs_worker.tf`)
- S3 bucket + CloudFront distribution (with OAC) for the frontend
  (`s3_cloudfront.tf`)

## Prerequisites

- Terraform >= 1.5
- AWS credentials for an account/IAM principal with permission to create the
  resources above (e.g. via `aws configure` or environment variables)
- An AWS account where no `token.actions.githubusercontent.com` OIDC provider
  exists yet. If one already exists (common if other projects in the same
  account already use GitHub Actions OIDC), remove the
  `aws_iam_openid_connect_provider.github` resource from `iam.tf` and instead
  reference the existing provider via a `data "aws_iam_openid_connect_provider"`
  data source.

## 1. Apply the infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # adjust values if needed
terraform init
terraform plan
terraform apply
```

This creates everything with a placeholder backend image
(`public.ecr.aws/docker/library/hello-world:latest`) and empty secret values.
The ECS service will start a task that fails health checks until both of
those are fixed in the next two steps — that's expected for a first apply.

## 2. Populate the backend secrets

`terraform apply` creates the Secrets Manager secret
(`<project_name>/backend/env`) with all keys present but empty. Fill in real
values, e.g.:

```bash
aws secretsmanager put-secret-value \
  --secret-id "$(terraform output -raw backend_env_secret_name)" \
  --secret-string file://backend-env.json
```

Where `backend-env.json` is a JSON object with the same keys as
`backend/.env.example` (see `var.backend_env_secret_keys` in `variables.tf`
for the full list) and your real values.

After updating the secret, force a new deployment so the running task picks
up the new values:

```bash
aws ecs update-service \
  --cluster "$(terraform output -raw ecs_cluster_name)" \
  --service "$(terraform output -raw ecs_service_name)" \
  --force-new-deployment
```

## 3. Configure GitHub repo secrets and variables

Set these via the GitHub UI (Settings → Secrets and variables → Actions) or
the `gh` CLI, using the corresponding Terraform outputs:

| GitHub setting                                  | Terraform output             |
| ------------------------------------------------ | ----------------------------- |
| Secret `AWS_DEPLOY_ROLE_ARN`                      | `github_deploy_role_arn`       |
| Variable `AWS_REGION`                             | `aws_region`                   |
| Variable `ECR_REPOSITORY`                         | `ecr_repository_name`          |
| Variable `ECS_CLUSTER`                            | `ecs_cluster_name`             |
| Variable `ECS_SERVICE`                            | `ecs_service_name`             |
| Variable `ECS_TASK_DEFINITION_FAMILY`             | `ecs_task_definition_family`   |
| Variable `ECS_CONTAINER_NAME`                     | `ecs_container_name`           |
| Variable `ECS_WORKER_SERVICE`                     | `worker_service_name`          |
| Variable `ECS_WORKER_TASK_DEFINITION_FAMILY`      | `worker_task_definition_family`|
| Variable `S3_BUCKET_FRONTEND`                     | `s3_bucket_frontend`           |
| Variable `CLOUDFRONT_DISTRIBUTION_ID`             | `cloudfront_distribution_id`   |

Example using `gh`:

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "$(terraform output -raw github_deploy_role_arn)"

gh variable set AWS_REGION --body "$(terraform output -raw aws_region)"
gh variable set ECR_REPOSITORY --body "$(terraform output -raw ecr_repository_name)"
gh variable set ECS_CLUSTER --body "$(terraform output -raw ecs_cluster_name)"
gh variable set ECS_SERVICE --body "$(terraform output -raw ecs_service_name)"
gh variable set ECS_TASK_DEFINITION_FAMILY --body "$(terraform output -raw ecs_task_definition_family)"
gh variable set ECS_CONTAINER_NAME --body "$(terraform output -raw ecs_container_name)"
gh variable set ECS_WORKER_SERVICE --body "$(terraform output -raw worker_service_name)"
gh variable set ECS_WORKER_TASK_DEFINITION_FAMILY --body "$(terraform output -raw worker_task_definition_family)"
gh variable set S3_BUCKET_FRONTEND --body "$(terraform output -raw s3_bucket_frontend)"
gh variable set CLOUDFRONT_DISTRIBUTION_ID --body "$(terraform output -raw cloudfront_distribution_id)"
```

## 4. Set FRONTEND_URL / OAUTH_CALLBACK_BASE_URL / VITE_API_URL

Once applied, two URLs are available:

- Frontend: `terraform output cloudfront_domain_name` (CloudFront)
- Backend API: `terraform output alb_dns_name` (ALB)

Use these to fill in the `FRONTEND_URL`, `OAUTH_CALLBACK_BASE_URL`, and any
OAuth provider callback URLs in the backend secret (step 2), and
`VITE_API_URL` in the frontend build (set as a repo variable consumed by the
frontend build step, or baked into `frontend/.env.production`).

For production use, put a custom domain + ACM certificate in front of both
the ALB and CloudFront distribution — this configuration uses the default
AWS-issued endpoints to keep the initial setup simple.

## 5. Trigger the Deploy workflow

Once the secrets/variables above are set, push to `master` (or re-run the
`CI` workflow) — the `Deploy` workflow will build and push the backend image,
register a new ECS task definition revision, roll out the service, build the
frontend, sync it to S3, and invalidate CloudFront.
