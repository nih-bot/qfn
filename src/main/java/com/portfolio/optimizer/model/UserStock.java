package com.portfolio.optimizer.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 사용자가 Dashboard에서 추가한 보유 종목
 * 최적화 전 개인 포트폴리오 관리용
 */
@Entity
@Table(name = "user_stock")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStock {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(nullable = false, length = 40)
    private String ticker;
    
    @Column(nullable = false, length = 120)
    private String name;
    
    @Column(length = 10)
    private String currency; // KRW, USD
    
    @Builder.Default
    @Column(precision = 18, scale = 8)
    private BigDecimal quantity = BigDecimal.ZERO;
    
    @Builder.Default
    @Column(name = "purchase_price", precision = 18, scale = 2)
    private BigDecimal purchasePrice = BigDecimal.ZERO;
    
    @Column(name = "current_price", precision = 18, scale = 2)
    private BigDecimal currentPrice;
    
    @Column(name = "is_foreign")
    private Boolean isForeign;
    
    @CreationTimestamp
    @Column(name = "added_date", updatable = false)
    private LocalDateTime addedDate;
}
