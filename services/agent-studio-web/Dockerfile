# ─── Build stage ─────────────────────────────────────────────────────────────
# Build context: services/agent-studio-web/
# docker build -t agent-studio-web services/agent-studio-web/
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY . .

# Inline env so the built assets embed the correct API base path.
# In production the Nginx reverse-proxy handles /api → agent-studio, so
# the browser-visible base is just "/" — leave VITE_API_BASE_URL unset to
# default to the same origin, or override at build time:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com ...
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: unknown paths serve index.html
# API calls proxied to agent-studio BFF (configure NGINX_UPSTREAM at runtime)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
