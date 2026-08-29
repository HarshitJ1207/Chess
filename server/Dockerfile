FROM eclipse-temurin:21-jdk AS builder
WORKDIR /build

# Docker's default network has no IPv6 route, but DNS may return AAAA-only
# records (e.g. for services.gradle.org). Java would pick the v6 address and
# time out during wrapper/dependency downloads; force IPv4 for the build.
ENV JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true

COPY gradle gradle
COPY gradlew settings.gradle build.gradle gradle.properties ./

ARG SERVICE_NAME

# All subproject build files must be present so Gradle can configure the
# multi-module project — even when only building one service.
COPY eureka-server/build.gradle eureka-server/
COPY gateway-service/build.gradle gateway-service/
COPY auth-service/build.gradle auth-service/
COPY matchmaking-service/build.gradle matchmaking-service/
COPY game-service/build.gradle game-service/
COPY rating-service/build.gradle rating-service/
COPY history-service/build.gradle history-service/

RUN ./gradlew :${SERVICE_NAME}:dependencies --no-daemon -q

COPY . .
RUN ./gradlew :${SERVICE_NAME}:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ARG SERVICE_NAME
COPY --from=builder /build/${SERVICE_NAME}/build/libs/*.jar app.jar
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
