resource "aws_secretsmanager_secret" "backend_env" {
  name        = "${var.project_name}/backend/env"
  description = "Backend environment variables for the ${var.project_name} ECS task (Phases 1-7). Populate values after apply."

  tags = {
    Name = "${var.project_name}-backend-env"
  }
}

resource "aws_secretsmanager_secret_version" "backend_env" {
  secret_id = aws_secretsmanager_secret.backend_env.id

  secret_string = jsonencode({
    for key in var.backend_env_secret_keys : key => ""
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
