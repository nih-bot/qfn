package com.portfolio.optimizer.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 로그인 페이지 및 정적 리소스는 인증 없이 접근 허용
                        .requestMatchers(
                                new AntPathRequestMatcher("/"),
                                new AntPathRequestMatcher("/index.html"),
                                new AntPathRequestMatcher("/assets/**"),
                                new AntPathRequestMatcher("/*.ico"),
                                new AntPathRequestMatcher("/*.png"),
                                new AntPathRequestMatcher("/*.svg"),
                                new AntPathRequestMatcher("/login"),
                                new AntPathRequestMatcher("/signup"),
                                new AntPathRequestMatcher("/dashboard"),
                                new AntPathRequestMatcher("/portfolio"),
                                new AntPathRequestMatcher("/settings"),
                                new AntPathRequestMatcher("/find-username"),
                                new AntPathRequestMatcher("/find-password")
                        ).permitAll()
                        .requestMatchers(
                                new AntPathRequestMatcher("/api/auth/**"), // 인증(로그인/회원가입) API
                                new AntPathRequestMatcher("/api/exchange/**"), // 환율 API
                                new AntPathRequestMatcher("/api/stocks/search"), // 종목 검색 API
                                new AntPathRequestMatcher("/api/stocks/price/**"), // 실시간 주가 조회 API
                                new AntPathRequestMatcher("/api/stocks/popular") // 인기 종목 API
                        ).permitAll()
                        .requestMatchers(
                                new AntPathRequestMatcher("/api/user/**"), // 사용자 관련 API (인증 필요)
                                new AntPathRequestMatcher("/api/user-stocks/**"), // 사용자 보유종목 API (인증 필요)
                                new AntPathRequestMatcher("/api/portfolios/**"), // 포트폴리오 API (인증 필요)
                                new AntPathRequestMatcher("/api/portfolio/**") // 포트폴리오 최적화 API (인증 필요)
                        ).authenticated()
                        .anyRequest().authenticated() // 나머지 모든 요청은 인증 필요
                )
                .headers(headers -> headers.frameOptions(frame -> frame.disable()))
                .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:8080", "http://localhost:5173", "http://localhost:3001"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
