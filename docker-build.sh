#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Winner App with Docker Compose...${NC}"

# Create data directory if it doesn't exist
if [ ! -d "./data" ]; then
    echo -e "${YELLOW}Creating data directory...${NC}"
    mkdir -p ./data
    chmod 755 ./data
fi

# Stop existing containers (including any created outside docker-compose)
echo -e "${YELLOW}Step 1: Stopping existing containers...${NC}"
docker stop winner-app 2>/dev/null
docker rm winner-app 2>/dev/null
docker-compose down

# Build and start
echo -e "${YELLOW}Step 2: Building and starting containers...${NC}"
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Container started successfully${NC}"
    echo -e "${GREEN}Application is running at: http://localhost:3001${NC}"

    # Wait for health check
    echo -e "${YELLOW}Waiting for health check...${NC}"
    sleep 5

    # Show container status
    echo -e "${YELLOW}Container status:${NC}"
    docker-compose ps

    # Show recent logs
    echo -e "${YELLOW}Recent logs:${NC}"
    docker-compose logs --tail 15
else
    echo -e "${RED}✗ Failed to start container${NC}"
    docker-compose logs
    exit 1
fi
