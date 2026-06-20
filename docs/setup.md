# Setup & Infrastructure

This guide details the setup for both local development and production-like Docker deployments, including useful commands for debugging and monitoring the core infrastructure.

## 1. Local Development Setup

### Server (Gradle)
Navigate to the `server/` directory.

```bash
cd server
./gradlew build         # Build all services
./gradlew bootRun       # Run locally
./gradlew test          # Run all tests
```

### Client (npm)
Navigate to the `client/` directory.

```bash
cd client
npm install
npm run dev      # Start dev server on localhost:5173
npm run build    # Create production build
npm run lint     # Run ESLint
```

## 2. Docker Setup

To run the entire full stack (infrastructure + microservices + frontend):

```bash
# Build and start everything
docker compose up --build

# Graceful shutdown
docker compose down

# Start only infrastructure (DB, cache, broker) for local service dev
docker compose up postgres redis redpanda
```

### Production Build on constrained instances (e.g. AWS t3.small)
Concurrent builds can cause Out-Of-Memory (OOM) failures. A script is provided to build sequentially:

```bash
chmod +x build_all.sh
nohup ./build_all.sh > build.log 2>&1 &
tail -f build.log
```

## 3. Useful Operations & Debugging

### Service Health & Logs
```bash
# Check Eureka registry (returns all registered services)
curl http://localhost:8761/eureka/apps

# Tail a service's logs
docker compose logs -f game-service

# View all running containers
docker compose ps
```

### Redis Operations
```bash
# Open Redis CLI
docker compose exec redis redis-cli

# View matchmaking queues (all time controls)
docker compose exec redis redis-cli KEYS "queue:*"

# View specific queue with ratings (e.g., 5+0)
docker compose exec redis redis-cli ZRANGE "queue:5+0" 0 -1 WITHSCORES

# Clear entire Redis cache
docker compose exec redis redis-cli FLUSHALL
```

Other common Redis commands:
- `SMEMBERS active_games` (List active games)
- `GET player:{id}:game` (Get game ID for a player)
- `HGETALL game:{gameId}` (Get game metadata)
- `LRANGE game:{gameId}:moves 0 -1` (View move log for a game)
- `ZRANGE leaderboard 0 -1 WITHSCORES` (Top players by rating)

### Kafka/Redpanda Operations
```bash
# View all topics
docker compose exec redpanda rpk topic list

# Check messages in a topic (latest 10)
docker compose exec redpanda rpk topic consume match-request --num 10

# Monitor a topic in real-time
docker compose exec redpanda rpk topic consume game-concluded --follow

# Check consumer group lag
docker compose exec redpanda rpk group list
```

### PostgreSQL Operations
```bash
# Open psql console
docker compose exec postgres psql -U chess

# Common PostgreSQL commands
\l                                 # List all databases
\c auth_db                         # Connect to auth_db
\dt                                # List tables
SELECT * FROM users;               # View users
SELECT * FROM player_ratings;      # View leaderboard
```
