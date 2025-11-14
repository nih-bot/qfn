# 📁 QFN 프로젝트 파일 구조

## 전체 구조 다이어그램

```mermaid
graph TD
    ROOT[stock-portfolio-optimizer 📦]
    
    ROOT --> FRONTEND[frontend/ 🎨]
    ROOT --> BACKEND[src/ ☕]
    ROOT --> BUILD[build/ 🔨]
    ROOT --> GRADLE[gradle/ ⚙️]
    ROOT --> DOCS[docs/ 📚]
    ROOT --> CONFIG[설정 파일]
    
    %% Frontend
    FRONTEND --> FRONTEND_SRC[src/]
    FRONTEND --> FRONTEND_PUBLIC[public/]
    FRONTEND --> FRONTEND_CONFIG[설정 파일]
    
    FRONTEND_SRC --> COMPONENTS[components/]
    FRONTEND_SRC --> CONTEXTS[contexts/]
    FRONTEND_SRC --> UTILS[utils/]
    FRONTEND_SRC --> APP[App.jsx]
    
    COMPONENTS --> LOGIN[Login.jsx]
    COMPONENTS --> SIGNUP[Signup.jsx]
    COMPONENTS --> DASHBOARD[Dashboard.jsx]
    COMPONENTS --> PORTFOLIO[PortfolioOptimizer.jsx]
    COMPONENTS --> CHATBOT[Chatbot.jsx]
    COMPONENTS --> HEADER[Header.jsx]
    COMPONENTS --> SIDEBAR[Sidebar.jsx]
    
    CONTEXTS --> AUTH[AuthContext.jsx]
    CONTEXTS --> THEME[ThemeContext.jsx]
    CONTEXTS --> LANG[LanguageContext.jsx]
    
    UTILS --> I18N[i18n.js]
    
    %% Backend
    BACKEND --> JAVA[java/]
    BACKEND --> PYTHON[python/]
    BACKEND --> RESOURCES[resources/]
    
    JAVA --> PORTFOLIO_PKG[com/portfolio/optimizer/]
    
    PORTFOLIO_PKG --> CONTROLLER[controller/]
    PORTFOLIO_PKG --> SERVICE[service/]
    PORTFOLIO_PKG --> MODEL[model/]
    PORTFOLIO_PKG --> REPOSITORY[repository/]
    PORTFOLIO_PKG --> CONFIG_PKG[config/]
    PORTFOLIO_PKG --> SECURITY[security/]
    
    CONTROLLER --> USER_CTRL[UserController]
    CONTROLLER --> PORT_CTRL[PortfolioController]
    CONTROLLER --> CHAT_CTRL[ChatbotController]
    CONTROLLER --> EXCHANGE_CTRL[ExchangeRateController]
    
    SERVICE --> USER_SVC[UserService]
    SERVICE --> PORT_SVC[PortfolioService]
    SERVICE --> CHAT_SVC[ChatbotService]
    SERVICE --> GEMINI_SVC[GeminiService]
    SERVICE --> PYTHON_SVC[PythonIntegrationService]
    
    MODEL --> USER_MODEL[User]
    MODEL --> PORT_MODEL[Portfolio]
    MODEL --> STOCK_MODEL[Stock]
    MODEL --> OPT_MODEL[OptimizationResult]
    
    PYTHON --> OPT_PY[optimize_portfolio.py]
    PYTHON --> FETCH_PY[fetch_stock_data.py]
    PYTHON --> EXCHANGE_PY[exchange_rate_config.py]
    PYTHON --> REQ[requirements.txt]
    
    RESOURCES --> APP_PROP[application.properties]
    RESOURCES --> STATIC[static/]
    
    %% Config Files
    CONFIG --> POM[pom.xml]
    CONFIG --> GRADLE_BUILD[build.gradle]
    CONFIG --> APP_PROP_ROOT[application.properties]
    CONFIG --> README_FILE[README.md]
    
    %% Docs
    DOCS --> PRESENTATION[presentation-outline.md]
    
    style ROOT fill:#e1f5ff
    style FRONTEND fill:#fff4e1
    style BACKEND fill:#e8f5e9
    style PYTHON fill:#f3e5f5
    style COMPONENTS fill:#ffe0b2
    style SERVICE fill:#c8e6c9
    style CONTROLLER fill:#b2dfdb
```

## 상세 계층 구조

```mermaid
graph LR
    subgraph "Frontend Layer 🎨"
        UI[React Components]
        CTX[Context API]
        API_CALL[Axios API Calls]
    end
    
    subgraph "Backend Layer ☕"
        REST[REST Controllers]
        BIZ[Business Services]
        DATA[JPA Repositories]
        DB[(MariaDB)]
    end
    
    subgraph "AI/Quantum Layer 🔬"
        PYTHON_SVC[PythonIntegrationService]
        QAOA[QAOA Algorithm]
        YFINANCE[yfinance API]
        GEMINI[Gemini AI]
    end
    
    UI -->|HTTP/JSON| REST
    REST --> BIZ
    BIZ --> DATA
    DATA --> DB
    BIZ -->|Process.exec| PYTHON_SVC
    PYTHON_SVC --> QAOA
    PYTHON_SVC --> YFINANCE
    BIZ --> GEMINI
    
    style UI fill:#fff4e1
    style REST fill:#e1f5ff
    style BIZ fill:#c8e6c9
    style PYTHON_SVC fill:#f3e5f5
    style QAOA fill:#ffcdd2
    style GEMINI fill:#b39ddb
```

