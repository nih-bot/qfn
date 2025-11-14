# Render 환경변수 설정 가이드

## 1. Render Dashboard에서 환경변수 설정

### 필수 환경변수:

```bash
DATABASE_URL=postgres://username:password@hostname:port/database_name
JWT_SECRET=qfn-super-secret-jwt-key-256-bits-long-for-production
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 선택적 환경변수:

```bash
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
CORS_ALLOWED_ORIGINS=https://*.onrender.com
```

## 2. 환경변수 값 획득 방법

### DATABASE_URL
1. Render → New + → PostgreSQL 생성
2. Database Name: `qfn-portfolio-db`
3. 생성 완료 후 → Connections → **Internal Database URL** 복사
4. 형식: `postgres://user:password@hostname:port/dbname`

### JWT_SECRET
- 32자 이상의 안전한 랜덤 문자열
- 온라인 JWT Secret Generator 사용 권장
- 예: `qfn-portfolio-jwt-secret-key-very-long-and-secure-256-bits`

### GEMINI_API_KEY
1. https://makersuite.google.com/app/apikey 접속
2. Google 계정 로그인
3. "Create API Key" 클릭
4. 생성된 API 키 복사

### MAIL_USERNAME & MAIL_PASSWORD (선택사항)
1. Gmail 계정 → 계정 관리 → 보안
2. 2단계 인증 활성화
3. 앱 패스워드 생성
4. 생성된 16자리 패스워드 사용

## 3. Render에서 환경변수 추가 방법

1. Render 웹 서비스 → Settings → Environment
2. "Add Environment Variable" 클릭
3. Key와 Value 입력
4. "Save Changes" 클릭
5. 자동으로 서비스 재배포됨

## 4. 환경변수 확인 방법

배포 로그에서 다음과 같이 표시되면 성공:
```
2025-11-14T03:27:11.234Z INFO 7 --- [main] : The following 1 profile is active: "render"
```

## 5. 트러블슈팅

### 데이터베이스 연결 실패
- DATABASE_URL 형식 확인 (`postgres://`로 시작)
- Internal Database URL 사용 (External URL 대신)
- 데이터베이스 서비스 상태 확인

### AI 챗봇 오류
- GEMINI_API_KEY 유효성 확인
- Google AI Studio에서 API 키 활성화 상태 확인

### 이메일 기능 오류
- Gmail 2단계 인증 활성화 확인
- 앱 패스워드 정확성 확인
- MAIL_USERNAME에 전체 이메일 주소 사용