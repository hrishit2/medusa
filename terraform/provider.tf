provider "aws" {
  region  = "ap-south-1"  # Mumbai
}

terraform {
  required_version = ">= 1.3.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "medusa-terraform-state-hrishit"
    key            = "terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "medusa-terraform-locks"
    encrypt        = true
  }
}
