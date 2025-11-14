package com.portfolio.optimizer.repository;

import com.portfolio.optimizer.model.UserStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserStockRepository extends JpaRepository<UserStock, Long> {
    
    /**
     * 사용자의 모든 보유 종목 조회 (최신순)
     */
    List<UserStock> findByUserIdOrderByAddedDateDesc(Long userId);
    
    /**
     * 사용자의 특정 종목 조회
     */
    List<UserStock> findByUserIdAndTicker(Long userId, String ticker);
    
    /**
     * 사용자의 모든 종목 삭제
     */
    void deleteByUserId(Long userId);
}
