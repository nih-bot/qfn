# Render 무료 배포 가이드

## 🎨 Render.com 배포

### 장점
✅ **완전 무료**
✅ PostgreSQL 무료 제공
✅ 자동 SSL 인증서
✅ GitHub 자동 배포
✅ 커스텀 도메인 무료

### 단점
❌ 15분 비활성 시 슬립 모드
❌ 슬립에서 깨어나는데 30초-1분 소요

### 배포 방법
1. **Render.com 회원가입**
2. **Web Service 생성**
   - Repository: GitHub 연결
   - Branch: main
   - Build Command: `./gradlew build`
   - Start Command: `java -Dserver.port=$PORT -Dspring.profiles.active=render -jar build/libs/qfn-portfolio-optimizer.jar`

3. **PostgreSQL 추가**
   - Dashboard → New → PostgreSQL
   - 자동으로 DATABASE_URL 환경변수 생성

4. **환경 변수 설정**
   ```
   SPRING_PROFILES_ACTIVE=render
   JWT_SECRET=your-secret-key-here
   ```

### 비용: 완전 무료

## 🔥 Firebase + Cloud Run (Google)

### 장점
✅ Google 인프라
✅ 높은 성능
✅ 글로벌 CDN
✅ 상당한 무료 사용량

### 배포 방법
1. **Firebase 프로젝트 생성**
2. **Cloud SQL (MySQL) 설정**
3. **Cloud Run 배포**

## 🚀 Fly.io

### 장점
✅ 월 5달러 크레딧
✅ Docker 기반
✅ 전 세계 엣지 로케이션
✅ 매우 빠른 성능

### 단점
❌ Docker 지식 필요
❌ 약간 복잡한 설정

## 추천 순서

1. **Railway** - 가장 쉽고 안정적
2. **Render** - 완전 무료 (슬립 모드 감안)
3. **Fly.io** - 고성능 필요시
4. **Firebase** - Google 생태계 선호시