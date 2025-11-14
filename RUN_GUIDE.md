# 🚀 Stock Portfolio Optimizer - 완전 실행 가이드

> **Clean 환경에서 처음부터 끝까지 실행하는 완전 가이드**
> 
> 다른 컴퓨터에서 이 폴더만으로 실행 가능하도록 모든 단계를 상세히 설명합니다.

---

## 📋 목차
1. [필수 프로그램 설치](#1-필수-프로그램-설치)
2. [데이터베이스 설정](#2-데이터베이스-설정-mariadb)
3. [환경 설정 확인](#3-환경-설정-확인)
4. [프로젝트 실행](#4-프로젝트-실행)
5. [개발 모드 실행](#5-개발-모드-실행-선택)
6. [문제 해결](#6-문제-해결)

---

## 1. 필수 프로그램 설치

### 1.1 Java Development Kit (JDK) 21
**Spring Boot 3.x는 JDK 17 이상 필요**

#### Windows:
1. [Oracle JDK 21](https://www.oracle.com/java/technologies/downloads/#java21) 또는 [OpenJDK 21](https://adoptium.net/) 다운로드
2. 설치 후 환경변수 확인:
```powershell
java -version
# 출력 예: java version "21.0.1"
```

3. 환경변수 설정 (필요시):
   - `JAVA_HOME`: `C:\Program Files\Java\jdk-21`
   - `Path`에 `%JAVA_HOME%\bin` 추가

#### macOS/Linux:
```bash
# macOS (Homebrew)
brew install openjdk@21

# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# 확인
java -version
```

---

### 1.2 Node.js (v18 이상 권장)
**프론트엔드 빌드에 필요**

#### Windows:
1. [Node.js 공식 사이트](https://nodejs.org/) 에서 LTS 버전 다운로드
2. 설치 후 확인:
```powershell
node -v
# 출력 예: v20.10.0

npm -v
# 출력 예: 10.2.3
```

#### macOS/Linux:
```bash
# macOS (Homebrew)
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 확인
node -v
npm -v
```

---

### 1.3 Python 3.10 이상
**QAOA 최적화 알고리즘에 필요**

#### Windows:
1. [Python 공식 사이트](https://www.python.org/downloads/) 에서 최신 버전 다운로드
2. 설치 시 **"Add Python to PATH"** 체크
3. 확인:
```powershell
python --version
# 출력 예: Python 3.12.0

pip --version
# 출력 예: pip 23.3.1
```

#### macOS/Linux:
```bash
# macOS (Homebrew)
brew install python@3.12

# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip

# 확인
python3 --version
pip3 --version
```

---

### 1.4 MariaDB 10.6 이상
**데이터베이스 서버**

#### Windows:
1. [MariaDB 다운로드](https://mariadb.org/download/)
2. 설치 시:
   - Root 비밀번호 설정 ('0000')
   - UTF-8 character set 선택
   - "Enable networking" 체크
3. 설치 완료 후 서비스 시작 확인:
```powershell
# MariaDB 서비스 상태 확인
Get-Service -Name MariaDB
```

#### macOS:
```bash
# Homebrew로 설치
brew install mariadb

# 서비스 시작
brew services start mariadb

# Root 비밀번호 설정
sudo mysql_secure_installation
```

#### Linux:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mariadb-server

# 서비스 시작
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Root 비밀번호 설정
sudo mysql_secure_installation
```

---

## 2. 데이터베이스 설정 (MariaDB)

### 2.1 데이터베이스 및 사용자 생성

1. MariaDB에 접속:
```powershell
# Windows (명령 프롬프트 또는 PowerShell)
mysql -u root -p
# 비밀번호 입력: 1234 (또는 설치 시 설정한 비밀번호)
```

```bash
# macOS/Linux
sudo mysql -u root -p
```

2. 데이터베이스 및 사용자 생성:
```sql
-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS qfn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 확인 (root 사용 시 생략 가능)
SHOW GRANTS FOR 'root'@'localhost';

-- 권한 부여 (필요시)
GRANT ALL PRIVILEGES ON qfn.* TO 'root'@'localhost';
FLUSH PRIVILEGES;

-- 데이터베이스 확인
SHOW DATABASES;

-- 종료
EXIT;
```

### 2.2 연결 설정 확인

프로젝트의 `src/main/resources/application.properties` 파일을 확인:
```properties
spring.datasource.url=jdbc:mariadb://localhost:3306/qfn
spring.datasource.username=root
spring.datasource.password=1234
```

**다른 비밀번호를 사용하면 `application.properties`를 수정하세요.**

---

## 3. 환경 설정 확인

### 3.1 Python 패키지 설치

프로젝트 루트에서 실행:
```powershell
# Windows
cd src\main\python
pip install qiskit qiskit-optimization scipy numpy yfinance pandas requests
cd ..\..\..
```

```bash
# macOS/Linux
cd src/main/python
pip3 install qiskit qiskit-optimization scipy numpy yfinance pandas requests
cd ../../..
```

**주요 패키지:**
- `qiskit` - Quantum 알고리즘
- `qiskit-optimization` - QAOA 최적화
- `scipy` - 수학 연산
- `numpy` - 배열 연산
- `yfinance` - 주식 데이터
- `pandas` - 데이터 처리
- `requests` - HTTP 요청

### 3.2 Python 경로 확인

`src/main/resources/application.properties` 확인:
```properties
python.executable=python
python.script.path=src/main/python
```

**Python 실행 파일 경로가 다르면 수정:**
- Windows: `python` 또는 `C:/Python312/python.exe`
- macOS/Linux: `python3` 또는 `/usr/bin/python3`

확인:
```powershell
# Windows
where python

# macOS/Linux
which python3
```

---

## 4. 프로젝트 실행

### 4.1 빠른 실행 (권장)

#### Windows:
```powershell
# 프로젝트 루트 디렉토리에서
start.bat
```

#### macOS/Linux:
```bash
# 실행 권한 부여 (처음 한 번만)
chmod +x start.sh

# 실행
./start.sh
```

**자동 실행 내용:**
1. Node.js 패키지 설치 (`npm install`)
2. 프론트엔드 빌드 (`npm run build`)
3. 백엔드 컴파일 및 실행 (`gradlew bootRun`)

**완료 시간:** 약 2-5분

---

### 4.2 수동 실행 (단계별)

#### Step 1: 프론트엔드 빌드

```powershell
# 프로젝트 루트에서
cd frontend

# 패키지 설치
npm install

# 프로덕션 빌드
npm run build

# 프로젝트 루트로 돌아가기
cd ..
```

**빌드 결과:** `src/main/resources/static` 폴더에 생성됨

#### Step 2: 백엔드 실행

```powershell
# Windows
gradlew.bat bootRun

# macOS/Linux
./gradlew bootRun
```

**첫 실행 시 Gradle 의존성 다운로드로 시간 소요 (약 1-3분)**

---

### 4.3 브라우저 접속

서버가 시작되면:
```
Started StockPortfolioOptimizerApplication in X.XXX seconds
```

브라우저에서 **http://localhost:8080** 접속

---

## 5. 개발 모드 실행 (선택)

프론트엔드 코드를 실시간으로 수정하면서 개발하려면:

### 5.1 백엔드 실행 (터미널 1)

```powershell
# Windows
gradlew.bat bootRun

# macOS/Linux
./gradlew bootRun
```

### 5.2 프론트엔드 개발 서버 실행 (터미널 2)

```powershell
cd frontend
npm run dev
```

**개발 모드 URL:**
- 프론트엔드: http://localhost:3000 (Hot Reload)
- 백엔드 API: http://localhost:8080

**장점:** 코드 수정 시 자동으로 새로고침 (빠른 개발)

---

## 6. 문제 해결

### 6.1 포트 충돌 오류

**증상:**
```
Port 8080 was already in use
```

**해결책:**

#### Option 1: 기존 프로세스 종료
```powershell
# Windows - 8080 포트 사용 프로세스 찾기
netstat -ano | findstr :8080

# PID 확인 후 종료 (관리자 권한)
taskkill /PID <PID> /F
```

```bash
# macOS/Linux
lsof -ti:8080 | xargs kill -9
```

#### Option 2: 포트 변경
`src/main/resources/application.properties` 수정:
```properties
server.port=8081
```

프론트엔드 API URL도 수정 (`frontend/src/utils/api.js` 등):
```javascript
const API_URL = 'http://localhost:8081';
```

---

### 6.2 Java 버전 오류

**증상:**
```
Unsupported class file major version 65
```

**원인:** JDK 버전이 21보다 낮음

**해결책:**
1. JDK 21 설치 (위 [1.1](#11-java-development-kit-jdk-21) 참조)
2. `JAVA_HOME` 환경변수 확인
3. 터미널 재시작 후 다시 실행

---

### 6.3 Python 패키지 오류

**증상:**
```
ModuleNotFoundError: No module named 'qiskit'
```

**해결책:**
```powershell
# Windows
pip install qiskit qiskit-optimization scipy numpy yfinance pandas requests

# macOS/Linux
pip3 install qiskit qiskit-optimization scipy numpy yfinance pandas requests
```

**Virtual Environment 사용 시:**
```powershell
# venv 생성
python -m venv venv

# 활성화
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 패키지 설치
pip install qiskit qiskit-optimization scipy numpy yfinance pandas requests
```

---

### 6.4 데이터베이스 연결 오류

**증상:**
```
Could not connect to address=(host=localhost)(port=3306)
```

**해결책:**

1. **MariaDB 서비스 확인:**
```powershell
# Windows
Get-Service -Name MariaDB

# 시작
Start-Service MariaDB
```

```bash
# macOS
brew services list
brew services start mariadb

# Linux
sudo systemctl status mariadb
sudo systemctl start mariadb
```

2. **연결 정보 확인:**
```powershell
mysql -u root -p
# 비밀번호 입력 후 접속되면 OK
```

3. **application.properties 확인:**
```properties
spring.datasource.url=jdbc:mariadb://localhost:3306/qfn
spring.datasource.username=root
spring.datasource.password=1234  # 실제 비밀번호로 변경
```

---

### 6.5 npm 패키지 오류

**증상:**
```
npm ERR! code ERESOLVE
```

**해결책:**
```powershell
cd frontend

# node_modules 삭제
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# 재설치
npm install

# 또는 강제 설치
npm install --legacy-peer-deps
```

---

### 6.6 Gradle 빌드 오류

**증상:**
```
Execution failed for task ':compileJava'
```

**해결책:**
```powershell
# Clean 후 재빌드
gradlew.bat clean build

# 테스트 스킵하고 빌드
gradlew.bat clean build -x test
```

---

## 7. 성능 최적화 및 배포

### 7.1 프로덕션 빌드

```powershell
# 프론트엔드 빌드
cd frontend
npm run build
cd ..

# 백엔드 JAR 생성
gradlew.bat clean build -x test
```

**생성 파일:** `build/libs/stock-portfolio-optimizer-0.0.1-SNAPSHOT.jar`

### 7.2 JAR 실행

```powershell
java -jar build/libs/stock-portfolio-optimizer-0.0.1-SNAPSHOT.jar
```

**배포 시 필요:**
- JDK 21 (또는 JRE 21)
- Python 3.10+ 및 패키지
- MariaDB 10.6+

---

## 8. 주요 명령어 요약

### 프로젝트 실행
```powershell
# 빠른 실행
start.bat

# 수동 실행
cd frontend && npm install && npm run build && cd ..
gradlew.bat bootRun
```

### 개발 모드
```powershell
# 터미널 1
gradlew.bat bootRun

# 터미널 2
cd frontend && npm run dev
```

### 빌드
```powershell
# 프론트엔드
cd frontend && npm run build

# 백엔드
gradlew.bat clean build
```

### 테스트
```powershell
# 백엔드 테스트
gradlew.bat test

# 프론트엔드 Lint
cd frontend && npm run lint
```

---

## 9. 시스템 요구사항

### 최소 요구사항
- **OS:** Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- **CPU:** 2 Core 이상
- **RAM:** 4GB 이상
- **Disk:** 2GB 여유 공간

### 권장 요구사항
- **OS:** Windows 11, macOS 13+, Ubuntu 22.04+
- **CPU:** 4 Core 이상
- **RAM:** 8GB 이상
- **Disk:** 5GB 여유 공간

---

## 10. 추가 문서

- [README.md](README.md) - 프로젝트 개요
- [QUICKSTART_NEW.md](QUICKSTART_NEW.md) - 빠른 시작
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 프로젝트 구조
- [ARCHITECTURE_DIAGRAM.md](docs/ARCHITECTURE_DIAGRAM.md) - 아키텍처

---

## 11. 문의 및 지원

문제가 지속되면:
1. [GitHub Issues](https://github.com/KDH-0309/QFN/issues) 등록
2. 에러 메시지 전체 복사
3. 실행 환경 정보 포함 (OS, Java/Node/Python 버전)

**Happy Coding! 🚀**
