output "vpc_id" {
  value = aws_vpc.main.id
}

output "subnet1_id" {
  value = aws_subnet.subnet1.id
}

output "subnet2_id" {
  value = aws_subnet.subnet2.id
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.medusa_cluster.name
}

output "ecs_service_name" {
  value = aws_ecs_service.medusa_service.name
}

output "task_definition" {
  value = aws_ecs_task_definition.medusa_task.arn
}
