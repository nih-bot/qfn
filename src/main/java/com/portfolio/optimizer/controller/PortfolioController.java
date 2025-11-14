package com.portfolio.optimizer.controller;

import com.portfolio.optimizer.dto.OptimizationRequest;
import com.portfolio.optimizer.model.OptimizationResult;
import com.portfolio.optimizer.service.OptimizationContextService;
import com.portfolio.optimizer.service.PortfolioService;
import com.portfolio.optimizer.service.PythonIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class PortfolioController {
    
    private final PortfolioService portfolioService;
    private final PythonIntegrationService pythonIntegrationService;
    private final OptimizationContextService optimizationContextService;
    
    @GetMapping("/stock-price/{symbol}")
    public ResponseEntity<Map<String, Object>> getStockPrice(@PathVariable String symbol) {
        log.info("Fetching stock price for: {}", symbol);
        try {
            Map<String, Object> stockData = pythonIntegrationService.fetchStockData(symbol, "1d");
            return ResponseEntity.ok(stockData);
        } catch (Exception e) {
            log.error("Error fetching stock price for: {}", symbol, e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    // stocks 테이블 제거로 인해 /api/portfolio/stocks 엔드포인트 삭제됨
    // 이제 /api/user-stocks API를 사용하여 보유 종목 관리
    
    @PostMapping("/optimize")
    public ResponseEntity<?> optimizePortfolio(
            @RequestBody OptimizationRequest request) {
        
        // Validate request
        if (request.getStocks() == null || request.getStocks().isEmpty()) {
            log.error("No stocks provided in optimization request");
            return ResponseEntity.badRequest().body(Map.of(
                "error", "종목을 먼저 추가해주세요.",
                "message", "최적화를 위해 최소 1개 이상의 종목이 필요합니다."
            ));
        }
        
        log.info("Received optimization request for {} stocks using method: HYBRID", request.getStocks().size());
        
        try {
            OptimizationResult result = portfolioService.optimizePortfolio(request, "HYBRID");
            
            // 최적화 결과를 세션에 저장 (챗봇이 참조할 수 있도록)
            String sessionId = request.getSessionId();
            if (sessionId != null && !sessionId.isEmpty()) {
                optimizationContextService.saveOptimizationResult(sessionId, result);
                log.info("Saved optimization result to context for session: {}", sessionId);
            }
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error optimizing portfolio", e);
            return ResponseEntity.status(500).body(Map.of(
                "error", "최적화 실패",
                "message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류가 발생했습니다.",
                "details", e.getClass().getSimpleName()
            ));
        }
    }
    
    // stocks 테이블 제거로 인해 DELETE /api/portfolio/stocks 엔드포인트 삭제됨
}
