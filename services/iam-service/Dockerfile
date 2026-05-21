# syntax=docker/dockerfile:1.7

# ─── Build stage ─────────────────────────────────────────────────────────────
# Build context must be the repo root so libs/java/common is available.
# docker build -f services/iam-service/Dockerfile -t iam-service .
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /app

# Copy only poms first — this layer is cached until a pom.xml changes
COPY pom.xml ./
COPY libs/java/pom.xml                    libs/java/pom.xml
COPY libs/java/common/pom.xml             libs/java/common/pom.xml
COPY services/iam-service/pom.xml         services/iam-service/pom.xml
COPY services/agent-studio/pom.xml        services/agent-studio/pom.xml

# Download all dependencies — cached independently of source changes
RUN --mount=type=cache,id=iam-maven,target=/root/.m2,sharing=shared \
    mvn -B -ntp -pl libs/java/common,services/iam-service \
        -am dependency:go-offline

# Copy full source
COPY libs/java/common/src libs/java/common/src
COPY services/iam-service/src services/iam-service/src

# Build (skip tests — run them in CI separately)
RUN --mount=type=cache,id=iam-maven,target=/root/.m2,sharing=shared \
    mvn -B -ntp -pl libs/java/common,services/iam-service \
        -am package -Dmaven.test.skip=true

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/services/iam-service/target/iam-service-*.jar app.jar

RUN chown app:app app.jar
USER app

EXPOSE 8080

ENTRYPOINT ["java", \
            "-XX:+UseContainerSupport", \
            "-XX:MaxRAMPercentage=75.0", \
            "-jar", "app.jar"]
