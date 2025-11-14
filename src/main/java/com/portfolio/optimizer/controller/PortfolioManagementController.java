package com.portfolio.optimizer.controller;

import com.portfolio.optimizer.dto.PortfolioDto;
import com.portfolio.optimizer.service.PortfolioManagementService;
import org.springframework.beans.factory.annotation.Autowired;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/portfolios")
@Slf4j
public class PortfolioManagementController {

    @Autowired
    private PortfolioManagementService portfolioService;

    @GetMapping
    public ResponseEntity<?> getUserPortfolios() {
        try {
            long t0 = System.currentTimeMillis();
            log.debug("[PortfolioManagementController] GET /api/portfolios invoked");
            List<PortfolioDto> portfolios = portfolioService.getUserPortfolios();
            log.debug("[PortfolioManagementController] Returning {} portfolios in {} ms", portfolios.size(), System.currentTimeMillis() - t0);
            return ResponseEntity.ok(portfolios);
        } catch (RuntimeException e) {
            String msg = e.getMessage() == null ? "Unknown error" : e.getMessage();
            log.warn("Failed to fetch user portfolios: {}", msg);
            if (msg.contains("Not authenticated") || msg.contains("Unauthorized")) {
                return ResponseEntity.status(401).body(msg);
            }
            return ResponseEntity.status(500).body(msg);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<PortfolioDto> getPortfolio(@PathVariable Long id) {
        try {
            PortfolioDto portfolio = portfolioService.getPortfolio(id);
            return ResponseEntity.ok(portfolio);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> createPortfolio(@RequestBody PortfolioDto dto) {
        try {
            PortfolioDto created = portfolioService.createPortfolio(dto);
            return ResponseEntity.ok(created);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePortfolio(@PathVariable Long id) {
        try {
            portfolioService.deletePortfolio(id);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
