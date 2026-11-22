# syntax=docker/dockerfile:1

# ---- build: compile TypeScript ----
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime: production dependencies + compiled output only ----
FROM node:26-alpine
ENV NODE_ENV=production \
    PORT=4002
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

USER node
EXPOSE 4002
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Run node directly (no npm wrapper) so it receives SIGTERM and shuts down
# gracefully. -r loads tracing.js (OpenTelemetry) before anything else gets
# required, which is what lets its auto-instrumentation patch them.
CMD ["node", "-r", "./dist/tracing.js", "dist/server.js"]
