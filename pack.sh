#!/bin/bash
# FocusFlow 打包脚本
# 把 dist/ 目录打包成 .upx 文件，可直接在 uTools 中双击安装

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
OUTPUT_DIR="$PROJECT_ROOT"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ dist 目录不存在，请先执行 npm run build"
  exit 1
fi

if [ ! -f "$DIST_DIR/plugin.json" ]; then
  echo "❌ dist/plugin.json 不存在"
  exit 1
fi

# 从 plugin.json 读取版本号
VERSION=$(grep -o '"version"[^,]*' "$DIST_DIR/plugin.json" | head -1 | sed 's/.*"\([^"]*\)"/\1/' | tail -1)
[ -z "$VERSION" ] && VERSION="1.0.0"

OUTPUT_FILE="$OUTPUT_DIR/focusflow-v$VERSION.upx"

echo "📦 打包 FocusFlow v$VERSION..."
echo "源目录: $DIST_DIR"
echo "输出: $OUTPUT_FILE"

# .upx 实际上是 tar.gz，需要把 dist 内部内容放在根，不要包含 dist 这一层
cd "$DIST_DIR"
tar -czf "$OUTPUT_FILE" .

echo "✅ 打包完成: $OUTPUT_FILE"
echo ""
echo "👉 下一步:"
echo "1. 在 uTools 开发者中心，删除当前的「本地路径」插件"
echo "2. 双击打开 $OUTPUT_FILE"
echo "3. uTools 会弹出安装对话框，确认安装"
echo "4. 安装后用关键词「开始记录」试试，onPluginEnter 就会正常触发"
