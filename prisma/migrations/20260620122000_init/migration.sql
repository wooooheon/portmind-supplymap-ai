-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maskedValue" TEXT,
    "envKeyName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "requiresKey" BOOLEAN NOT NULL DEFAULT false,
    "keyEnvName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'stub',
    "docsUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paramsJson" TEXT,
    "rawFilePath" TEXT,
    "normalizedFilePath" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Factory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalName" TEXT NOT NULL,
    "chineseName" TEXT,
    "englishName" TEXT,
    "koreanName" TEXT,
    "aliasesJson" TEXT,
    "country" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "addressRaw" TEXT,
    "addressNormalized" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "coordSystem" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "geocodeConfidence" REAL,
    "geocodeProvider" TEXT,
    "sourceTagsJson" TEXT,
    "importReadinessScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factoryId" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT,
    "hsCodeCandidate" TEXT,
    "sourceCode" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factoryId" TEXT,
    "productId" TEXT,
    "certType" TEXT NOT NULL DEFAULT 'OTHER',
    "certNumber" TEXT,
    "modelName" TEXT,
    "productName" TEXT,
    "manufacturerName" TEXT,
    "importerName" TEXT,
    "country" TEXT,
    "status" TEXT,
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "sourceCode" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hsCode" TEXT NOT NULL,
    "importExportType" TEXT,
    "lawName" TEXT,
    "agencyName" TEXT,
    "requirementName" TEXT,
    "sourceCode" TEXT NOT NULL,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RiskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factoryId" TEXT,
    "productId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" DATETIME,
    "severity" TEXT,
    "sourceCode" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskEvent_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RiskEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawSnippet" TEXT,
    "rawJson" TEXT
);

-- CreateTable
CREATE TABLE "ExportFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ApiKey_provider_idx" ON "ApiKey"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_provider_label_key" ON "ApiKey"("provider", "label");

-- CreateIndex
CREATE UNIQUE INDEX "ApiSource_code_key" ON "ApiSource"("code");

-- CreateIndex
CREATE INDEX "IngestionRun_sourceCode_idx" ON "IngestionRun"("sourceCode");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- CreateIndex
CREATE INDEX "Factory_canonicalName_idx" ON "Factory"("canonicalName");

-- CreateIndex
CREATE INDEX "Factory_country_province_city_idx" ON "Factory"("country", "province", "city");

-- CreateIndex
CREATE INDEX "Factory_riskLevel_idx" ON "Factory"("riskLevel");

-- CreateIndex
CREATE INDEX "Product_factoryId_idx" ON "Product"("factoryId");

-- CreateIndex
CREATE INDEX "Product_productName_idx" ON "Product"("productName");

-- CreateIndex
CREATE INDEX "Certificate_factoryId_idx" ON "Certificate"("factoryId");

-- CreateIndex
CREATE INDEX "Certificate_certNumber_idx" ON "Certificate"("certNumber");

-- CreateIndex
CREATE INDEX "Certificate_certType_idx" ON "Certificate"("certType");

-- CreateIndex
CREATE INDEX "TradeRequirement_hsCode_idx" ON "TradeRequirement"("hsCode");

-- CreateIndex
CREATE INDEX "RiskEvent_factoryId_idx" ON "RiskEvent"("factoryId");

-- CreateIndex
CREATE INDEX "RiskEvent_eventType_idx" ON "RiskEvent"("eventType");

-- CreateIndex
CREATE INDEX "Evidence_entityType_entityId_idx" ON "Evidence"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Evidence_sourceCode_idx" ON "Evidence"("sourceCode");

-- CreateIndex
CREATE INDEX "ExportFile_entityType_idx" ON "ExportFile"("entityType");

-- CreateIndex
CREATE INDEX "ExportFile_createdAt_idx" ON "ExportFile"("createdAt");

