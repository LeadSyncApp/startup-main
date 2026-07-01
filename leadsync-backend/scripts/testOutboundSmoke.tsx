import { OutboundDispatcher } from "../src/services/outbound.dispatcher";

const svc = new OutboundDispatcher();

(async () => {
  try {
    await svc.dispatch({
      companyId: "3102a85e-1798-45bb-b6c5-d94ea436f775",
      conversationId: "645a91a0-f72e-4276-be9d-f9d5aa3b72a6",
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