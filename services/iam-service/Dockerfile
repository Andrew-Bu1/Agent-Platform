# ─── Build stage ─────────────────────────────────────────────────────────────
# Build context must be the repo root so libs/java/common is available.
# docker build -f services/iam-service/Dockerfile -t iam-service .
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /app

COPY pom.xml ./

# Copy only the module poms first so dependency download is cached
# All sibling module poms must exist so Maven can read the root pom.xml
COPY libs/java/pom.xml                    libs/java/pom.xml
COPY libs/java/common/pom.xml             libs/java/common/pom.xml
COPY services/iam-service/pom.xml         services/iam-service/pom.xml
COPY services/agent-studio/pom.xml        services/agent-studio/pom.xml

# Resolve all dependencies (cached unless pom.xml changes)
RUN mvn -pl libs/java/common,services/iam-service \
           -am dependency:go-offline -q

# Copy full source
COPY libs/java/common/src libs/java/common/src
COPY services/iam-service/src services/iam-service/src

# Build (skip tests — run them in CI separately)
RUN mvn -pl libs/java/common,services/iam-service \
           -am package -DskipTests -q

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
