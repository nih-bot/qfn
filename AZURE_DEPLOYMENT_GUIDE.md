# Azure App Service 배포 가이드

## 1. Azure CLI 설치 및 로그인
```bash
# Azure CLI 설치 (Windows)
winget install Microsoft.AzureCLI

# 로그인
az login
```

## 2. 리소스 그룹 생성
```bash
az group create --name qfn-rg --location "Korea Central"
```

## 3. App Service Plan 생성
```bash
az appservice plan create \
  --name qfn-plan \
  --resource-group qfn-rg \
  --sku B1 \
  --is-linux
```

## 4. Web App 생성
```bash
az webapp create \
  --name qfn-portfolio-app \
  --resource-group qfn-rg \
  --plan qfn-plan \
  --runtime "JAVA:21-java21"
```

## 5. 데이터베이스 설정 (Azure Database for MySQL)
```bash
# MySQL 서버 생성
az mysql flexible-server create \
  --name qfn-mysql \
  --resource-group qfn-rg \
  --location "Korea Central" \
  --admin-user adminuser \
  --admin-password "YourPassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --storage-size 20 \
  --version 8.0.21

# 데이터베이스 생성
az mysql flexible-server db create \
  --resource-group qfn-rg \
  --server-name qfn-mysql \
  --database-name qfn
```

## 6. 환경 변수 설정
```bash
az webapp config appsettings set \
  --name qfn-portfolio-app \
  --resource-group qfn-rg \
  --settings \
    SPRING_DATASOURCE_URL="jdbc:mysql://qfn-mysql.mysql.database.azure.com:3306/qfn?useSSL=true&requireSSL=false&serverTimezone=UTC" \
    SPRING_DATASOURCE_USERNAME="adminuser" \
    SPRING_DATASOURCE_PASSWORD="YourPassword123!" \
    SPRING_DATASOURCE_DRIVER_CLASS_NAME="com.mysql.cj.jdbc.Driver" \
    SPRING_JPA_HIBERNATE_DDL_AUTO="update" \
    SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT="org.hibernate.dialect.MySQL8Dialect"
```

## 7. JAR 파일 배포
```bash
# 프로젝트 빌드
./gradlew build

# JAR 파일 배포
az webapp deploy \
  --name qfn-portfolio-app \
  --resource-group qfn-rg \
  --src-path build/libs/stock-portfolio-optimizer-1.0.0.jar \
  --type jar
```