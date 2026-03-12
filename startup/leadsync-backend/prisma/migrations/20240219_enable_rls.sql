-- Enable RLS on conversations
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;

-- 1. Admins/Owners see everything
CREATE POLICY "conversation_admin_all" ON "Conversation"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid()
    AND role IN ('ADMIN', 'OWNER')
  )
);

-- 2. Agents see unclaimed conversations
CREATE POLICY "conversation_agent_unclaimed" ON "Conversation"
FOR SELECT
USING (
  assignedToId IS NULL
  AND EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid()
    AND role = 'AGENT'
  )
);

-- 3. Agents see their own assigned conversations
CREATE POLICY "conversation_agent_assigned" ON "Conversation"
FOR ALL
USING (
  assignedToId = auth.uid()
);

-- Note: Messages and orders should also have policies that check the parent conversation!
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_access" ON "Message"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = conversationId
    AND (
      c.assignedToId IS NULL
      OR c.assignedToId = auth.uid()
      OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'OWNER'))
    )
  )
);
