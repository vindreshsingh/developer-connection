# AWS infrastructure for developer-connection (frontend)

This Terraform configuration provisions everything the [`Deploy`](../../.github/workflows/deploy.yml)
GitHub Actions workflow needs to host the **frontend**:

- S3 bucket + CloudFront distribution (with OAC) for the static SPA
  (`s3_cloudfront.tf`)
- IAM: GitHub OIDC provider + a deploy role scoped to S3 sync and CloudFront
  invalidation (`iam.tf`)

> **The backend infrastructure was removed.** All APIs now run in the
> [developer-connection-microservices](https://github.com/vindreshsingh/developer-connection-microservices)
> stack, which owns its own deployment. The ECR/ECS/ALB/ElastiCache/Secrets/VPC
> resources that used to live here are gone — see "Tearing down the old backend
> infrastructure" below if you applied a previous revision.

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

> ⚠️ If you previously applied the backend version of this config, `terraform
> plan` will show the ECR/ECS/ALB/ElastiCache/Secrets/VPC resources as
> **destroyed**. That's intended — review the plan and confirm before applying.

## 2. Configure GitHub repo secrets and variables

Set these via the GitHub UI (Settings → Secrets and variables → Actions) or
the `gh` CLI, using the corresponding Terraform outputs:

| GitHub setting                        | Terraform output             |
| ------------------------------------- | ---------------------------- |
| Secret `AWS_DEPLOY_ROLE_ARN`          | `github_deploy_role_arn`     |
| Variable `AWS_REGION`                 | `aws_region`                 |
| Variable `S3_BUCKET_FRONTEND`         | `s3_bucket_frontend`         |
| Variable `CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` |

Example using `gh`:

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "$(terraform output -raw github_deploy_role_arn)"

gh variable set AWS_REGION --body "$(terraform output -raw aws_region)"
gh variable set S3_BUCKET_FRONTEND --body "$(terraform output -raw s3_bucket_frontend)"
gh variable set CLOUDFRONT_DISTRIBUTION_ID --body "$(terraform output -raw cloudfront_distribution_id)"
```

## 3. Point the frontend at the API gateway

The frontend talks to the microservices API gateway via `VITE_API_URL`
(see `frontend/.env.example`). Set it to the gateway's public URL for your
deployment. The frontend itself is served from
`terraform output cloudfront_domain_name`.

For production use, put a custom domain + ACM certificate in front of the
CloudFront distribution — this configuration uses the default AWS-issued
endpoint to keep the initial setup simple.

## 4. Trigger the Deploy workflow

Once the secrets/variables above are set, push to `master` (or re-run the
`CI` workflow) — the `Deploy` workflow builds the frontend, syncs it to S3,
and invalidates CloudFront.

## Tearing down the old backend infrastructure

If you applied a previous revision that created the backend resources, running
`terraform apply` with this config will destroy them (ECR, ECS cluster/services,
ALB, ElastiCache, Secrets Manager secret, VPC, and the ECS IAM roles). Review
the `terraform plan` output carefully and ensure no data you need lives in those
resources (e.g. the Secrets Manager secret) before applying.
