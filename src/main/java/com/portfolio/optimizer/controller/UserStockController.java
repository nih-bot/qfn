package com.portfolio.optimizer.controller;

import com.portfolio.optimizer.dto.UserStockDto;
import com.portfolio.optimizer.service.UserStockService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 사용자 보유 종목 관리 컨트롤러
 * Dashboard에서 추가한 종목 저장/조회/삭제
 */
@RestController
@RequestMapping("/api/user-stocks")
@Slf4j
public class UserStockController {
    
    @Autowired
    private UserStockService userStockService;
    
    /**
     * 사용자의 모든 보유 종목 조회
     */
    @GetMapping
    public ResponseEntity<?> getUserStocks() {
        try {
            log.debug("[UserStockController] GET /api/user-stocks");
            List<UserStockDto> stocks = userStockService.getUserStocks();
            log.debug("[UserStockController] Returning {} stocks", stocks.size());
            return ResponseEntity.ok(stocks);
        } catch (RuntimeException e) {
            log.warn("[UserStockController] Failed to fetch user stocks: {}", e.getMessage());
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }
    
    /**
     * 종목 추가
     */
    @PostMapping
    public ResponseEntity<?> addStock(@RequestBody UserStockDto dto) {
        try {
            log.debug("[UserStockController] POST /api/user-stocks - ticker: {}", dto.getTicker());
            UserStockDto saved = userStockService.addStock(dto);
            log.info("[UserStockController] Stock added: {} id={}", saved.getTicker(), saved.getId());
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            log.error("[UserStockController] Failed to add stock: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    /**
     * 종목 삭제
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStock(@PathVariable Long id) {
        try {
            log.debug("[UserStockController] DELETE /api/user-stocks/{}", id);
            userStockService.deleteStock(id);
            log.info("[UserStockController] Stock deleted: id={}", id);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("[UserStockController] Failed to delete stock: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    /**
     * 모든 종목 삭제
     */
    @DeleteMapping
    public ResponseEntity<?> deleteAllStocks() {
        try {
            log.debug("[UserStockController] DELETE /api/user-stocks (all)");
            userStockService.deleteAllStocks();
            log.info("[UserStockController] All stocks deleted");
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("[UserStockController] Failed to delete all stocks: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
