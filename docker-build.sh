#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Winner App Docker Image...${NC}"

# Build the Docker image
echo -e "${YELLOW}Step 1: Building Docker image...${NC}"
docker build -t winner-app:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Stop and remove existing container if it exists
echo -e "${YELLOW}Step 2: Stopping existing container (if any)...${NC}"
docker stop winner-app 2>/dev/null
docker rm winner-app 2>/dev/null

# Run the container
echo -e "${YELLOW}Step 3: Starting new container...${NC}"
docker run -d \
    --name winner-app \
    --restart unless-stopped \
    -p 3001:3001 \
    -v winner-data:/app/data \
    winner-app:latest

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Container started successfully${NC}"
    echo -e "${GREEN}Application is running at: http://localhost:3001${NC}"
    
    # Show container logs
    echo -e "${YELLOW}Container logs:${NC}"
    docker logs --tail 10 winner-app
else
    echo -e "${RED}✗ Failed to start container${NC}"
    exit 1
fi

# Show container status
echo -e "${YELLOW}Container status:${NC}"
docker ps | grep winner-app