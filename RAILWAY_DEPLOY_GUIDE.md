# Railway 무료 배포 가이드

## 🚂 Railway 배포 (추천)

### 1. 사전 준비
- GitHub 계정
- Railway 계정 생성 (https://railway.app)
- GitHub에 프로젝트 푸시

### 2. Railway 프로젝트 생성
1. Railway.app 로그인
2. "New Project" → "Deploy from GitHub repo"
3. 리포지토리 선택
4. 자동 배포 시작

### 3. 환경 변수 설정 (Railway 대시보드에서)
```
SPRING_PROFILES_ACTIVE=railway
RAILWAY_STATIC_URL=true
```

### 4. 데이터베이스 추가
1. Railway 프로젝트에서 "Add Service"
2. "PostgreSQL" 선택 (MySQL도 가능)
3. 자동으로 연결됨

### 5. 도메인 설정
- 무료 서브도메인 자동 제공: `your-app.railway.app`
- 커스텀 도메인도 무료 연결 가능

## 비용
- **무료**: 월 5달러 크레딧 (충분함)
- **Sleep 모드 없음** (Render와 차이점)
- **PostgreSQL 무료** 포함

## 장점
✅ 자동 배포 (GitHub push 시)
✅ 무료 데이터베이스
✅ 무료 SSL 인증서
✅ Sleep 모드 없음
✅ 로그 모니터링 제공