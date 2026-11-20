#!/usr/bin/env bash
# 文件意义：一键将后端代码同步到远程 Docker 服务器并重建启动整套后端服务。
# 创建时间：2026-11-20；修改时间：2026-11-20。
# 用法：bun run deploy:server（可通过 REMOTE_HOST / REMOTE_DIR 覆盖目标服务器与目录）。

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-leonwillow@100.100.1.3}"
REMOTE_DIR="${REMOTE_DIR:-~/aidesk-server}"
BUILD_PROXY="${BUILD_PROXY:-http://127.0.0.1:7890}"

echo "==> 同步后端构建上下文到 ${REMOTE_HOST}:${REMOTE_DIR}"
ssh -o BatchMode=yes "${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"

rsync -az --delete \
	--filter='P .env.server' \
	--include='.env.server.example' \
	--include='.env.schema' \
	--include='**/.env.schema' \
	--exclude='.git' \
	--exclude='node_modules' \
	--exclude='**/node_modules' \
	--exclude='dist' \
	--exclude='**/dist' \
	--exclude='.turbo' \
	--exclude='.env' \
	--exclude='.env.*' \
	--exclude='apps/web/src' \
	--exclude='apps/web/public' \
	--exclude='apps/web/test' \
	--exclude='apps/desktop/src' \
	--exclude='apps/desktop/test' \
	--exclude='apps/desktop/resources' \
	--exclude='packages/ui/src' \
	--exclude='packages/ui/test' \
	--exclude='packages/lattice-grid/src' \
	--exclude='packages/lattice-grid/test' \
	--exclude='docs' \
	./ "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> 在远程构建服务端镜像并拉起 Compose 服务"
ssh -o BatchMode=yes "${REMOTE_HOST}" "bash -s" <<EOF
set -euo pipefail
cd ${REMOTE_DIR}
if [ ! -f .env.server ]; then
	echo "错误：远程目录缺少 .env.server，请参考 .env.server.example 创建后再部署。" >&2
	exit 1
fi

BUILD_ARGS=()
if [ -n "${BUILD_PROXY}" ] && ss -tln 2>/dev/null | grep -q ":7890 "; then
	BUILD_ARGS+=(--network=host --build-arg "HTTP_PROXY=${BUILD_PROXY}" --build-arg "HTTPS_PROXY=${BUILD_PROXY}" --build-arg "NO_PROXY=localhost,127.0.0.1")
fi

docker build "\${BUILD_ARGS[@]}" -t leonwillow-aidesk-server:latest -f apps/server/Dockerfile .
docker compose --env-file .env.server -f docker-compose.server.yml up -d --no-build --remove-orphans
docker compose --env-file .env.server -f docker-compose.server.yml ps
EOF

echo "==> 检查远程健康状态"
HEALTH_HOST="${REMOTE_HOST#*@}"
for i in $(seq 1 30); do
	if curl -fsS --max-time 3 "http://${HEALTH_HOST}:3000/api/health"; then
		echo ""
		echo "远程后端部署成功：http://${HEALTH_HOST}:3000"
		exit 0
	fi
	sleep 1
done

echo "错误：等待远程健康检查超时，请查看 docker logs aidesk-server。" >&2
exit 1
