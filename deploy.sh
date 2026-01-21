#!/bin/bash

PROJECT_ID=$(gcloud config get-value project)
REGION="asia-south1"
REPO="notebooklm-repo"

# Build and push backend
echo "Building backend..."
cd backend
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest

# Build and push frontend
echo "Building frontend..."
cd ../frontend
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/frontend:latest

cd ..