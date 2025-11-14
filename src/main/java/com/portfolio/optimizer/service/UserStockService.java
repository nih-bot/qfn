package com.portfolio.optimizer.service;

import com.portfolio.optimizer.dto.UserStockDto;
import com.portfolio.optimizer.model.User;
import com.portfolio.optimizer.model.UserStock;
import com.portfolio.optimizer.repository.UserStockRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 사용자 보유 종목 관리 서비스
 * Dashboard에서 추가한 종목을 DB에 저장/조회
 */
@Service
@Slf4j
public class UserStockService {
    
    @Autowired
    private UserStockRepository userStockRepository;
    
    @Autowired
    private AuthService authService;
    
    /**
     * 사용자의 모든 보유 종목 조회
     */
    @Transactional(readOnly = true)
    public List<UserStockDto> getUserStocks() {
        User user = authService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Not authenticated");
        }
        
        List<UserStock> stocks = userStockRepository.findByUserIdOrderByAddedDateDesc(user.getId());
        log.debug("[UserStockService] User {} has {} stocks", user.getId(), stocks.size());
        
        return stocks.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    /**
     * 종목 추가 (동일 종목이면 수량/평균가 업데이트)
     */
    @Transactional
    public UserStockDto addStock(UserStockDto dto) {
        User user = authService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Not authenticated");
        }
        
        log.info("[UserStockService] Adding stock: {} ({}), qty: {}, price: {}", 
                dto.getTicker(), dto.getName(), dto.getQuantity(), dto.getPurchasePrice());
        
        // 이미 동일 종목이 있는지 확인
        List<UserStock> existingStocks = userStockRepository.findByUserIdAndTicker(user.getId(), dto.getTicker());
        
        if (!existingStocks.isEmpty()) {
            // 기존 종목이 있으면 평균 매수가로 업데이트
            UserStock existing = existingStocks.get(0);
            
            BigDecimal existingQty = existing.getQuantity();
            BigDecimal existingPrice = existing.getPurchasePrice();
            BigDecimal newQty = dto.getQuantity();
            BigDecimal newPrice = dto.getPurchasePrice();
            
            // 총 수량
            BigDecimal totalQty = existingQty.add(newQty);
            
            // 평균 매수가 = (기존금액 + 신규금액) / 총수량
            BigDecimal totalAmount = existingQty.multiply(existingPrice).add(newQty.multiply(newPrice));
            BigDecimal avgPrice = totalAmount.divide(totalQty, 2, BigDecimal.ROUND_HALF_UP);
            
            existing.setQuantity(totalQty);
            existing.setPurchasePrice(avgPrice);
            existing.setCurrentPrice(dto.getCurrentPrice());
            
            UserStock saved = userStockRepository.save(existing);
            log.info("[UserStockService] Updated existing stock: {} qty={}, avgPrice={}", 
                    dto.getTicker(), totalQty, avgPrice);
            
            return convertToDto(saved);
        } else {
            // 새 종목 추가
            UserStock stock = UserStock.builder()
                    .user(user)
                    .ticker(dto.getTicker())
                    .name(dto.getName())
                    .currency(dto.getCurrency())
                    .quantity(dto.getQuantity())
                    .purchasePrice(dto.getPurchasePrice())
                    .currentPrice(dto.getCurrentPrice())
                    .isForeign(dto.getIsForeign())
                    .build();
            
            UserStock saved = userStockRepository.save(stock);
            log.info("[UserStockService] Added new stock: {} id={}", dto.getTicker(), saved.getId());
            
            return convertToDto(saved);
        }
    }
    
    /**
     * 종목 삭제
     */
    @Transactional
    public void deleteStock(Long stockId) {
        User user = authService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Not authenticated");
        }
        
        UserStock stock = userStockRepository.findById(stockId)
                .orElseThrow(() -> new RuntimeException("Stock not found"));
        
        if (!stock.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Unauthorized");
        }
        
        userStockRepository.delete(stock);
        log.info("[UserStockService] Deleted stock: {} id={}", stock.getTicker(), stockId);
    }
    
    /**
     * 모든 종목 삭제
     */
    @Transactional
    public void deleteAllStocks() {
        User user = authService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Not authenticated");
        }
        
        userStockRepository.deleteByUserId(user.getId());
        log.info("[UserStockService] Deleted all stocks for user {}", user.getId());
    }
    
    private UserStockDto convertToDto(UserStock stock) {
        return UserStockDto.builder()
                .id(stock.getId())
                .ticker(stock.getTicker())
                .name(stock.getName())
                .currency(stock.getCurrency())
                .quantity(stock.getQuantity())
                .purchasePrice(stock.getPurchasePrice())
                .currentPrice(stock.getCurrentPrice())
                .isForeign(stock.getIsForeign())
                .addedDate(stock.getAddedDate())
                .build();
    }
}
