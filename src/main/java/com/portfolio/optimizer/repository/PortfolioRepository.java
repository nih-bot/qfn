package com.portfolio.optimizer.repository;

import com.portfolio.optimizer.model.Portfolio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioRepository extends JpaRepository<Portfolio, Long> {
    
    List<Portfolio> findByUserId(Long userId);
    
    List<Portfolio> findByUserIdOrderByCreatedAtDesc(Long userId);

    // Fetch-join to eagerly load assets to avoid LazyInitialization issues
    @Query("SELECT DISTINCT p FROM Portfolio p LEFT JOIN FETCH p.assets WHERE p.user.id = :userId ORDER BY p.createdAt DESC")
    List<Portfolio> findWithAssetsByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    @Query("SELECT p FROM Portfolio p LEFT JOIN FETCH p.assets WHERE p.id = :id")
    Optional<Portfolio> findWithAssetsById(@Param("id") Long id);
}
