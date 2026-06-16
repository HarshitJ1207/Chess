#!/bin/bash
set -e

echo "Starting database seeding process..."

# Environment variables with defaults
DB_HOST=${DB_HOST:-postgres}
DB_USER=${DB_USER:-chess}
DB_PASSWORD=${DB_PASSWORD:-chess}
REDIS_HOST=${REDIS_HOST:-redis}

# Fixed password hash for 'password' (BCrypt)
HASH="\$2a\$10\$wOqZqK7s21JqI8i48k.bS.F7Rk0l72B1u6oQ0fG6tO7R8X8U0p2t2"

# 1. Fetch top players from Lichess
echo "Fetching top players from Lichess..."
json=$(curl -s https://lichess.org/api/player/top/200/blitz)

if [ -z "$json" ] || [ "$json" = "null" ]; then
  echo "Failed to fetch top players from Lichess. Exiting."
  exit 1
fi

# 2. Generate and execute SQL statements
echo "Generating SQL statements..."
auth_inserts="BEGIN;"
rating_inserts="BEGIN;"

# Read line by line using jq
while read -r user; do
  raw_username=$(echo "$user" | jq -r '.username')
  rating=$(echo "$user" | jq -r '.perfs.blitz.rating')
  
  # Clean username: replace hyphens with underscores, remove non-alphanumeric, truncate to 20
  username=$(echo "$raw_username" | sed 's/-/_/g' | tr -cd 'a-zA-Z0-9_' | cut -c 1-20)
  
  if [ ${#username} -ge 3 ]; then
    email="${username}@lichess.mock"
    
    auth_inserts="${auth_inserts} INSERT INTO users (username, email, created_at) VALUES ('$username', '$email', NOW()) ON CONFLICT DO NOTHING;"
    auth_inserts="${auth_inserts} INSERT INTO credentials (username, password_hash) VALUES ('$username', '$HASH') ON CONFLICT DO NOTHING;"
    
    rating_inserts="${rating_inserts} INSERT INTO player_ratings (username, rating, rating_deviation, volatility, games_played, updated_at) VALUES ('$username', $rating, 45.0, 0.06, 100, NOW()) ON CONFLICT (username) DO UPDATE SET rating = EXCLUDED.rating;"
  fi
done < <(echo "$json" | jq -c '.users[]')

auth_inserts="${auth_inserts} COMMIT;"
rating_inserts="${rating_inserts} COMMIT;"

echo "Executing SQL against auth_db..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d auth_db -c "$auth_inserts"

echo "Executing SQL against rating_db..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d rating_db -c "$rating_inserts"

# 3. Sync all ratings to Redis leaderboard ZSET
echo "Syncing ratings to Redis..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d rating_db -t -A -c 'SELECT rating, username FROM player_ratings;' > /tmp/ratings.txt

count=0
while IFS='|' read -r rating username; do
  rating=$(echo "$rating" | xargs)
  username=$(echo "$username" | xargs)
  if [ -n "$rating" ] && [ -n "$username" ]; then
    redis-cli -h "$REDIS_HOST" ZADD leaderboard "$rating" "$username" >/dev/null
    count=$((count + 1))
  fi
done < /tmp/ratings.txt

rm -f /tmp/ratings.txt
echo "Synced $count players to Redis leaderboard ZSET."
echo "Seeding completed successfully!"
