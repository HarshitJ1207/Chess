# Setup & Infrastructure

This guide details the setup for both local development and production-like Docker deployments, including useful commands for debugging and monitoring the core infrastructure.

## 1. Local Development Setup

### Server (Gradle)
Navigate to the `server/` directory.

```bash
cd server
./gradlew build         # Build all services
./gradlew :auth-service:bootRun # Run one service locally (repeat for other services)
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
cp .env.example .env
# Set JWT_SECRET in .env (openssl rand -base64 48).
# Build and start everything
docker compose up --build

# Graceful shutdown
docker compose down

# Start only infrastructure (DB, cache, broker) for local service dev
docker compose up postgres redis redpanda
```

### Sequential builds on constrained hosts
Concurrent builds can cause Out-Of-Memory (OOM) failures. Build one service at a time:

```bash
for service in eureka-server auth-service matchmaking-service game-service rating-service history-service gateway nginx; do
  docker compose build "$service" || exit 1
done
docker compose up -d
```

### Private cloud host setup

Host provisioning lives in a locally maintained, Git-ignored `setup.sh`. Upload it over SSH and run it from the repository checkout on the cloud VM:

```bash
scp setup.sh user@host:~/chess/setup.sh
ssh user@host 'cd ~/chess && bash setup.sh'
```

The VM must already have a checkout of `main`. The private script configures the host, creates `.env` when missing, builds sequentially, and runs Docker Compose. Keep machine-specific configuration and TLS certificates on the host. With existing certificates under `/etc/letsencrypt`, set `DOMAIN` when invoking the private script to enable HTTPS.

The tracked `docker-compose.prod.yml` removes published infrastructure and gateway ports; only Nginx remains exposed. Use it on the host with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Any host-specific overrides belong in the ignored `docker-compose.local.yml` and `nginx/nginx.local.conf`. Include the same overrides for subsequent operations. Private setup files, environment files, keys, and local overrides are also excluded from the Docker build context.

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
- `GET player:{username}:game` (Get the player's active game claim)
- `GET player:{username}:queue` (Get the player's queue membership claim)
- `HGETALL game:{gameId}:meta` (Get game metadata)
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
