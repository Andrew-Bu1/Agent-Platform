# ─── Build stage ─────────────────────────────────────────────────────────────
# Build context must be the repo root so libs/java/common is available.
# docker build -f services/agent-studio/Dockerfile -t agent-studio .
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /app

COPY pom.xml ./

# All sibling module poms must exist so Maven can read the root pom.xml
COPY libs/java/pom.xml                    libs/java/pom.xml
COPY libs/java/common/pom.xml             libs/java/common/pom.xml
COPY services/iam-service/pom.xml         services/iam-service/pom.xml
COPY services/agent-studio/pom.xml        services/agent-studio/pom.xml

RUN mvn -pl libs/java/common,services/agent-studio \
           -am dependency:go-offline -q

COPY libs/java/common/src libs/java/common/src
COPY services/agent-studio/src services/agent-studio/src

RUN mvn -pl libs/java/common,services/agent-studio \
           -am package -DskipTests -q

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/services/agent-studio/target/agent-studio-*.jar app.jar

RUN chown app:app app.jar
USER app

EXPOSE 8082

ENTRYPOINT ["java", \
            "-XX:+UseContainerSupport", \
            "-XX:MaxRAMPercentage=75.0", \
            "-jar", "app.jar"]
