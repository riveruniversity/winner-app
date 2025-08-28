#!/bin/bash

echo "=== Docker Rebuild Script for Winner App ==="
echo ""
echo "This script will:"
echo "1. Stop the current Docker container"
echo "2. Fix data directory permissions"
echo "3. Rebuild Docker image without cache"
echo "4. Start the new container"
echo ""
echo "Please run this script with sudo:"
echo "sudo bash rebuild-docker.sh"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: Please run as root (use sudo)"
    exit 1
fi

# Stop existing container
echo "Stopping existing container..."
docker-compose down

# Fix permissions - Set to UID 1001 (nodejs user in container)
echo "Fixing data directory permissions..."
chown -R 1001:1001 /srv/dev/winner/data/
chmod -R 755 /srv/dev/winner/data/

# Show current permissions
echo "Current permissions:"
ls -la /srv/dev/winner/data/

# Remove old image
echo "Removing old Docker image..."
docker rmi winner-app:latest || true

# Rebuild without cache
echo "Rebuilding Docker image without cache..."
docker-compose build --no-cache

# Start new container
echo "Starting new container..."
docker-compose up -d

# Show container status
echo "Container status:"
docker-compose ps

# Show logs
echo ""
echo "Recent logs:"
docker-compose logs --tail=20

echo ""
echo "=== Rebuild complete! ==="
echo ""
echo "To check if the app is working:"
echo "1. Try accessing http://localhost:3001/api/health"
echo "2. Check logs with: docker-compose logs -f"
echo "3. Try adding a new list and check if it's saved to /srv/dev/winner/data/lists.json"