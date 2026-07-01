-- Verify new Message columns work
INSERT INTO "Message" ("id", "companyId", "conversationId", "content", "sender", "senderName", "platform", "deliveryStatus", "createdAt")
SELECT gen_random_uuid(), '3102a85e-1798-45bb-b6c5-d94ea436f775', '645a91a0-f72e-4276-be9d-f9d5aa3b72a6', 'Step2 verification - outbound dispatcher fields', 'SYSTEM'::"MessageSender", 'DispatcherTest', 'TELEGRAM'::"Channel", 'SENT', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Message" WHERE "senderName" = 'DispatcherTest');

-- Read back the inserted row
SELECT content, sender::text, "senderName", platform::text, "deliveryStatus", "isRead"
FROM "Message"
WHERE "senderName" = 'DispatcherTest'