# 🎨 Render 배포 완전 가이드

## 📋 1단계: GitHub 준비

### 1.1 코드 커밋 및 푸시
```bash
git add .
git commit -m "Render 배포 설정 추가"
git push origin main
```

### 1.2 리포지토리 Public 확인
- GitHub에서 리포지토리가 Public인지 확인
- Private 리포지토리는 Render 유료 플랜 필요

## 🚀 2단계: Render 계정 생성 및 서비스 배포

### 2.1 Render 계정 생성
1. **https://render.com** 접속
2. **"Get Started for Free"** 클릭
3. **GitHub으로 로그인** (추천)

### 2.2 PostgreSQL 데이터베이스 생성
1. Render 대시보드에서 **"New +"** 클릭
2. **"PostgreSQL"** 선택
3. 설정:
   ```
   Name: qfn-postgres
   Database: qfn
   User: qfnuser
   Region: Oregon (US West) - 가장 빠름
   Plan: Free
   ```
4. **"Create Database"** 클릭
5. **생성된 데이터베이스의 "Internal Database URL" 복사** (나중에 사용)

### 2.3 Web Service 생성
1. **"New +"** → **"Web Service"** 클릭
2. **"Build and deploy from a Git repository"** 선택
3. GitHub 리포지토리 연결:
   ```
   Repository: KDH-0309/QFN
   Branch: main
   ```
4. 배포 설정:
   ```
   Name: qfn-portfolio-optimizer
   Region: Oregon (US West)
   Branch: main
   Runtime: Java
   Build Command: ./render-build.sh
   Start Command: ./render-start.sh
   Plan: Free
   ```

## ⚙️ 3단계: 환경 변수 설정

### 3.1 필수 환경 변수
Web Service 설정에서 **"Environment"** 탭으로 이동 후 추가:

```bash
# Spring 프로파일
SPRING_PROFILES_ACTIVE=render

# 데이터베이스 연결 (2.2에서 복사한 URL 사용)
DATABASE_URL=postgresql://qfnuser:password@hostname:port/qfn

# JWT 시크릿 (32자 이상의 랜덤 문자열)
JWT_SECRET=render-qfn-super-secret-jwt-key-for-production-minimum-256-bits

# JVM 메모리 설정 (무료 티어 512MB 제한)
JAVA_TOOL_OPTIONS=-Xmx400m -Xms200m

# Python 설정
PYTHONUNBUFFERED=1
```

### 3.2 선택적 환경 변수
```bash
# CORS 설정 (필요시)
CORS_ALLOWED_ORIGINS=https://your-custom-domain.com

# 로그 레벨
LOG_LEVEL=INFO
```

## 🔧 4단계: 배포 및 확인

### 4.1 배포 실행
1. **"Create Web Service"** 클릭
2. 자동 빌드 및 배포 시작 (5-10분 소요)
3. **로그 확인**: "Logs" 탭에서 빌드 진행 상황 모니터링

### 4.2 배포 성공 확인
배포가 성공하면 다음 URL에서 접근 가능:
```
https://qfn-portfolio-optimizer.onrender.com
```

### 4.3 헬스체크 확인
```
https://qfn-portfolio-optimizer.onrender.com/actuator/health
```
응답 예시:
```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP"
    }
  }
}
```

## 🎯 5단계: 도메인 설정 (선택사항)

### 5.1 커스텀 도메인 연결
1. Web Service → **"Settings"** → **"Custom Domains"**
2. **"Add Custom Domain"** 클릭
3. 도메인 입력 (예: `qfn.yourdomain.com`)
4. DNS 설정: CNAME 레코드 추가
   ```
   qfn.yourdomain.com → qfn-portfolio-optimizer.onrender.com
   ```

### 5.2 SSL 인증서
- Render가 자동으로 Let's Encrypt SSL 인증서 발급
- HTTPS 자동 적용

## ⚡ 성능 최적화 팁

### 6.1 슬립 모드 최소화
- 무료 티어는 15분 비활성 후 슬립 모드
- 깨어나는데 30초-1분 소요
- **해결책**: 외부 모니터링 서비스 사용 (UptimeRobot 등)

### 6.2 메모리 최적화
```bash
# JVM 플래그 추가
JAVA_TOOL_OPTIONS=-Xmx400m -Xms200m -XX:+UseG1GC -XX:MaxGCPauseMillis=100
```

## 🔍 트러블슈팅

### 일반적인 문제들

**1. 빌드 실패**
- 로그에서 오류 메시지 확인
- `render-build.sh` 권한 확인: `chmod +x render-build.sh`

**2. 데이터베이스 연결 실패**
- `DATABASE_URL` 환경변수 확인
- PostgreSQL 서비스 상태 확인

**3. 메모리 부족**
- JVM 메모리 설정 확인
- `JAVA_TOOL_OPTIONS` 환경변수 추가

**4. Python 패키지 오류**
- `requirements.txt` 파일 추가 고려
- 빌드 로그에서 pip 설치 상태 확인

## 💰 비용 정보

### Render 무료 티어
- ✅ **Web Service**: 750시간/월 (충분함)
- ✅ **PostgreSQL**: 1GB 스토리지, 100 connection
- ✅ **SSL 인증서**: 무료
- ✅ **커스텀 도메인**: 무료
- ❌ **슬립 모드**: 15분 비활성 후

### 업그레이드 시 ($7/월)
- ✅ **24/7 활성 상태**
- ✅ **더 많은 메모리**
- ✅ **우선 지원**

## 🎉 완료!

배포가 완료되면:
1. **웹사이트**: `https://qfn-portfolio-optimizer.onrender.com`
2. **자동 배포**: GitHub push 시 자동 재배포
3. **모니터링**: Render 대시보드에서 로그 및 메트릭 확인

성공적인 배포를 위해 각 단계를 차근차근 따라가세요!