package com.portfolio.optimizer.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")  // PostgreSQL에서 'user'는 예약어이므로 'users'로 변경
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    
    @Column(nullable = false, length = 255)
    private String password;
    
    @Column(nullable = false, unique = true, length = 255)
    private String email;
    
    @Column(nullable = false, length = 100)
    private String nickname;
    
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(length = 20)  // PostgreSQL 호환을 위해 단순 VARCHAR로 변경
    private UserRole role = UserRole.USER;
    
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(length = 20)  // PostgreSQL 호환을 위해 단순 VARCHAR로 변경
    private UserStatus status = UserStatus.ACTIVE;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    public enum UserRole {
        USER, ADMIN
    }
    
    public enum UserStatus {
        ACTIVE, LOCKED, DELETED
    }
}
