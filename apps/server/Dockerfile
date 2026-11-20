# 文件意义：后端 API（Elysia）与资金后台 Worker 共用的多阶段 Bun Docker 镜像。
# 创建时间：2026-11-20；修改时间：2026-11-20。
# 说明：构建上下文为仓库根目录（.），只安装 server 及其后端工作区依赖，跳过 Web/Electron 依赖。

FROM oven/bun:1-slim AS base
WORKDIR /app

FROM base AS builder
COPY package.json bun.lock tsconfig.json ./
COPY apps/desktop/package.json apps/desktop/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/access/package.json packages/access/
COPY packages/auth/package.json packages/auth/
COPY packages/calculators/package.json packages/calculators/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/desktop-bridge/package.json packages/desktop-bridge/
COPY packages/lattice-grid/package.json packages/lattice-grid/
COPY packages/ui/package.json packages/ui/

RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --ignore-scripts --filter server

COPY apps/server ./apps/server
COPY packages/access ./packages/access
COPY packages/auth ./packages/auth
COPY packages/calculators ./packages/calculators
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/desktop-bridge ./packages/desktop-bridge

RUN bun run --cwd packages/db env:generate \
	&& bun run --cwd apps/server env:generate \
	&& bun run --cwd apps/server build

FROM base AS runtime
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/desktop/package.json apps/desktop/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/access/package.json packages/access/
COPY packages/auth/package.json packages/auth/
COPY packages/calculators/package.json packages/calculators/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/desktop-bridge/package.json packages/desktop-bridge/
COPY packages/lattice-grid/package.json packages/lattice-grid/
COPY packages/ui/package.json packages/ui/

RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production --ignore-scripts --filter server

COPY --from=builder --chown=bun:bun /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=bun:bun /app/apps/server/src/env.ts ./apps/server/src/env.ts
COPY --chown=bun:bun apps/server/.env.schema ./apps/server/.env.schema
COPY --chown=bun:bun packages/db/src/migrations ./packages/db/src/migrations

WORKDIR /app/apps/server
USER bun
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
	CMD bun -e 'fetch("http://127.0.0.1:3000/api/health").then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["bun", "run", "dist/index.mjs"]
