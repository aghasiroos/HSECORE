# Production Multi-Stage Dockerfile for Server Deployment (Linux/Musl Alpine Environment)
ARG NODE_BASE_IMAGE=node:20-alpine
FROM ${NODE_BASE_IMAGE} AS builder

WORKDIR /app

# Copy all project files into builder
COPY . .

# Remove any leftover node_modules or dist directories inside builder while preserving package-lock.json
RUN rm -rf node_modules dist /root/.npm

# Configure network retry resilience and install exact locked dependencies with npm ci
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

# Increase Node.js heap memory limit to 4GB to prevent JavaScript heap out of memory during Vite build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Compile production bundle and server
RUN npm run build

# Final Lightweight Runner Stage
FROM ${NODE_BASE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production

ARG APP_VERSION=2.6.0
ARG BUILD_ID=local
ARG RELEASE_ID=local
ENV APP_VERSION=$APP_VERSION
ENV BUILD_ID=$BUILD_ID
ENV RELEASE_ID=$RELEASE_ID

# Copy package manifests and lockfile for deterministic production installation
COPY package.json package-lock.json .npmrc* ./

# Clean deterministic installation for production runtime
RUN rm -rf node_modules /root/.npm && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --omit=dev

# Copy production bundle and drizzle migrations from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY create-user-cli.js ./

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

