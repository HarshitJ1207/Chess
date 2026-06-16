#!/bin/bash
set -e

echo "Fetching top players from lichess..."
json=$(curl -s https://lichess.org/api/player/top/200/blitz)

> auth_inserts.sql
> rating_inserts.sql

echo "BEGIN;" >> auth_inserts.sql
echo "BEGIN;" >> rating_inserts.sql

# Fixed password hash for 'password' (BCrypt)
HASH="\$2a\$10\$wOqZqK7s21JqI8i48k.bS.F7Rk0l72B1u6oQ0fG6tO7R8X8U0p2t2"

echo "$json" | jq -c '.users[]' | while read -r user; do
  raw_username=$(echo "$user" | jq -r '.username')
  rating=$(echo "$user" | jq -r '.perfs.blitz.rating')
  
  # Clean username: replace hyphens with underscores, remove non-alphanumeric, truncate to 20
  username=$(echo "$raw_username" | sed 's/-/_/g' | tr -cd 'a-zA-Z0-9_' | cut -c 1-20)
  
  if [ ${#username} -ge 3 ]; then
    email="${username}@lichess.mock"
    
    # auth_db inserts (ON CONFLICT DO NOTHING to avoid failing if already exists)
    echo "INSERT INTO users (username, email, created_at) VALUES ('$username', '$email', NOW()) ON CONFLICT DO NOTHING;" >> auth_inserts.sql
    echo "INSERT INTO credentials (username, password_hash) VALUES ('$username', '$HASH') ON CONFLICT DO NOTHING;" >> auth_inserts.sql
    
    # rating_db inserts
    echo "INSERT INTO player_ratings (username, rating, rating_deviation, volatility, games_played, updated_at) VALUES ('$username', $rating, 45.0, 0.06, 100, NOW()) ON CONFLICT (username) DO UPDATE SET rating = EXCLUDED.rating;" >> rating_inserts.sql
  fi
done

echo "COMMIT;" >> auth_inserts.sql
echo "COMMIT;" >> rating_inserts.sql

echo "Executing SQL against auth_db..."
PGPASSWORD=chess psql -h localhost -U chess -d auth_db -f auth_inserts.sql

echo "Executing SQL against rating_db..."
PGPASSWORD=chess psql -h localhost -U chess -d rating_db -f rating_inserts.sql

echo "Cleaning up..."
rm auth_inserts.sql rating_inserts.sql

echo "Done seeding mock players!"
