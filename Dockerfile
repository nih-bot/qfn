# Multi-stage build for Spring Boot + React
FROM node:18-alpine AS frontend-build

# 프론트엔드 빌드
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Java 애플리케이션 빌드
FROM gradle:8.4-jdk21 AS backend-build

WORKDIR /app
COPY . .
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static/

# Gradle 빌드
RUN gradle build --no-daemon

# 실행 환경
FROM openjdk:21-jdk-slim

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
ENV SPRING_PROFILES_ACTIVE=azure
ENV PYTHON_EXECUTABLE=python3

# 애플리케이션 실행
ENTRYPOINT ["java", "-jar", "app.jar"]