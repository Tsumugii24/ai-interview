#!/usr/bin/env bash
set -euo pipefail

# 在 Ubuntu 上一键：添加官方源、安装 Caddy、部署同目录下的 Caddyfile、开机自启并启动。
# 用法（在服务器上，进入本脚本所在目录）：
#   1) cp Caddyfile.example Caddyfile
#   2) 编辑 Caddyfile：将占位域名、占位端口 port 改为真实值
#   3) bash install.sh
# 若当前用户非 root，脚本会通过 sudo 重新执行自身。

if [[ "${EUID}" -ne 0 ]]; then
	exec sudo /usr/bin/env bash "$0" "$@"
fi

# 忽略整行注释与空行后，若仍存在示例占位则返回 0（供 if 判断），否则返回 1
caddyfile_has_unresolved_placeholders() {
	local f="$1"
	local body bad=0
	body=$(grep -v '^[[:space:]]*#' "$f" | grep -v '^[[:space:]]*$' || true)
	if echo "$body" | grep -qE '^[[:space:]]*your-domain\.example[[:space:]]*\{'; then
		echo "错误: ${f} 仍使用占位域名 your-domain.example，请改为你的真实域名。" >&2
		bad=1
	fi
	if echo "$body" | grep -qE 'reverse_proxy[[:space:]]+[^[:space:]]+:port([[:space:]]|$)'; then
		echo "错误: ${f} 中 reverse_proxy 仍使用占位端口 port，请改为应用监听的数字端口（如 5050）。" >&2
		bad=1
	fi
	if [[ "$bad" -eq 1 ]]; then
		return 0
	fi
	return 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CADDYFILE_EXAMPLE="${SCRIPT_DIR}/Caddyfile.example"
CADDYFILE_SRC="${SCRIPT_DIR}/Caddyfile"
CADDYFILE_DST="/etc/caddy/Caddyfile"

if [[ ! -f "${CADDYFILE_EXAMPLE}" ]]; then
	echo "错误: 同目录下未找到 ${CADDYFILE_EXAMPLE}" >&2
	exit 1
fi

if [[ ! -f "${CADDYFILE_SRC}" ]]; then
	cp "${CADDYFILE_EXAMPLE}" "${CADDYFILE_SRC}"
	echo "已从 Caddyfile.example 生成 Caddyfile，请编辑占位域名与 reverse_proxy 中的 port 后再运行本脚本。"
	exit 1
fi

if caddyfile_has_unresolved_placeholders "${CADDYFILE_SRC}"; then
	exit 1
fi

if [[ -f /etc/os-release ]]; then
	# shellcheck source=/dev/null
	source /etc/os-release
	if [[ "${ID:-}" != "ubuntu" ]]; then
		echo "警告: 当前系统为 ${ID:-unknown}，本脚本仅针对 Ubuntu 编写与测试。" >&2
	fi
fi

echo "==> 安装依赖并添加 Caddy 官方软件源..."
apt-get update
apt-get install -y ca-certificates debian-keyring debian-archive-keyring apt-transport-https curl gnupg

install -d -m 0755 /usr/share/keyrings
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
chmod 644 /etc/apt/sources.list.d/caddy-stable.list

apt-get update
apt-get install -y caddy

echo "==> 部署 Caddyfile -> ${CADDYFILE_DST}"
cp -f "${CADDYFILE_SRC}" "${CADDYFILE_DST}"
chmod 644 "${CADDYFILE_DST}"

if caddyfile_has_unresolved_placeholders "${CADDYFILE_DST}"; then
	exit 1
fi

echo "==> 校验配置"
caddy validate --config "${CADDYFILE_DST}"

echo "==> 启用并启动 Caddy（开机自启）"
systemctl enable caddy
systemctl restart caddy
sleep 1
systemctl --no-pager --full status caddy || true

echo ""
echo "完成。"
