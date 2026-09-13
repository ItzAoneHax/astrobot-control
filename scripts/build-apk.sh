#!/usr/bin/env bash
# 手工构建 AstroBot Control APK(无需 Gradle / Android Studio)
# 依赖:JDK 21 + .sdk/{bt,pf} + zip
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

BT="$ROOT/.sdk/bt/android-14"                # build-tools 34
JAR="$ROOT/.sdk/pf/android-35/android.jar"   # platform 35
APP="$ROOT/app"
OUT="$ROOT/build"
BTJ="$BT/lib/d8.jar"
SIGNJ="$BT/lib/apksigner.jar"

rm -rf "$OUT"; mkdir -p "$OUT/classes"

echo "── [1/6] 编译资源 (aapt2 compile)"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$OUT/res.zip"

echo "── [2/6] 链接资源与清单 (aapt2 link)"
"$BT/aapt2.exe" link \
  -o "$OUT/base.apk" \
  -I "$JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  --auto-add-overlay \
  "$OUT/res.zip"

echo "── [3/6] 编译 Java (javac)"
javac --release 8 -Xlint:-options -nowarn \
  -classpath "$JAR" \
  -d "$OUT/classes" \
  "$APP/java/cn/iepose/astrbot/MainActivity.java"

echo "── [4/6] 转 DEX + 打包 assets (d8 + zip)"
# d8 对含空格的路径有 bug:在无空格暂存目录中执行
STAGE="/c/astrobot_d8_stage"
rm -rf "$STAGE" && mkdir -p "$STAGE/classes"
cp -r "$OUT/classes/." "$STAGE/classes/"
cd "$STAGE"
# 注:build-tools 34 的 d8 (R8 8.2.2-dev) 加 --release 会触发内部 NPE,debug dex 足够
java -cp "$BTJ" com.android.tools.r8.D8 \
  --lib "$JAR" \
  --output "$STAGE" \
  $(find classes -name '*.class')
cd "$ROOT"
cp "$STAGE/classes.dex" "$OUT/classes.dex"

cd "$OUT"
rm -rf pkg && mkdir pkg && cd pkg
unzip -qo ../base.apk
cp ../classes.dex .
cp -r "$APP/assets" .
# 用 jar 打包(Git Bash 无 zip 命令);-0 全存储,保证 resources.arsc 不被压缩
jar cfM0 ../unsigned.apk . && cd "$ROOT"
rm -rf "$STAGE"

echo "── [5/6] 对齐 (zipalign)"
"$BT/zipalign.exe" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "── [6/6] 签名 (apksigner)"
KS="$ROOT/astrobot-release.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias astbot \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass astbot2024 -keypass astbot2024 \
    -dname "CN=AstroBot Control, OU=Dev, O=iepose, C=CN" >/dev/null 2>&1
  echo "  已生成签名密钥 astrobot-release.keystore (口令 astbot2024)"
fi
java -jar "$SIGNJ" sign \
  --ks "$KS" --ks-pass pass:astbot2024 --key-pass pass:astbot2024 \
  --out "$ROOT/AstroBot-Control.apk" \
  "$OUT/aligned.apk"

ls -la "$ROOT/AstroBot-Control.apk"
java -jar "$SIGNJ" verify --print-certs "$ROOT/AstroBot-Control.apk" | head -5
echo "✅ 构建完成 → AstroBot-Control.apk"
