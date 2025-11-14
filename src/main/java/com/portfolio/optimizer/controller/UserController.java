package com.portfolio.optimizer.controller;

import com.portfolio.optimizer.dto.UserStockDto;
import com.portfolio.optimizer.service.UserStockService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 사용자 관련 API 컨트롤러 (프론트엔드 호환성을 위한 추가 엔드포인트)
 * /api/user/stocks 경로를 처리
 */
@RestController
@RequestMapping("/api/user")
@Slf4j
public class UserController {
    
    @Autowired
    private UserStockService userStockService;
    
    /**
     * 사용자 보유 종목 조회 (프론트엔드 호환성)
     */
    @GetMapping("/stocks")
    public ResponseEntity<?> getUserStocks() {
        try {
            log.debug("[UserController] GET /api/user/stocks");
            List<UserStockDto> stocks = userStockService.getUserStocks();
            log.debug("[UserController] Returning {} stocks", stocks.size());
            return ResponseEntity.ok(stocks);
        } catch (RuntimeException e) {
            log.warn("[UserController] Failed to fetch user stocks: {}", e.getMessage());
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }
    
    /**
     * 사용자 보유 종목 추가 (프론트엔드 호환성)
     */
    @PostMapping("/stocks")
    public ResponseEntity<?> addUserStock(@RequestBody UserStockDto dto) {
        try {
            log.debug("[UserController] POST /api/user/stocks - ticker: {}", dto.getTicker());
            UserStockDto saved = userStockService.addStock(dto);
            log.info("[UserController] Stock added: {} id={}", saved.getTicker(), saved.getId());
            return ResponseEntity.ok(saved);
        } catch (RuntimeException e) {
            log.error("[UserController] Failed to add stock: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    /**
     * 사용자 보유 종목 삭제 (프론트엔드 호환성)
     */
    @DeleteMapping("/stocks/{id}")
    public ResponseEntity<?> deleteUserStock(@PathVariable Long id) {
        try {
            log.debug("[UserController] DELETE /api/user/stocks/{}", id);
            userStockService.deleteStock(id);
            log.info("[UserController] Stock deleted: id={}", id);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("[UserController] Failed to delete stock: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    /**
     * 사용자 보유 종목 전체 삭제 (프론트엔드 호환성)
     */
    @DeleteMapping("/stocks")
    public ResponseEntity<?> deleteAllUserStocks() {
        try {
            log.debug("[UserController] DELETE /api/user/stocks (all)");
            userStockService.deleteAllStocks();
            log.info("[UserController] All stocks deleted");
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            log.error("[UserController] Failed to delete all stocks: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}