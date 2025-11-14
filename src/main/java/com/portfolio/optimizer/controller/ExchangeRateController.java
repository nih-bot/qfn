package com.portfolio.optimizer.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/exchange")
@CrossOrigin(origins = "*")
@Slf4j
public class ExchangeRateController {

    private static final Map<String, ExchangeRateCache> rateCache = new ConcurrentHashMap<>();
    private final RestTemplate restTemplate = new RestTemplate();

    // 성공한 실시간 조회는 짧게(15분), 오류/기본값 캐시는 더 짧게(3분) 유지하여 갱신 기회 확보
    private static final long SUCCESS_CACHE_MS = 15 * 60 * 1000; // 15분
    private static final long ERROR_CACHE_MS = 3 * 60 * 1000;    // 3분

    private static class ExchangeRateCache {
        double rate;
        long timestamp;
        boolean success;      // 실시간 조회 성공 여부
        String source;        // "yahoo" 또는 "default" 또는 "cached-error"
        long ttl;             // 캐시 유효 기간

        ExchangeRateCache(double rate, boolean success, String source, long ttl) {
            this.rate = rate;
            this.success = success;
            this.source = source;
            this.ttl = ttl;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isValid() {
            return (System.currentTimeMillis() - timestamp) < ttl;
        }
    }

    @GetMapping("/rate/{from}/{to}")
    public Map<String, Object> getExchangeRate(
            @PathVariable String from,
            @PathVariable String to) {
        
        log.info("=== 환율 조회 ===");
        log.info("{} -> {} 환율", from, to);

        String cacheKey = from + "_" + to;
        
        // 캐시 확인 (별도의 메타데이터 포함 반환)
        ExchangeRateCache cached = rateCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            log.info("✅ 캐시에서 환율 반환: {} (source={}, success={})", cached.rate, cached.source, cached.success);
            return createResponse(cached.success, cached.rate, from, to, "캐시 조회", true, cached.source, cached.timestamp);
        }

        try {
            // Yahoo Finance API를 통한 환율 조회
            String ticker = from + to + "=X"; // 예: USDKRW=X
            String url = String.format(
                "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1d",
                ticker
            );

            HttpHeaders headers = new HttpHeaders();
            // 일부 제공자는 User-Agent 없으면 403/429 빈도가 증가함
            headers.add("User-Agent", "Mozilla/5.0 (PortfolioOptimizer/1.0)");
            headers.add("Accept", "application/json");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> yahooResponse = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            Map<String, Object> response = yahooResponse.getBody();
            
            if (response != null && response.containsKey("chart")) {
                Map<String, Object> chart = (Map<String, Object>) response.get("chart");
                
                if (chart.containsKey("result")) {
                    java.util.List<Map<String, Object>> results = 
                        (java.util.List<Map<String, Object>>) chart.get("result");
                    
                    if (!results.isEmpty()) {
                        Map<String, Object> result = results.get(0);
                        Map<String, Object> meta = (Map<String, Object>) result.get("meta");
                        
                        if (meta != null && meta.containsKey("regularMarketPrice")) {
                            Object priceObj = meta.get("regularMarketPrice");
                            double rate = 0.0;
                            
                            if (priceObj instanceof Number) {
                                rate = ((Number) priceObj).doubleValue();
                            }
                            
                            if (rate > 0) {
                                // 캐시에 저장
                                rateCache.put(cacheKey, new ExchangeRateCache(rate, true, "yahoo", SUCCESS_CACHE_MS));
                                log.info("✅ 환율 조회 성공: {} (15분 캐시)", rate);
                                return createResponse(true, rate, from, to, "실시간 조회", false, "yahoo", System.currentTimeMillis());
                            }
                        }
                    }
                }
            }

            // 실패 시 기본 환율 반환 (USD/KRW 약 1,300원)
            log.warn("⚠️ 환율 조회 실패, 기본값 사용");
            double defaultRate = getDefaultRate(from, to);
            // 실패한 경우 더 짧은 TTL로 캐시하여 재시도 기회 확보
            rateCache.put(cacheKey, new ExchangeRateCache(defaultRate, false, "default", ERROR_CACHE_MS));
            return createResponse(false, defaultRate, from, to, "기본값 사용 (조회 실패)", false, "default", System.currentTimeMillis());

        } catch (Exception e) {
            log.warn("❌ 환율 조회 오류: {}", e.getMessage());
            
            // 429 에러 시 더 긴 캐시 시간 적용 (1시간)
            if (e.getMessage() != null && e.getMessage().contains("429")) {
                log.warn("⚠️ Too Many Requests 발생 - 1시간 동안 캐시 사용");
            }
            
            // API 실패 시에도 과도한 재시도를 막기 위해 캐시 타임스탬프를 갱신
            if (cached != null) {
                // 기존 캐시가 있었다면 그것을 그대로 짧은 TTL로 재등록 후 반환
                cached.timestamp = System.currentTimeMillis();
                cached.ttl = cached.success ? SUCCESS_CACHE_MS : ERROR_CACHE_MS; // TTL 재설정
                log.warn("⚠️ API 실패, 기존 캐시 반환: {} (source={}, success={})", cached.rate, cached.source, cached.success);
                return createResponse(cached.success, cached.rate, from, to, "기존 캐시 반환 (API 오류)", true, cached.source, cached.timestamp);
            }

            double defaultRate = getDefaultRate(from, to);
            rateCache.put(cacheKey, new ExchangeRateCache(defaultRate, false, "default", ERROR_CACHE_MS));
            log.info("📌 기본 환율({}) {}ms 캐시 저장", defaultRate, ERROR_CACHE_MS);
            return createResponse(false, defaultRate, from, to, "오류 발생, 기본값 사용", false, "default", System.currentTimeMillis());
        }
    }

    private double getDefaultRate(String from, String to) {
        // USD to KRW 기본 환율 (2025-11-09 기준)
        if ("USD".equals(from) && "KRW".equals(to)) {
            return 1456.0;
        }
        // KRW to USD
        if ("KRW".equals(from) && "USD".equals(to)) {
            return 0.000687; // 1/1456
        }
        return 1.0;
    }

    private Map<String, Object> createResponse(boolean success, double rate,
                                               String from, String to, String message,
                                               boolean cached, String source, long cachedTimestamp) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        response.put("rate", rate);
        response.put("from", from);
        response.put("to", to);
        response.put("message", message);
        response.put("timestamp", System.currentTimeMillis()); // 응답 생성 시각
        response.put("cached", cached);
        response.put("source", source);
        response.put("cachedTimestamp", cachedTimestamp);
        response.put("ageSeconds", (System.currentTimeMillis() - cachedTimestamp) / 1000.0);
        return response;
    }

    @GetMapping("/usd-krw")
    public Map<String, Object> getUsdKrwRate() {
        return getExchangeRate("USD", "KRW");
    }
}
