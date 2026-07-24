-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('RULE', 'PRODUCT', 'POLICY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CLIENT', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'INVITE_ACCEPTED', 'ONBOARDED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEBSITE', 'TELEGRAM', 'WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "BusinessScale" AS ENUM ('HOME_GROWN', 'SME_RETAIL');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED', 'BOT_CREATED_ORDER', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'REJECTED', 'ARCHIVED', 'USER_CONFIRMED_PENDING_AGENT');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CLAIMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadSegment" AS ENUM ('NEW', 'REGULAR', 'VIP', 'CHURN_RISK');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'BOT_DETECTED');

-- CreateEnum
CREATE TYPE "OrderApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('BOT', 'HUMAN');

-- CreateEnum
CREATE TYPE "SourceChannel" AS ENUM ('WEBSITE', 'TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'META');

-- CreateEnum
CREATE TYPE "ConversationIntent" AS ENUM ('BROWSING', 'ORDERING', 'SUPPORT', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "PendingOrderState" AS ENUM ('NONE', 'PENDING_APPROVAL', 'CLAIMED_FOR_APPROVAL');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scale" "BusinessScale" NOT NULL DEFAULT 'HOME_GROWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "telegramBotToken" TEXT,
    "telegramBotTokenHash" TEXT,
    "telegramBotUsername" TEXT,
    "telegramWebhookSecret" TEXT,
    "telegramConnected" BOOLEAN NOT NULL DEFAULT false,
    "botBusinessType" TEXT,
    "botWelcomeMessage" TEXT,
    "businessAddress" TEXT,
    "businessName" TEXT,
    "companyCode" TEXT NOT NULL,
    "gstin" TEXT,
    "instagramConnected" BOOLEAN NOT NULL DEFAULT false,
    "instagramPageAccessToken" TEXT,
    "instagramPageId" TEXT,
    "whatsAppSystemToken" TEXT,
    "whatsAppPhoneNumberId" TEXT,
    "invoiceCounter" INTEGER NOT NULL DEFAULT 0,
    "dailyRevenueTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "businessStartHour" INTEGER NOT NULL DEFAULT 8,
    "businessEndHour" INTEGER NOT NULL DEFAULT 22,
    "customOooMessage" TEXT NOT NULL DEFAULT 'Hello! Our human team is currently offline. Your message has been pinned right at the top of our workbench queue, and we will message you as soon as our shift begins! ☀️',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "highValueThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5000.0,
    "bulkItemThreshold" INTEGER NOT NULL DEFAULT 5,
    "upiId" TEXT,
    "upiName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "managerId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "staffId" TEXT,
    "residingAddress" TEXT,
    "phoneNumber" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authProvider" TEXT NOT NULL DEFAULT 'EMAIL',
    "googleId" TEXT,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "contact" TEXT NOT NULL,
    "preferredLanguage" TEXT,
    "channel" "Channel" NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "segment" "LeadSegment" NOT NULL DEFAULT 'NEW',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "pendingOrderAmount" DOUBLE PRECISION,
    "pendingOrderClaimedAt" TIMESTAMP(3),
    "pendingOrderClaimedById" TEXT,
    "pendingOrderId" TEXT,
    "pendingOrderState" "PendingOrderState" NOT NULL DEFAULT 'NONE',
    "pendingOrderSummary" TEXT,
    "customFields" JSONB,
    "city" TEXT,
    "state" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "aiPriority" "AiPriority" NOT NULL DEFAULT 'LOW',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "cogs" DOUBLE PRECISION,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "leadId" TEXT,
    "summary" TEXT NOT NULL,
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "OrderStatus" NOT NULL DEFAULT 'BOT_CREATED_ORDER',
    "sourceChannel" "SourceChannel" NOT NULL DEFAULT 'WEBSITE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCogs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processedById" TEXT,
    "approvalStatus" "OrderApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "predictedValue" DOUBLE PRECISION,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAnalyticsRollup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "totalLeadsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAnalyticsRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cogs" DOUBLE PRECISION,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" TEXT NOT NULL,
    "paymentProvider" TEXT NOT NULL DEFAULT 'razorpay',
    "paymentRef" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT,
    "channel" "Channel" NOT NULL,
    "mode" "ConversationMode" NOT NULL DEFAULT 'BOT',
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "intent" "ConversationIntent",
    "claimedById" TEXT,
    "claimedByName" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "lastClaimHeartbeat" TIMESTAMP(3),
    "needsStaffReason" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
    "isReturningCustomer" BOOLEAN NOT NULL DEFAULT false,
    "previousHandledById" TEXT,
    "previousConversationId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "sessionState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "platform" "Channel",
    "externalMessageId" TEXT,
    "deliveryStatus" TEXT DEFAULT 'SENT',
    "deliveryError" TEXT,
    "clientMessageId" TEXT,
    "senderName" TEXT,
    "senderId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotKnowledge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FAQ',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "triggerDelayMinutes" INTEGER NOT NULL DEFAULT 1440,
    "action" TEXT NOT NULL,
    "actionPayload" JSONB,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "triggeredFor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "messageBody" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "useAI" BOOLEAN NOT NULL DEFAULT false,
    "brandVoice" TEXT DEFAULT 'friendly',
    "targetLanguage" TEXT DEFAULT 'en',

    CONSTRAINT "AutoReplyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoReplyLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT,
    "eventKey" TEXT NOT NULL,
    "triggeredFor" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'AI_INSTRUCTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationalRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerType" TEXT NOT NULL DEFAULT 'KEYWORD',
    "conditions" JSONB,
    "templateBody" TEXT NOT NULL DEFAULT '',
    "useAI" BOOLEAN NOT NULL DEFAULT false,
    "brandVoice" TEXT DEFAULT 'friendly',
    "targetLanguage" TEXT DEFAULT 'auto',
    "sourcePrompt" TEXT,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "ConversationalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationalRuleLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "conversationId" TEXT,
    "leadId" TEXT,
    "inboundText" TEXT NOT NULL,
    "responseSent" TEXT,
    "matchedKeyword" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationalRuleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFeedPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConfiguration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "botMenu" JSONB,
    "botStructuredMenu" JSONB,
    "botCommands" JSONB,
    "botKnowledgeBase" TEXT,
    "botLearnedContext" TEXT,
    "botPolicies" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "sourceId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "keyIdentifier" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "templateBodyString" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "defaultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "tokenLookup" TEXT,
    "staffId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingWebhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "IncomingWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idempotency" (
    "key" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idempotency_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "targetTags" TEXT[],
    "targetSegments" "LeadSegment"[],
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostalPincodeIndex" (
    "id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostalPincodeIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentionedIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket_io_attachments" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "payload" BYTEA
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_telegramBotTokenHash_key" ON "Company"("telegramBotTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Company_telegramWebhookSecret_key" ON "Company"("telegramWebhookSecret");

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyCode_key" ON "Company"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Company_instagramPageId_key" ON "Company"("instagramPageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_resetToken_idx" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "User_authProvider_idx" ON "User"("authProvider");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_companyId_onboardingStatus_idx" ON "User"("companyId", "onboardingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_companyId_key" ON "User"("email", "companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "Lead_companyId_aiPriority_estimatedValue_idx" ON "Lead"("companyId", "aiPriority", "estimatedValue");

-- CreateIndex
CREATE INDEX "Lead_totalSpend_idx" ON "Lead"("totalSpend");

-- CreateIndex
CREATE INDEX "Lead_lastActiveAt_idx" ON "Lead"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");

-- CreateIndex
CREATE INDEX "Lead_city_idx" ON "Lead"("city");

-- CreateIndex
CREATE INDEX "Lead_state_idx" ON "Lead"("state");

-- CreateIndex
CREATE INDEX "Lead_tags_idx" ON "Lead"("tags");

-- CreateIndex
CREATE INDEX "Lead_pendingOrderClaimedById_idx" ON "Lead"("pendingOrderClaimedById");

-- CreateIndex
CREATE INDEX "Lead_pendingOrderState_idx" ON "Lead"("pendingOrderState");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_contact_channel_companyId_key" ON "Lead"("contact", "channel", "companyId");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_companyId_approvalStatus_idx" ON "Order"("companyId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- CreateIndex
CREATE INDEX "Order_companyId_source_idx" ON "Order"("companyId", "source");

-- CreateIndex
CREATE INDEX "Order_companyId_sourceChannel_idx" ON "Order"("companyId", "sourceChannel");

-- CreateIndex
CREATE INDEX "Order_companyId_amount_idx" ON "Order"("companyId", "amount");

-- CreateIndex
CREATE INDEX "Order_leadId_idx" ON "Order"("leadId");

-- CreateIndex
CREATE INDEX "Order_processedById_idx" ON "Order"("processedById");

-- CreateIndex
CREATE INDEX "Order_approvalStatus_idx" ON "Order"("approvalStatus");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_priorityScore_idx" ON "Order"("priorityScore");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "Order_conversationId_idx" ON "Order"("conversationId");

-- CreateIndex
CREATE INDEX "Order_isDeleted_idx" ON "Order"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAnalyticsRollup_companyId_key" ON "CompanyAnalyticsRollup"("companyId");

-- CreateIndex
CREATE INDEX "OrderItem_companyId_idx" ON "OrderItem"("companyId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");

-- CreateIndex
CREATE INDEX "OrderLog_companyId_idx" ON "OrderLog"("companyId");

-- CreateIndex
CREATE INDEX "OrderLog_orderId_idx" ON "OrderLog"("orderId");

-- CreateIndex
CREATE INDEX "OrderLog_timestamp_idx" ON "OrderLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Conversation_companyId_lifecycleStatus_idx" ON "Conversation"("companyId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "Conversation_companyId_claimedById_idx" ON "Conversation"("companyId", "claimedById");

-- CreateIndex
CREATE INDEX "Conversation_companyId_status_idx" ON "Conversation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");

-- CreateIndex
CREATE INDEX "Message_companyId_idx" ON "Message"("companyId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_platform_externalMessageId_key" ON "Message"("platform", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientMessageId_key" ON "Message"("conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "BotKnowledge_companyId_idx" ON "BotKnowledge"("companyId");

-- CreateIndex
CREATE INDEX "BotKnowledge_companyId_isActive_idx" ON "BotKnowledge"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_idx" ON "AutomationRule"("companyId");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_id_idx" ON "AutomationRule"("companyId", "id");

-- CreateIndex
CREATE INDEX "AutomationRule_companyId_isActive_idx" ON "AutomationRule"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationLog_ruleId_idx" ON "AutomationLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationLog_companyId_idx" ON "AutomationLog"("companyId");

-- CreateIndex
CREATE INDEX "AutomationLog_createdAt_idx" ON "AutomationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AutoReplyRule_companyId_idx" ON "AutoReplyRule"("companyId");

-- CreateIndex
CREATE INDEX "AutoReplyRule_eventKey_idx" ON "AutoReplyRule"("eventKey");

-- CreateIndex
CREATE INDEX "AutoReplyRule_isEnabled_idx" ON "AutoReplyRule"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AutoReplyRule_companyId_eventKey_key" ON "AutoReplyRule"("companyId", "eventKey");

-- CreateIndex
CREATE INDEX "AutoReplyLog_companyId_idx" ON "AutoReplyLog"("companyId");

-- CreateIndex
CREATE INDEX "AutoReplyLog_ruleId_idx" ON "AutoReplyLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutoReplyLog_sentAt_idx" ON "AutoReplyLog"("sentAt");

-- CreateIndex
CREATE INDEX "AutoReplyLog_status_idx" ON "AutoReplyLog"("status");

-- CreateIndex
CREATE INDEX "RuleGroup_companyId_idx" ON "RuleGroup"("companyId");

-- CreateIndex
CREATE INDEX "RuleGroup_companyId_type_idx" ON "RuleGroup"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RuleGroup_companyId_name_key" ON "RuleGroup"("companyId", "name");

-- CreateIndex
CREATE INDEX "ConversationalRule_companyId_idx" ON "ConversationalRule"("companyId");

-- CreateIndex
CREATE INDEX "ConversationalRule_companyId_isEnabled_idx" ON "ConversationalRule"("companyId", "isEnabled");

-- CreateIndex
CREATE INDEX "ConversationalRule_triggerKeywords_idx" ON "ConversationalRule"("triggerKeywords");

-- CreateIndex
CREATE INDEX "ConversationalRule_groupId_idx" ON "ConversationalRule"("groupId");

-- CreateIndex
CREATE INDEX "ConversationalRuleLog_companyId_idx" ON "ConversationalRuleLog"("companyId");

-- CreateIndex
CREATE INDEX "ConversationalRuleLog_ruleId_idx" ON "ConversationalRuleLog"("ruleId");

-- CreateIndex
CREATE INDEX "ConversationalRuleLog_createdAt_idx" ON "ConversationalRuleLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationalRuleLog_status_idx" ON "ConversationalRuleLog"("status");

-- CreateIndex
CREATE INDEX "AgentFeedPost_companyId_createdAt_idx" ON "AgentFeedPost"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "BotConfiguration_companyId_key" ON "BotConfiguration"("companyId");

-- CreateIndex
CREATE INDEX "BotConfiguration_companyId_createdAt_idx" ON "BotConfiguration"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_companyId_idx" ON "KnowledgeChunk"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_companyId_isActive_idx" ON "KnowledgeChunk"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_companyId_sourceType_sourceId_key" ON "KnowledgeChunk"("companyId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_companyId_idx" ON "NotificationTemplate"("companyId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_keyIdentifier_idx" ON "NotificationTemplate"("keyIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_companyId_keyIdentifier_localeCode_key" ON "NotificationTemplate"("companyId", "keyIdentifier", "localeCode");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_companyId_idx" ON "CustomFieldDefinition"("companyId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_companyId_module_idx" ON "CustomFieldDefinition"("companyId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_companyId_module_name_key" ON "CustomFieldDefinition"("companyId", "module", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenLookup_key" ON "Invitation"("tokenLookup");

-- CreateIndex
CREATE INDEX "Invitation_companyId_idx" ON "Invitation"("companyId");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_tokenLookup_idx" ON "Invitation"("tokenLookup");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE INDEX "Invitation_status_tokenLookup_idx" ON "Invitation"("status", "tokenLookup");

-- CreateIndex
CREATE INDEX "IncomingWebhook_status_createdAt_idx" ON "IncomingWebhook"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Idempotency_expiresAt_idx" ON "Idempotency"("expiresAt");

-- CreateIndex
CREATE INDEX "Idempotency_status_updatedAt_idx" ON "Idempotency"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Broadcast_companyId_idx" ON "Broadcast"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PostalPincodeIndex_pincode_key" ON "PostalPincodeIndex"("pincode");

-- CreateIndex
CREATE INDEX "PostalPincodeIndex_pincode_idx" ON "PostalPincodeIndex"("pincode");

-- CreateIndex
CREATE INDEX "ClaimLog_companyId_idx" ON "ClaimLog"("companyId");

-- CreateIndex
CREATE INDEX "ClaimLog_conversationId_idx" ON "ClaimLog"("conversationId");

-- CreateIndex
CREATE INDEX "ClaimLog_createdAt_idx" ON "ClaimLog"("createdAt");

-- CreateIndex
CREATE INDEX "InternalNote_companyId_idx" ON "InternalNote"("companyId");

-- CreateIndex
CREATE INDEX "InternalNote_conversationId_idx" ON "InternalNote"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "socket_io_attachments_id_key" ON "socket_io_attachments"("id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnalyticsRollup" ADD CONSTRAINT "CompanyAnalyticsRollup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLog" ADD CONSTRAINT "OrderLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLog" ADD CONSTRAINT "OrderLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotKnowledge" ADD CONSTRAINT "BotKnowledge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationLog" ADD CONSTRAINT "AutomationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyRule" ADD CONSTRAINT "AutoReplyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyLog" ADD CONSTRAINT "AutoReplyLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoReplyLog" ADD CONSTRAINT "AutoReplyLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutoReplyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleGroup" ADD CONSTRAINT "RuleGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationalRule" ADD CONSTRAINT "ConversationalRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationalRule" ADD CONSTRAINT "ConversationalRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RuleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationalRuleLog" ADD CONSTRAINT "ConversationalRuleLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationalRuleLog" ADD CONSTRAINT "ConversationalRuleLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ConversationalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedPost" ADD CONSTRAINT "AgentFeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedPost" ADD CONSTRAINT "AgentFeedPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotConfiguration" ADD CONSTRAINT "BotConfiguration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantFile" ADD CONSTRAINT "MerchantFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLog" ADD CONSTRAINT "ClaimLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLog" ADD CONSTRAINT "ClaimLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

