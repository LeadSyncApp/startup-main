import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { prisma } from "../../src/lib/prisma";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-me-in-production";

async function testSurfaceConfig() {
  const user = await prisma.user.findFirst({
    where: { isActive: true }
  });

  if (!user) {
    console.error("No active user found!");
    return;
  }

  const token = jwt.sign(
    { userId: user.id, companyId: user.companyId, role: user.role },
    JWT_SECRET
  );

  const headers = { Authorization: `Bearer ${token}` };

  const listRes = await axios.get(`http://localhost:4000/api/automation/conversational-rules/${user.companyId}`, { headers });
  const ladooRule = listRes.data.rules?.find((r: any) => r.name === "Ladoo Inquiry");

  if (!ladooRule) {
    console.error("Ladoo Inquiry rule not found!");
    return;
  }

  // Perform 4 sequential updates to verify connection resilience and save-time validation
  for (let i = 1; i <= 4; i++) {
    console.log(`\n--- Surface Update Attempt ${i}/4 ---`);
    const updatePayload = {
      templateBody: "We offer fresh Motichoor and Besan Ladoos at Rs. 400/kg. Order now!",
      surfaceConfig: {
        enabled: true,
        channel: "TELEGRAM",
        buttonLabel: `Ladoo Menu ${i}`,
        command: "/ladoo",
        menuPosition: i
      }
    };

    const updateRes = await axios.put(`http://localhost:4000/api/automation/conversational-rules/${ladooRule.id}`, updatePayload, { headers });
    console.log(`Attempt ${i} Status:`, updateRes.status, "Button label:", updateRes.data.rule?.surfaceConfig?.buttonLabel);
  }
}

testSurfaceConfig().catch(console.error).finally(() => prisma.$disconnect());
