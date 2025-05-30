🚀 Medusa Backend Deployment on AWS ECS Fargate
This project demonstrates how to containerize, provision infrastructure, and automate deployment of the Medusa backend using:

Docker (for building the image)

Terraform (for creating AWS infrastructure)

GitHub Actions (for CI/CD)

AWS ECS Fargate (for hosting the container)

📁 Repository Structure
.github/workflows/deploy.yml
GitHub Actions workflow for building and deploying the Medusa backend.
  
Terraform configuration files.

main.tf: AWS infrastructure setup (ECS, IAM, VPC, etc.)

outputs.tf: Outputs used by GitHub Actions

Dockerfile:
Used to build the Docker image for the Medusa backend.

README.md:
This documentation.

🛠️ Technologies Used:
Medusa (Node.js headless commerce backend)

Docker & Docker Hub

AWS ECS Fargate

Terraform

GitHub Actions

🚧 Prerequisites:
Make sure you have

AWS account with programmatic access enabled

Docker Hub account with a repository created

GitHub repository secrets configured:

DOCKERHUB_USERNAME

DOCKERHUB_ACCESS_TOKEN

AWS_ACCESS_KEY_ID

AWS_SECRET_ACCESS_KEY

AWS_REGION

📦 Dockerfile Purpose:
The Dockerfile contains instructions to:

Set up the Node.js environment

Install dependencies

Build the Medusa project

Expose the necessary port

Start the backend server

This file ensures the Medusa backend runs properly inside a container.

📐 Terraform Configuration:
Terraform is used to create and manage

A virtual private cloud (VPC) and subnets

ECS cluster and Fargate service

IAM roles and permissions

CloudWatch logging for ECS

Security groups and networking

You run terraform init and terraform apply to deploy infrastructure.

⚙️ GitHub Actions Workflow:
The GitHub Actions CI/CD workflow performs the following:

Checks out your repository

Sets up Docker and logs into Docker Hub

Builds and pushes the Medusa Docker image to Docker Hub

Configures AWS credentials

Triggers a new ECS deployment to pull the latest image

This ensures your application is deployed every time you push to the main branch.

🚀 Deployment Flow:
You push changes to the main branch.

GitHub Actions builds the Docker image.

The image is pushed to Docker Hub.

AWS ECS service is updated to pull the latest image.

The Medusa backend is deployed on Fargate.

