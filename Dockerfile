# Multi-stage build for Spring Boot + React
FROM node:18-alpine AS frontend-build

# 프론트엔드 빌드
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
COPY src/ ./src/
RUN cd frontend && npm run build

# Java 애플리케이션 빌드
FROM gradle:8.4-jdk21 AS backend-build

WORKDIR /app

# 전체 프로젝트 복사
COPY . .

# 프론트엔드 빌드 결과 덮어쓰기
COPY --from=frontend-build /app/src/main/resources/static/ ./src/main/resources/static/

# gradlew 실행 권한 부여
RUN chmod +x ./gradlew

# Gradle 빌드 (시스템 gradle 사용, 프론트엔드 빌드 제외)
RUN gradle build -x test -x buildFrontend --no-daemon

# 실행 환경
FROM eclipse-temurin:21-jdk-jammy

# Python 설치 (주식 데이터 처리용)
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install yfinance pandas numpy requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# JAR 파일 복사
COPY --from=backend-build /app/build/libs/*.jar app.jar

# Python 스크립트 복사
COPY src/main/python/ ./src/main/python/

# 포트 노출
EXPOSE 8080

# 환경변수 설정
ENV SPRING_PROFILES_ACTIVE=render
ENV PYTHON_EXECUTABLE=python3

# Render 환경 대응
ENV JAVA_OPTS="-Xmx400m -Xms200m"

# 애플리케이션 실행
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]