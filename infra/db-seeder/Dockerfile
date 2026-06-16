FROM alpine:3.19

RUN apk add --no-cache bash curl jq postgresql-client redis

WORKDIR /app
COPY run-seeding.sh .
RUN chmod +x run-seeding.sh

CMD ["./run-seeding.sh"]