## 주요 파일별 역할

```mermaid
mindmap
  root((QFN Project))
    Frontend
      UI Components
        Login/Signup
        Dashboard
        Portfolio Optimizer
        Chatbot
      State Management
        Auth Context
        Theme Context
        Language Context
      Build Tools
        Vite
        Tailwind CSS
    Backend
      Controllers
        User API
        Portfolio API
        Chatbot API
        Exchange Rate API
      Services
        Business Logic
        Python Integration
        Gemini AI
      Models
        User Entity
        Portfolio Entity
        Stock Entity
      Security
        JWT Authentication
        Spring Security
    Python/AI
      QAOA Optimization
        Qiskit
        COBYLA Optimizer
      Stock Data
        yfinance
        Yahoo Finance API
      Exchange Rate
        Currency Conversion
    Database
      MariaDB
        User Data
        Portfolio History
        Stock Data
    Configuration
      application.properties
      pom.xml
      build.gradle
```

## 핵심 데이터 흐름

```mermaid
sequenceDiagram
    participant User as 👤 사용자
    participant React as React UI
    participant Spring as Spring Boot
    participant Python as Python/QAOA
    participant DB as MariaDB
    participant Yahoo as Yahoo Finance
    participant Gemini as Gemini AI
    
    User->>React: 1. 종목 선택 & 최적화 요청
    React->>Spring: 2. POST /api/portfolio/optimize
    Spring->>DB: 3. 종목 정보 저장
    Spring->>Python: 4. exec optimize_portfolio.py
    Python->>Yahoo: 5. 실시간 시세 조회 (yfinance)
    Yahoo-->>Python: 6. 주가 데이터 반환
    Python->>Python: 7. QAOA 알고리즘 실행
    Python-->>Spring: 8. 최적 비율 JSON 반환
    Spring->>DB: 9. 결과 저장
    Spring-->>React: 10. 최적화 결과 전송
    React-->>User: 11. 차트 & 분석 표시
    
    User->>React: 12. 챗봇 질문
    React->>Spring: 13. POST /api/chatbot/chat
    Spring->>Gemini: 14. Gemini API 호출
    Gemini-->>Spring: 15. AI 응답
    Spring-->>React: 16. 응답 전송
    React-->>User: 17. 챗봇 메시지 표시
```

## 기술 스택 맵

```mermaid
graph TB
    subgraph "Frontend Stack 🎨"
        REACT[React 18]
        VITE[Vite]
        TAILWIND[Tailwind CSS]
        AXIOS[Axios]
        I18NEXT[i18next]
    end
    
    subgraph "Backend Stack ☕"
        SPRING[Spring Boot 3.1.5]
        JPA[Spring Data JPA]
        SECURITY[Spring Security + JWT]
        MARIA[MariaDB]
    end
    
    subgraph "AI/Quantum Stack 🔬"
        QISKIT[Qiskit 0.45.0]
        NUMPY[NumPy/Pandas]
        YFINANCE[yfinance 0.2.32]
        GEMINI_AI[Google Gemini 1.5]
    end
    
    subgraph "Build Tools ⚙️"
        GRADLE[Gradle 8.x]
        MAVEN[Maven]
        NPM[npm]
    end
    
    REACT --> VITE
    REACT --> TAILWIND
    REACT --> AXIOS
    REACT --> I18NEXT
    
    SPRING --> JPA
    SPRING --> SECURITY
    JPA --> MARIA
    
    QISKIT --> NUMPY
    
    style REACT fill:#61dafb
    style SPRING fill:#6db33f
    style QISKIT fill:#6929c4
    style GEMINI_AI fill:#4285f4
```

## 파일 크기 분석

```mermaid
pie title 주요 디렉토리 비중
    "Java Source (Backend)" : 45
    "React Components (Frontend)" : 30
    "Python Scripts (AI)" : 10
    "Build Output" : 8
    "Documentation" : 5
    "Config Files" : 2
```

---

## 📊 통계 요약

| 항목 | 수량 |
|------|------|
| **총 Java 클래스** | ~40개 |
| **React 컴포넌트** | 13개 |
| **Python 스크립트** | 5개 |
| **REST API 엔드포인트** | ~20개 |
| **데이터베이스 테이블** | 4개 (User, Portfolio, Stock, OptimizationResult) |
| **외부 API 연동** | 2개 (Yahoo Finance, Gemini AI) |

---

**생성 날짜**: 2025-11-10  
**프로젝트 이름**: QuantaFolio Navigator (QFN)  
**버전**: 1.0.0
