import { ProviderAdapterFactory } from "../../src/adapters/provider.factory";

function testAdapter() {
  const adapter = ProviderAdapterFactory.getAdapter("telegram");

  const rawUpdate = {
    update_id: 12345,
    message: {
      message_id: 1,
      chat: { id: 999 },
      text: "/view_sweets@Goofygr_bot"
    }
  };

  const frame = adapter.normalizePayload(rawUpdate);
  console.log("Normalized frame:", frame);
}

testAdapter();
