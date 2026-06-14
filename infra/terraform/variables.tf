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
