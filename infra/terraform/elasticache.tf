# Phase 10 — ElastiCache Redis
#
# Backs caching, distributed rate-limiting, the Socket.IO adapter, the
# presence registry, and the BullMQ event queues. The endpoint is injected
# into both the backend and worker tasks as REDIS_URL (see ecs.tf /
# ecs_worker.tf) rather than the Secrets Manager secret, since it's known at
# apply time.
#
# NOTE: this places the node in the same (public) subnets as the rest of the
# stack to match the existing single-tier networking, but its security group
# only allows 6379 from the ECS task SG — it is NOT reachable from the
# internet. Hardening step for production: move ElastiCache (and ECS tasks)
# into private subnets with a NAT gateway.

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allow Redis (6379) from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnets"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Name = "${var.project_name}-redis-subnets"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis"
  description          = "Redis for ${var.project_name} (cache, queues, pub/sub, presence)"

  engine         = "redis"
  engine_version = var.redis_engine_version
  node_type      = var.redis_node_type
  port           = 6379

  # Single node — bump num_cache_clusters and enable automatic_failover for HA.
  num_cache_clusters = 1

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true

  tags = {
    Name = "${var.project_name}-redis"
  }
}

# redis://<primary-endpoint>:6379 — consumed by the backend + worker tasks.
locals {
  redis_url = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
}
