# Planix demo image (decision docs/04-decisions/2026-09-15-018-demo-deploy.md).
# One container: migrations, then the NestJS API, which also serves the built web app on the same origin.

# ---- build: install everything and build the web app ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY tools/eslint-plugin-planix/package.json tools/eslint-plugin-planix/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web
RUN npm run build --workspace apps/web

# ---- runtime: server production dependencies, sources run by tsx, web build ----
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    TZ=UTC \
    WEB_DIST_DIR=/app/apps/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY tools/eslint-plugin-planix/package.json tools/eslint-plugin-planix/
RUN npm ci --omit=dev --workspace apps/server --no-audit --no-fund && npm cache clean --force
COPY tsconfig.base.json ./
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY apps/server/tsconfig.json apps/server/
COPY apps/server/drizzle apps/server/drizzle
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist

USER node
WORKDIR /app/apps/server
EXPOSE 3000
# Migrations take an advisory lock, so an overlapping old/new container during a deploy is safe.
CMD ["sh", "-c", "node --import tsx src/ops/migrate.ts && exec node --import tsx src/main.ts"]
