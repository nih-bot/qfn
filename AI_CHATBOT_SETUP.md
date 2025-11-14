# 🤖 AI 챗봇 설정 가이드 (OpenAI GPT 연동)

## 📌 개요

QuantaFolio Navigator의 챗봇은 두 가지 모드로 작동합니다:

1. **규칙 기반 챗봇** (기본): OpenAI API 키 없이도 작동하는 기본 질의응답
2. **AI 챗봇 (OpenAI GPT)**: API 키 설정 시 자연스러운 대화형 AI 챗봇

---

## 🚀 OpenAI API 설정 방법

### 1단계: OpenAI API 키 발급

1. [OpenAI 플랫폼](https://platform.openai.com/)에 가입 또는 로그인
2. **API Keys** 메뉴로 이동
3. **Create new secret key** 클릭
4. API 키 복사 (한 번만 표시되므로 안전하게 보관!)

### 2단계: application.properties 수정

`src/main/resources/application.properties` 파일을 열고 다음 부분을 수정:

```properties
# OpenAI Configuration (ChatGPT)
openai.api.key=YOUR_OPENAI_API_KEY_HERE  # ← 여기에 발급받은 API 키 붙여넣기
openai.model=gpt-3.5-turbo               # 모델 선택 (gpt-3.5-turbo 또는 gpt-4)
openai.max.tokens=500                    # 최대 토큰 수 (답변 길이)
openai.temperature=0.7                   # 창의성 (0.0~1.0, 높을수록 창의적)
```

**예시:**
```properties
openai.api.key=sk-proj-abc123def456ghi789jkl...  # 실제 API 키
openai.model=gpt-3.5-turbo
openai.max.tokens=500
openai.temperature=0.7
```

### 3단계: 서버 재시작

```bash
# Windows
.\gradlew.bat bootRun

# Linux/Mac
./gradlew bootRun
```

---

## ⚙️ 설정 옵션 설명

| 옵션 | 설명 | 권장값 |
|------|------|--------|
| `openai.api.key` | OpenAI API 키 | (발급받은 키) |
| `openai.model` | 사용할 GPT 모델 | `gpt-3.5-turbo` (빠르고 저렴) 또는 `gpt-4` (더 정확) |
| `openai.max.tokens` | 최대 응답 길이 | `500` (간결한 답변) ~ `1000` (상세 답변) |
| `openai.temperature` | 창의성/일관성 | `0.7` (균형) ~ `0.3` (일관성 중시) |

---

## 💰 비용 안내

- **GPT-3.5-Turbo**: 입력 $0.0015/1K tokens, 출력 $0.002/1K tokens
- **GPT-4**: 입력 $0.03/1K tokens, 출력 $0.06/1K tokens

**예상 비용 (GPT-3.5-Turbo 기준):**
- 1회 대화: 약 500 tokens → **$0.001 (약 1.3원)**
- 100회 대화: **$0.10 (약 130원)**
- 1,000회 대화: **$1.00 (약 1,300원)**

---

## 🔍 동작 확인

### API 키 설정 전 (규칙 기반 챗봇)
```
사용자: QAOA가 뭐야?
챗봇: QAOA(Quantum Approximate Optimization Algorithm)는...
```

### API 키 설정 후 (AI 챗봇)
```
사용자: QAOA가 뭐야?
챗봇: 💡 QAOA는 양자 컴퓨팅을 활용한 최적화 알고리즘입니다!
      포트폴리오 최적화에서 기존 방법보다 더 효율적으로...
```

---

## 🛠️ 문제 해결

### API 키가 작동하지 않아요
- API 키가 `sk-`로 시작하는지 확인
- OpenAI 대시보드에서 사용량 확인 (크레딧 부족?)
- 서버 재시작 했는지 확인

### 응답이 너무 느려요
- `openai.model`을 `gpt-3.5-turbo`로 변경 (gpt-4는 느림)
- `openai.max.tokens`를 `300`으로 줄이기

### 응답이 엉뚱해요
- `openai.temperature`를 `0.5` 이하로 낮추기 (일관성 향상)
- 시스템 프롬프트 수정 (`OpenAIService.java`)

---

## 📝 API 키 없이 사용하기

API 키를 설정하지 않아도 **규칙 기반 챗봇**이 자동으로 작동합니다:

```properties
# 기본값 유지
openai.api.key=YOUR_OPENAI_API_KEY_HERE
```

이 경우 다음 질문들에 답변 가능:
- "QAOA가 뭐야?"
- "샤프 비율이 뭐야?"
- "분산 투자란?"
- "예상 수익률이 이렇게 나온 이유는?"

---

## 🎯 고급 설정 (개발자용)

### 시스템 프롬프트 커스터마이징

`OpenAIService.java` 파일의 `chatAsInvestmentAdvisor` 메서드에서 AI의 역할과 답변 스타일을 조정할 수 있습니다:

```java
String systemPrompt = """
    당신은 전문적인 포트폴리오 투자 상담사입니다.
    
    역할:
    - 사용자의 투자 관련 질문에 친절하고 정확하게 답변합니다
    - 포트폴리오 최적화, 리스크 관리에 대한 조언 제공
    
    답변 스타일:
    - 간결하고 명확하게 (300자 이내)
    - 이모지 적절히 사용 (📊, 💡, ⚠️)
    - 존댓말 사용
    """;
```

---

## 📚 참고 자료

- [OpenAI API 문서](https://platform.openai.com/docs/introduction)
- [GPT 모델 가격표](https://openai.com/pricing)
- [API 사용량 대시보드](https://platform.openai.com/usage)

---

**작성일**: 2025-11-10  
**작성자**: KDH-0309  
**프로젝트**: QuantaFolio Navigator
