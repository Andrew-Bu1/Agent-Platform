# ─── Build stage ─────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /app

# Copy parent pom + module poms first for dependency caching
COPY pom.xml ./
COPY libs/java/core/pom.xml ./libs/java/core/
COPY services/agent-studio/pom.xml ./services/agent-studio/

# Download all dependencies (layer cached unless pom.xml changes)
RUN mvn dependency:go-offline -pl libs/java/core,services/agent-studio -am -q

# Copy source
COPY libs/java/core/src ./libs/java/core/src
COPY services/agent-studio/src ./services/agent-studio/src

# Build (skip tests in image build)
RUN mvn package -pl libs/java/core,services/agent-studio -am -DskipTests -q

# ─── Runtime stage ───────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/services/agent-studio/target/agent-studio-1.0-SNAPSHOT.jar app.jar

EXPOSE 8006

ENTRYPOINT ["java", "-jar", "app.jar"]
