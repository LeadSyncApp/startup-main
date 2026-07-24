import { OutboundDispatcher } from "../src/services/outbound.dispatcher";

const companyId = process.argv[2];
const conversationId = process.argv[3] || "00000000-0000-0000-0000-000000000000";
const to = process.argv[4] || "+0000000000";

if (!companyId) {
  console.error("Usage: npx ts-node --transpile-only scripts/testOutboundSmoke.tsx <companyId> [conversationId] [to]");
  console.error("companyId is required.");
  process.exit(1);
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)) {
  console.error("Error: companyId must be a valid UUID.");
  process.exit(1);
}

const svc = new OutboundDispatcher();

(async () => {
  try {
    await svc.dispatch({
      companyId,
      conversationId,
      to,
      channel: "TELEGRAM",
      content: { text: "smoke-test outbound" },
      sender: "SYSTEM",
    });
    console.log("OK: dispatch() returned without throwing");
  } catch (e: any) {
    console.log("OUTBOUND SMOKE FAIL:", e.message);
  }
})();