#!/bin/bash

# Local Build Deployment Script
# Builds locally with Vite then copies dist files to container

# Configuration
SERVER="tickets.revival.com"
REMOTE_PATH="/srv/win/"
LOCAL_PATH="/Users/kenneth.hb29/projects/winner/"
REMOTE_USER="root"
CONTAINER_NAME="winner-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Local Build Deployment${NC}"
echo "================================"

# Parse arguments
SKIP_BUILD=false
REBUILD_CONTAINER=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build|-s)
            SKIP_BUILD=true
            echo -e "${YELLOW}Skipping local build${NC}"
            ;;
        --rebuild|-r)
            REBUILD_CONTAINER=true
            echo -e "${YELLOW}Container rebuild requested${NC}"
            ;;
        --help|-h)
            echo "Usage: ./deploy-local-build.sh [options]"
            echo "Options:"
            echo "  --skip-build, -s  Skip local Vite build"
            echo "  --rebuild, -r     Rebuild Docker container"
            echo "  --help, -h        Show this help message"
            exit 0
            ;;
    esac
    shift
done

# Step 1: Build locally if not skipped
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${CYAN}🔧 Building locally with Vite...${NC}"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Run Vite build
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Local build completed${NC}"
        
        # Show build size
        if [ -d "dist" ]; then
            echo "Build size: $(du -sh dist | cut -f1)"
        fi
    else
        echo -e "${RED}❌ Local build failed${NC}"
        exit 1
    fi
else
    echo "Skipping local build as requested"
    
    # Check if dist folder exists
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ No dist folder found. Run without --skip-build first${NC}"
        exit 1
    fi
fi

# Step 2: Rsync all files including dist to server
echo -e "${YELLOW}📁 Syncing files to server...${NC}"
rsync -avz --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'data/' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude '.env' \
    --exclude '.vscode' \
    --exclude '.idea' \
    "${LOCAL_PATH}" "${REMOTE_USER}@${SERVER}:${REMOTE_PATH}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files synced successfully${NC}"
else
    echo -e "${RED}❌ File sync failed${NC}"
    exit 1
fi

# Step 3: Deploy to container on server
echo -e "${YELLOW}🐳 Deploying to Docker container...${NC}"
ssh ${REMOTE_USER}@${SERVER} << ENDSSH
set -e
cd /srv/win/

if [ "$REBUILD_CONTAINER" = true ]; then
    echo -e "${BLUE}🔨 Rebuilding container...${NC}"
    docker-compose down
    docker-compose up -d --build
    
    echo "Waiting for container to be ready..."
    sleep 5
else
    # Ensure container is running
    if ! docker ps | grep -q "$CONTAINER_NAME"; then
        echo "Starting container..."
        docker-compose up -d
        sleep 5
    fi
    
    echo -e "${CYAN}📦 Copying dist files to container...${NC}"
    
    # Copy the pre-built dist folder
    docker cp dist/. $CONTAINER_NAME:/app/dist/
    
    # Also copy server files if they changed
    docker cp server.js $CONTAINER_NAME:/app/ 2>/dev/null || true
    docker cp conditions.html $CONTAINER_NAME:/app/ 2>/dev/null || true
    docker cp public/. $CONTAINER_NAME:/app/public/ 2>/dev/null || true
    
    echo -e "${GREEN}✅ Files copied to container${NC}"
    
    # Check if we need to restart (if server.js changed)
    if [ -f /tmp/last_deploy_time ]; then
        if [ server.js -nt /tmp/last_deploy_time ]; then
            echo "Server changed, restarting container..."
            docker restart $CONTAINER_NAME
            sleep 3
        fi
    fi
fi

# Update timestamp
touch /tmp/last_deploy_time

# Verify deployment
echo -e "${CYAN}🔍 Verifying deployment...${NC}"
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}✅ Container is running${NC}"
    
    # Check health
    HEALTH=\$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "none")
    if [ "\$HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✅ Container is healthy${NC}"
    elif [ "\$HEALTH" = "none" ]; then
        echo -e "${YELLOW}⚠️  No health check configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Health status: \$HEALTH${NC}"
    fi
    
    # Show container info
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $CONTAINER_NAME
    
    # Show recent logs
    echo ""
    echo "Recent logs:"
    docker logs $CONTAINER_NAME 2>&1 | tail -3
else
    echo -e "${RED}❌ Container is not running${NC}"
    echo "Error logs:"
    docker logs $CONTAINER_NAME 2>&1 | tail -10
    exit 1
fi
ENDSSH

DEPLOYMENT_RESULT=$?

if [ $DEPLOYMENT_RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Deployment Successful!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "🌐 App URL: ${CYAN}https://tickets.revival.com/win${NC}"
    echo ""
    
    # Calculate deployment time if possible
    if [ -f /tmp/deploy_start_time ]; then
        START=$(cat /tmp/deploy_start_time)
        END=$(date +%s)
        DURATION=$((END - START))
        echo -e "${BLUE}⏱️  Deployment time: ${DURATION} seconds${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}💡 Deployment Options:${NC}"
    echo "  ./deploy-local-build.sh     - Build locally, then deploy"
    echo "  ./deploy-local-build.sh -s  - Skip build, just copy existing dist"
    echo "  ./deploy-local-build.sh -r  - Rebuild container"
    echo "  ./deploy-smart.sh           - Smart deployment (build in container)"
    echo "  ./deploy.sh                 - Traditional full rebuild"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Deployment Failed${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi

# Record deployment time
date +%s > /tmp/deploy_start_time