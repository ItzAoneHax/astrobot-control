#!/usr/bin/env bash
# 发布 Web 层热更新:打包 app/assets/www → GitHub Release(稳定地址 releases/latest/download/*)
# 用法:scripts/publish-web.sh "更新说明"
# 发布后 App 端自动拉取(启动时静默检查有 12h 节流;设置页可手动检查)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

REPO="ItzAoneHax/astrobot-control"
NOTE="${1:-例行更新}"
NOTE="${NOTE//\"/\'}"   # 去双引号,防止破坏 manifest JSON

VF="$ROOT/web-version"   # 版本计数随仓库走(已入库),克隆到别处也能正确续号
mkdir -p "$ROOT/build"
V=$(( $(cat "$VF" 2>/dev/null || echo 0) + 1 ))

STAGE="$ROOT/build/web-pub"
rm -rf "$STAGE" && mkdir -p "$STAGE/www"
cp -r "$ROOT/app/assets/www/." "$STAGE/www/"
printf '{"version": %s, "note": "%s", "zip": "www.zip"}\n' "$V" "$NOTE" > "$STAGE/www/manifest.json"
cp "$STAGE/www/manifest.json" "$STAGE/manifest.json"

# Git Bash 无 zip 命令,用 jar 代替(-M 跳过元数据;压缩以减小下载体积)
rm -f "$STAGE/www.zip"
jar cfM "$STAGE/www.zip" -C "$STAGE/www" .

echo "── 发布 Web v$V:$NOTE(www.zip $(du -h "$STAGE/www.zip" | cut -f1))"
gh release create "web-v$V" "$STAGE/www.zip" "$STAGE/manifest.json" \
  --repo "$REPO" --title "Web v$V" --notes "$NOTE"
echo "$V" > "$VF"
echo "✅ 已发布:https://github.com/$REPO/releases/tag/web-v$V"
