#!/bin/bash
# Render 빌드 스크립트

echo "=== Frontend 빌드 시작 ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 정적 파일 복사 ==="
mkdir -p src/main/resources/static
cp -r frontend/dist/* src/main/resources/static/

echo "=== Python 패키지 설치 ==="
pip install -r requirements.txt

echo "=== Backend 빌드 ==="
chmod +x ./gradlew
./gradlew build --no-daemon

echo "=== 빌드 완료 ==="