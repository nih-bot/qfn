#!/bin/bash

# Azure Container Registry 및 Container Instances 배포 스크립트

# 변수 설정
RESOURCE_GROUP="qfn-rg"
ACR_NAME="qfnacr"
CONTAINER_NAME="qfn-portfolio"
IMAGE_NAME="qfn-portfolio-optimizer"
LOCATION="koreacentral"

echo "=== Azure 리소스 생성 시작 ==="

# 1. 리소스 그룹 생성
echo "1. 리소스 그룹 생성..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Azure Container Registry 생성
echo "2. Container Registry 생성..."
az acr create --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 3. Docker 이미지 빌드 및 푸시
echo "3. Docker 이미지 빌드..."
docker build -t $IMAGE_NAME .

echo "4. ACR에 이미지 푸시..."
az acr login --name $ACR_NAME
docker tag $IMAGE_NAME $ACR_NAME.azurecr.io/$IMAGE_NAME:latest
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:latest

# 4. Azure Database for MySQL 생성
echo "5. MySQL 데이터베이스 생성..."
az mysql flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name qfn-mysql \
  --location $LOCATION \
  --admin-user adminuser \
  --admin-password "QFN_Password_123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --storage-size 20 \
  --version 8.0.21

# 데이터베이스 생성
az mysql flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name qfn-mysql \
  --database-name qfn

# 5. Container Instance 생성
echo "6. Container Instance 배포..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:latest \
  --registry-login-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv) \
  --dns-name-label qfn-portfolio-app \
  --ports 8080 \
  --environment-variables \
    SPRING_PROFILES_ACTIVE=azure \
    SPRING_DATASOURCE_URL="jdbc:mysql://qfn-mysql.mysql.database.azure.com:3306/qfn?useSSL=true&requireSSL=false&serverTimezone=UTC" \
    SPRING_DATASOURCE_USERNAME="adminuser" \
    SPRING_DATASOURCE_PASSWORD="QFN_Password_123!" \
    JWT_SECRET="qfn-super-secret-jwt-key-for-production-use-256-bits-minimum" \
  --memory 2 \
  --cpu 1

echo "=== 배포 완료 ==="
echo "애플리케이션 URL: http://qfn-portfolio-app.$LOCATION.azurecontainer.io:8080"

# 배포 상태 확인
az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query "{FQDN:ipAddress.fqdn,ProvisioningState:provisioningState}" --out table