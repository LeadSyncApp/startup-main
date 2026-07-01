import { OutboundDispatcher } from "../src/services/outbound.dispatcher";

const svc = new OutboundDispatcher();

(async () => {
  try {
    await svc.dispatch({
      companyId: "default",
      conversationId: "test-convo-001",
      to: "+0000000000",
      channel: "TELEGRAM",
      content: { text: "smoke-test outbound" },
      sender: "SYSTEM",
    });
    console.log("OK: dispatch() returned without throwing");
  } catch (e: any) {
    console.log("OUTBOUND SMOKE FAIL:", e.message);
  }
})();