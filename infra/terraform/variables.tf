variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short name used as a prefix for all resources"
  type        = string
  default     = "dc"
}

variable "github_repository" {
  description = "GitHub repo in 'owner/name' form, used to scope the OIDC trust policy"
  type        = string
  default     = "vindreshsingh/developer-connection"
}

variable "github_deploy_branch" {
  description = "Branch the Deploy workflow runs from (the workflow_run sub claim is scoped to this ref)"
  type        = string
  default     = "master"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the two public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "backend_container_port" {
  description = "Port the backend container listens on (matches backend/Dockerfile EXPOSE and PORT env var)"
  type        = number
  default     = 3008
}

variable "backend_image" {
  description = "Placeholder image used for the initial task definition before the first CI/CD push. Overwritten by the Deploy workflow on every run."
  type        = string
  default     = "public.ecr.aws/docker/library/hello-world:latest"
}

variable "backend_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Number of backend tasks to run"
  type        = number
  default     = 1
}

variable "backend_env_secret_keys" {
  description = "Keys written into the backend env Secrets Manager secret (values left blank — fill in via console/CLI after apply)"
  type        = list(string)
  default = [
    "MONGO_URI",
    "JWT_SECRET",
    "FRONTEND_URL",
    "EMAIL_USER",
    "EMAIL_PASS",
    "SKIP_EMAIL_VERIFICATION",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    "OAUTH_CALLBACK_BASE_URL",
    "ENCRYPTION_KEY",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_PREMIUM_PLAN_ID",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "AI_DAILY_LIMIT",
    "LOG_LEVEL",
    "SENTRY_DSN",
  ]
}
