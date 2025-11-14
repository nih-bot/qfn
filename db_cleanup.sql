-- ==========================================
-- 데이터베이스 정리 및 새 테이블 생성
-- ==========================================

USE qfn;

-- 1. 사용하지 않는 테이블 삭제 (외래 키 순서 고려)
DROP TABLE IF EXISTS optimization_weight;
DROP TABLE IF EXISTS plot_artifact;
DROP TABLE IF EXISTS optimization_result;
DROP TABLE IF EXISTS optimization_run;
DROP TABLE IF EXISTS stocks; -- 레거시 테이블 (user_stock으로 대체됨)

-- 2. user_stock 테이블 확인 (Hibernate가 자동 생성)
-- 이미 존재하면 생략됨
CREATE TABLE IF NOT EXISTS user_stock (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    ticker VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    currency VARCHAR(10),
    quantity DECIMAL(18, 8) DEFAULT 0,
    purchase_price DECIMAL(18, 2) DEFAULT 0,
    current_price DECIMAL(18, 2),
    is_foreign BOOLEAN,
    added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_user_ticker (user_id, ticker),
    INDEX idx_added_date (added_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 테이블 목록 확인
SHOW TABLES;

-- 4. user_stock 테이블 구조 확인
DESCRIBE user_stock;

-- 5. 각 테이블의 데이터 개수
SELECT 'user' as table_name, COUNT(*) as count FROM user
UNION ALL SELECT 'user_stock', COUNT(*) FROM user_stock
UNION ALL SELECT 'portfolio', COUNT(*) FROM portfolio
UNION ALL SELECT 'portfolio_asset', COUNT(*) FROM portfolio_asset
UNION ALL SELECT 'stocks', COUNT(*) FROM stocks;
