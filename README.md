🚀 Medusa Backend Deployment on AWS ECS Fargate (via Docker, Terraform, GitHub Actions)
This project demonstrates how to containerize, deploy using infrastructure as code, and automate deployment of the Medusa backend using:
Docker for building container images
Terraform for provisioning AWS infrastructure (like ECS, VPC, IAM)
GitHub Actions for CI/CD automation
AWS ECS Fargate to host the backend as a serverless container

📁 Repository Structure
.github/workflows/deploy.yml: CI/CD GitHub Actions workflow
terraform/: Contains all Terraform configuration files
main.tf: Sets up ECS, networking, IAM, etc.
variables.tf: Inputs for customizing your infrastructure
outputs.tf: Outputs used in deployment (like ECS names)
terraform.tfvars: Your actual values for each input
Dockerfile: Builds the Medusa backend container
README.md: Documentation for setup and usage

🛠️ Technologies Used
Medusa backend (Node.js-based headless commerce system)
Docker & Docker Hub (for container image building and storage)
AWS ECS Fargate (for serverless container hosting)
Terraform (to define and provision cloud resources)
GitHub Actions (to automate build and deployment steps) 

🚧 Prerequisites
Before starting, ensure you have:
An AWS account with appropriate access
Docker Hub account
GitHub repository secrets configured:
Docker Hub username and access token
AWS access key ID and secret access key
AWS region (e.g., ap-south-1)

📦 Dockerfile Purpose
The Dockerfile describes how to install dependencies, build the Medusa project, expose the application port, and start the server inside a Docker container.

📐 Terraform Configuration
Terraform is used to:
Create a secure and isolated network (VPC, subnets)
Set up ECS cluster and Fargate service
Create IAM roles for ECS tasks and services
Define log groups for ECS monitoring
You initialize and apply the Terraform configuration to provision all required AWS infrastructure automatically.

⚙️ GitHub Actions Workflow
This file automates:
Checking out your repository
Setting up Docker and logging into Docker Hub
Building and pushing the Medusa container image to Docker Hub
Using the AWS CLI to trigger a new ECS deployment
Secrets from your GitHub repo are used to securely connect to Docker Hub and AWS.

🚀 Deployment Flow
You push code to the main branch.
GitHub Actions automatically builds the Docker image.
It pushes the image to Docker Hub.
GitHub Actions then forces a new deployment on your ECS service.
ECS pulls the new image and redeploys the Medusa backend.

🌐 Accessing the Backend
If your ECS service is deployed in a public subnet with a public IP assigned, you can access the Medusa backend via the public IP and the app’s port (usually 9000).
You can find the public IP in the ECS Console under the running task's network section.

📹 Deliverables for Review
Public GitHub repository with:
Terraform code
Dockerfile
GitHub Actions workflow
A successfully deployed Medusa backend running in ECS Fargate
