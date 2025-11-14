package com.portfolio.optimizer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class GeminiService {

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-1.5-flash}")
    private String model;

    @Value("${gemini.max.tokens:500}")
    private int maxTokens;

    @Value("${gemini.temperature:0.7}")
    private double temperature;
    
    @Value("${gemini.rate.limit.enabled:false}")
    private boolean rateLimitEnabled;
    
    @Value("${gemini.rate.limit.requests.per.minute:60}")
    private int requestsPerMinute;

    private final RestTemplate restTemplate = new RestTemplate();
    
    // 요청 카운터 (분당 제한)
    private int requestCount = 0;
    private long lastResetTime = System.currentTimeMillis();

    /**
     * Gemini API 사용 가능 여부 확인
     */
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isEmpty() && !apiKey.equals("YOUR_GEMINI_API_KEY_HERE");
    }

    /**
     * Google Gemini API 호출
     * @param userMessage 사용자 메시지
     * @param systemPrompt 시스템 프롬프트 (AI 역할 정의)
     * @return AI 응답
     */
    public String chat(String userMessage, String systemPrompt) {
        if (!isAvailable()) {
            log.warn("Gemini API key not configured");
            return null;
        }
        
        // 요청 제한 확인 (선택적)
        if (rateLimitEnabled && !checkRateLimit()) {
            log.warn("⚠️ Rate limit exceeded. Please try again later.");
            return null;
        }

        try {
            // Gemini API URL (API 키를 쿼리 파라미터로 전달)
            String apiUrl = String.format(
                "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                model, apiKey
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Gemini API 요청 형식
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", List.of(
                Map.of(
                    "parts", List.of(
                        Map.of("text", systemPrompt + "\n\n사용자 질문: " + userMessage)
                    )
                )
            ));
            requestBody.put("generationConfig", Map.of(
                "temperature", temperature,
                "maxOutputTokens", maxTokens
            ));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            log.info("🤖 Calling Gemini API: model={}, maxTokens={}", model, maxTokens);
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = restTemplate.exchange(
                apiUrl,
                HttpMethod.POST,
                entity,
                Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> body = response.getBody();
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> firstCandidate = candidates.get(0);
                    @SuppressWarnings("unchecked")
                    Map<String, Object> content = (Map<String, Object>) firstCandidate.get("content");
                    @SuppressWarnings("unchecked")
                    List<Map<String, String>> parts = (List<Map<String, String>>) content.get("parts");
                    
                    if (parts != null && !parts.isEmpty()) {
                        String text = parts.get(0).get("text");
                        log.info("✅ Gemini response received: {} chars", text.length());
                        return text;
                    }
                }
            }

            log.warn("⚠️ Gemini API returned empty response");
            return null;

        } catch (Exception e) {
            log.error("❌ Gemini API call failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 포트폴리오 투자 전문가로서 대화
     */
    public String chatAsInvestmentAdvisor(String userMessage, String portfolioContext) {
        String systemPrompt = """
            당신은 전문적인 포트폴리오 투자 상담사입니다.
            
            역할:
            - 사용자의 투자 관련 질문에 친절하고 정확하게 답변합니다
            - 포트폴리오 최적화, 리스크 관리, 자산 배분에 대한 조언을 제공합니다
            - 금융 용어를 쉽게 설명하고 구체적인 예시를 들어 설명합니다
            
            답변 스타일:
            - 간결하고 명확하게 (300자 이내)
            - 이모지를 적절히 사용 (📊, 💡, ⚠️ 등)
            - 존댓말 사용
            - 투자는 본인 책임임을 명시
            
            현재 포트폴리오 컨텍스트:
            %s
            
            주의사항:
            - 특정 종목을 강력히 추천하지 마세요
            - 과거 수익률이 미래 수익을 보장하지 않음을 강조하세요
            - 투자 결정은 본인의 책임임을 알려주세요
            """.formatted(portfolioContext != null ? portfolioContext : "컨텍스트 없음");

        return chat(userMessage, systemPrompt);
    }
    
    /**
     * 요청 제한 확인 (분당 60회 제한)
     */
    private synchronized boolean checkRateLimit() {
        long currentTime = System.currentTimeMillis();
        
        // 1분 경과 시 카운터 리셋
        if (currentTime - lastResetTime > 60000) {
            requestCount = 0;
            lastResetTime = currentTime;
        }
        
        // 제한 초과 확인
        if (requestCount >= requestsPerMinute) {
            log.warn("⚠️ Rate limit exceeded: {}/{} requests in the last minute", 
                requestCount, requestsPerMinute);
            return false;
        }
        
        requestCount++;
        log.debug("API request count: {}/{}", requestCount, requestsPerMinute);
        return true;
    }
}
