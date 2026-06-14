# Phase 10 — BullMQ worker service
#
# A second ECS Fargate service running the SAME backend image with a command
# override (`node src/worker.js`) instead of the HTTP server. It drains the
# Redis-backed event queues (email, ...) off the API's request path and scales
# independently via var.worker_desired_count. No ALB / no inbound traffic.
#
# Reuses the backend's task roles, the env Secrets Manager secret (handlers
# need the same Mongo/SMTP/etc. credentials), and the ECS task security group
# (egress-only is all the worker needs to reach Redis, Mongo, and the internet).
# The Deploy workflow points a new task-definition revision at the same image
# tag it pushes for the backend.

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project_name}-worker"
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.backend_image
      essential = true

      # Override the image's default command (the HTTP server) to run the
      # BullMQ worker process instead.
      command = ["node", "src/worker.js"]

      environment = [
        {
          name  = "REDIS_URL"
          value = local.redis_url
        },
        {
          name  = "WORKER_CONCURRENCY"
          value = tostring(var.worker_concurrency)
        }
      ]

      secrets = [
        for key in var.backend_env_secret_keys : {
          name      = key
          valueFrom = "${aws_secretsmanager_secret.backend_env.arn}:${key}::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-worker"
  }
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_service.id]
    assign_public_ip = true
  }

  # The Deploy workflow rolls task-definition revisions out of band.
  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Name = "${var.project_name}-worker"
  }
}
