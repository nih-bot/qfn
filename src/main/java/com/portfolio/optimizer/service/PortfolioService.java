package com.portfolio.optimizer.service;

import com.portfolio.optimizer.dto.OptimizationRequest;
import com.portfolio.optimizer.dto.StockRequest;
import com.portfolio.optimizer.model.OptimizationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 포트폴리오 최적화 서비스
 * stocks 테이블 제거로 인해 메모리에서만 처리
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {
    
    private final PythonIntegrationService pythonIntegrationService;
    
    // stocks 테이블 제거로 인해 saveStocks, getStocksBySession 메서드 삭제됨
    // 최적화는 OptimizationRequest에서 직접 받은 데이터로 처리
    
    public OptimizationResult optimizePortfolio(OptimizationRequest request, String method) {
        String sessionId = UUID.randomUUID().toString();
        
        log.info("Starting portfolio optimization for session: {} using method: {}", sessionId, method);
        
        // stocks 테이블 없이 request 데이터로 직접 최적화
        OptimizationResult result = pythonIntegrationService.optimizePortfolio(request, sessionId, method);
        
        log.info("Portfolio optimization completed for session: {}", sessionId);
        
        return result;
    }
}
