#!/bin/bash
set -e

echo "Starting sequential service builds to conserve memory..."

docker compose build eureka-server
docker compose build auth-service
docker compose build matchmaking-service
docker compose build game-service
docker compose build rating-service
docker compose build history-service
docker compose build gateway
docker compose build nginx
docker compose build db-seeder

echo "All services built successfully! Launching containers..."
docker compose up -d

echo "Application started!"
