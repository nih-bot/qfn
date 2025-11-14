#!/bin/bash
# Render 시작 스크립트

echo "Java 버전 확인:"
java -version

echo "Python 패키지 확인:"
python3 -c "import yfinance, pandas, numpy; print('Python packages OK')"

echo "JAR 파일 실행:"
java -Dserver.port=$PORT -Dspring.profiles.active=render -jar build/libs/qfn-portfolio-optimizer.jar