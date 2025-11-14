# MariaDB 연동 테스트 가이드

## ✅ 현재 상태 확인

### 1. MariaDB 연결 확인
- **데이터베이스**: `qfn`
- **사용자**: `root`
- **포트**: `3306`
- **연결 상태**: ✅ 정상 연결됨

### 2. 테이블 구조

#### `portfolio` 테이블
```sql
- id (bigint, PK, AUTO_INCREMENT)
- user_id (bigint, FK) - 사용자 ID
- name (varchar 120) - 포트폴리오 이름
- base_currency (varchar 10) - 기본 통화 (기본값: KRW)
- total_budget (decimal 18,2) - 총 예산
- pinned_result_id (bigint) - 고정된 결과 ID
- created_at (datetime) - 생성일시
- updated_at (datetime) - 수정일시
```

#### `portfolio_asset` 테이블
```sql
- id (bigint, PK, AUTO_INCREMENT)
- portfolio_id (bigint, FK) - 포트폴리오 ID
- ticker (varchar 40) - 종목 코드 (예: 005930.KS, AAPL)
- display_name (varchar 120) - 종목 이름
- currency (varchar 10) - 통화 (KRW, USD)
- quantity (decimal 18,8) - 보유 수량
- purchase_price (decimal 18,2) - 매수가
- min_weight (decimal 9,6) - 최소 비중
- max_weight (decimal 9,6) - 최대 비중
- risk_weight (decimal 9,6) - 리스크 가중치
```

### 3. 현재 데이터

```
포트폴리오: 1개
자산: 5개 (삼성전자, 현대차, NVIDIA, 네이버, Apple)
주식: 267개
```

## 🧪 테스트 방법

### 방법 1: 실시간 모니터링 (권장)

1. **터미널 1**: 애플리케이션 실행 (이미 실행 중)
   ```powershell
   ./gradlew bootRun
   ```

2. **터미널 2**: 데이터베이스 모니터링
   ```powershell
   .\monitor_db.bat
   ```

3. **브라우저**: http://localhost:8080 접속
   - 로그인
   - 포트폴리오 최적화 메뉴로 이동
   - 종목 추가 및 최적화 실행
   - "포트폴리오 저장" 클릭

4. **결과 확인**: `monitor_db.bat`에서 실시간으로 데이터 확인

### 방법 2: SQL 직접 실행

종목 추가 전후로 다음 쿼리를 실행하여 비교:

```powershell
# 현재 데이터 확인
& "C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT * FROM portfolio_asset ORDER BY id DESC LIMIT 10;"

# 총 개수 확인
& "C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT COUNT(*) FROM portfolio_asset;"
```

### 방법 3: 애플리케이션 로그 확인

서버 콘솔에서 다음 로그를 확인:

```
✅ Hibernate SQL 로그 활성화됨 (spring.jpa.show-sql=true)
✅ 포맷팅된 SQL 출력 (spring.jpa.properties.hibernate.format_sql=true)
✅ DEBUG 레벨 로그 (logging.level.com.portfolio=DEBUG)
```

종목 추가 시 다음과 같은 로그가 출력됩니다:

```sql
Hibernate: 
    insert 
    into
        portfolio_asset
        (currency, display_name, max_weight, min_weight, portfolio_id, purchase_price, quantity, risk_weight, ticker) 
    values
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

## 📋 테스트 시나리오

### 시나리오 1: 새 포트폴리오 생성 + 종목 추가

1. **로그인**
   - 기존 계정으로 로그인 또는 회원가입

2. **포트폴리오 최적화 페이지 이동**
   - 사이드바에서 "Portfolio Optimizer" 클릭

3. **종목 추가**
   - 검색창에 종목명 입력 (예: "삼성전자", "Tesla")
   - 종목 선택
   - 수량 입력
   - "Add to Portfolio" 클릭

4. **최적화 실행**
   - 여러 종목 추가
   - "Optimize Portfolio" 버튼 클릭
   - 최적화 결과 확인

5. **포트폴리오 저장**
   - "Save Portfolio" 버튼 클릭
   - 포트폴리오 이름 입력
   - 저장 확인

6. **데이터베이스 확인**
   ```powershell
   & "C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT id, name, total_budget, created_at FROM portfolio ORDER BY id DESC LIMIT 5;"
   
   & "C:\Program Files\MariaDB 12.0\bin\mysql.exe" -u root -p1234 -e "USE qfn; SELECT id, portfolio_id, ticker, display_name, quantity, purchase_price FROM portfolio_asset ORDER BY id DESC LIMIT 10;"
   ```

### 시나리오 2: 마이페이지에서 확인

1. **마이페이지(대시보드) 이동**
   - 사이드바에서 "Dashboard" 클릭

2. **저장된 포트폴리오 확인**
   - "내 포트폴리오" 섹션에서 저장된 포트폴리오 목록 확인
   - 각 포트폴리오의 종목 리스트 확인

3. **데이터 일치 확인**
   - 화면에 표시된 데이터와 DB의 데이터가 일치하는지 확인

## 🔍 예상되는 데이터 흐름

### 1. 프론트엔드 (PortfolioOptimizer.jsx)
```javascript
// 종목 추가 시
const portfolioData = {
  name: "내 포트폴리오",
  baseCurrency: "KRW",
  totalBudget: 10000000,
  assets: [
    {
      ticker: "005930.KS",
      displayName: "삼성전자",
      currency: "KRW",
      quantity: 10.0,
      purchasePrice: 70000.00
    }
  ]
};

