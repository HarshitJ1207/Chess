#!/bin/bash
set -e

# Sync all records from postgres to redis
PGPASSWORD=chess psql -h localhost -U chess -d rating_db -t -A -c 'SELECT rating, username FROM player_ratings;' > /tmp/ratings.txt

while IFS='|' read -r rating username; do
  rating=$(echo "$rating" | xargs)
  username=$(echo "$username" | xargs)
  if [ -n "$rating" ] && [ -n "$username" ]; then
    < /dev/null docker compose exec -T redis redis-cli ZADD leaderboard "$rating" "$username" >/dev/null
  fi
done < /tmp/ratings.txt

echo "Redis sync complete"