// API 호출
axios.post('/api/portfolios', portfolioData)
```

### 2. 백엔드 (PortfolioManagementController.java)
```java
@PostMapping
public ResponseEntity<?> createPortfolio(@RequestBody PortfolioDto dto) {
    // PortfolioManagementService로 전달
}
```

### 3. 서비스 레이어 (PortfolioManagementService.java)
```java
@Transactional
public PortfolioDto createPortfolio(PortfolioDto dto) {
    // 1. Portfolio 엔티티 생성 및 저장
    Portfolio portfolio = Portfolio.builder()
        .user(user)
        .name(dto.getName())
        .build();
    Portfolio saved = portfolioRepository.save(portfolio);
    
    // 2. PortfolioAsset 엔티티들 생성 및 저장
    for (PortfolioAssetDto assetDto : dto.getAssets()) {
        PortfolioAsset asset = PortfolioAsset.builder()
            .portfolio(saved)
            .ticker(assetDto.getTicker())
            .quantity(assetDto.getQuantity())
            .build();
        assetRepository.save(asset);
    }
}
```

### 4. 데이터베이스
```sql
-- Portfolio 테이블에 INSERT
INSERT INTO portfolio (user_id, name, base_currency, total_budget, created_at, updated_at)
VALUES (1, '내 포트폴리오', 'KRW', 10000000.00, NOW(), NOW());

-- Portfolio_asset 테이블에 INSERT
INSERT INTO portfolio_asset (portfolio_id, ticker, display_name, currency, quantity, purchase_price)
VALUES (2, '005930.KS', '삼성전자', 'KRW', 10.0, 70000.00);
```

## 🛠️ 유용한 SQL 쿼리

### 최근 추가된 포트폴리오 확인
```sql
SELECT 
    p.id,
    p.name,
    p.base_currency,
    p.total_budget,
    p.created_at,
    u.username
FROM portfolio p
JOIN user u ON p.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 5;
```

### 포트폴리오별 종목 현황
```sql
SELECT 
    p.id as portfolio_id,
    p.name as portfolio_name,
    pa.ticker,
    pa.display_name,
    pa.quantity,
    pa.purchase_price,
    (pa.quantity * pa.purchase_price) as total_value
FROM portfolio p
LEFT JOIN portfolio_asset pa ON p.id = pa.portfolio_id
ORDER BY p.id DESC, pa.id;
```

### 사용자별 포트폴리오 통계
```sql
SELECT 
    u.username,
    COUNT(DISTINCT p.id) as portfolio_count,
    COUNT(pa.id) as total_assets,
    SUM(pa.quantity * pa.purchase_price) as total_value
FROM user u
LEFT JOIN portfolio p ON u.id = p.user_id
LEFT JOIN portfolio_asset pa ON p.id = pa.portfolio_id
GROUP BY u.id, u.username;
```

### 최근 24시간 내 생성된 데이터
```sql
SELECT 
    'Portfolio' as type,
    COUNT(*) as count
FROM portfolio
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
UNION ALL
SELECT 
    'Asset' as type,
    COUNT(*) as count
FROM portfolio_asset pa
JOIN portfolio p ON pa.portfolio_id = p.id
WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

## ✅ 체크리스트

테스트 완료 시 다음 항목을 확인하세요:

- [ ] 서버가 정상적으로 실행되었는가?
- [ ] MariaDB에 연결되었는가?
- [ ] 로그인이 정상적으로 작동하는가?
- [ ] 종목 검색이 작동하는가?
- [ ] 종목 추가가 작동하는가?
- [ ] 최적화 실행이 작동하는가?
- [ ] 포트폴리오 저장 시 `portfolio` 테이블에 데이터가 추가되는가?
- [ ] 포트폴리오 저장 시 `portfolio_asset` 테이블에 데이터가 추가되는가?
- [ ] 마이페이지에서 저장된 포트폴리오가 표시되는가?
- [ ] DB의 데이터와 화면의 데이터가 일치하는가?

## 🚨 문제 해결

### 문제 1: 데이터가 저장되지 않음
- **확인사항**: 로그인 상태 확인 (인증 필요)
- **해결방법**: 로그인 후 다시 시도

### 문제 2: Hibernate SQL 로그가 보이지 않음
- **확인사항**: `application.properties` 설정
- **해결방법**: `spring.jpa.show-sql=true` 확인

### 문제 3: 500 에러 발생
- **확인사항**: 서버 콘솔 로그 확인
- **해결방법**: 스택 트레이스 확인 후 원인 분석

### 문제 4: MariaDB 연결 실패
- **확인사항**: MariaDB 서비스 실행 여부
- **해결방법**: 
  ```powershell
  # MariaDB 서비스 시작
  net start MariaDB
  ```

## 📊 모니터링 도구

### 1. monitor_db.bat
실시간으로 DB 상태를 모니터링하는 배치 파일

### 2. H2 Console (옵션)
브라우저에서 DB를 직접 조회할 수 있는 웹 인터페이스
- URL: http://localhost:8080/h2-console
- JDBC URL: `jdbc:mariadb://localhost/qfn`
- 사용자: `root`
- 비밀번호: `1234`

## 🎉 테스트 완료 후

테스트가 성공적으로 완료되면:

1. 결과를 스크린샷으로 저장
2. DB 데이터를 백업 (옵션)
3. 성능 이슈가 있다면 인덱스 추가 검토
4. 로그 레벨을 INFO로 변경 (프로덕션 배포 시)

---

**작성일**: 2025-11-11  
**버전**: 1.0  
**MariaDB 버전**: 12.0  
**Spring Boot 버전**: 3.1.5
