interface InstagramIntegrationProps {
  instagramConnected: boolean;
  instagramPageId: string;
  igPageIdInput: string;
  setIgPageIdInput: (value: string) => void;
  igTokenInput: string;
  setIgTokenInput: (value: string) => void;
  igVerifyToken: string;
  DISPLAY_WEBHOOK_URL: string;
  handleConnectInstagram: () => void;
  handleDisconnectInstagram: () => void;
}

export function InstagramIntegration({
  instagramConnected,
  instagramPageId,
  igPageIdInput,
  setIgPageIdInput,
  igTokenInput,
  setIgTokenInput,
  igVerifyToken,
  DISPLAY_WEBHOOK_URL,
  handleConnectInstagram,
  handleDisconnectInstagram,
}: InstagramIntegrationProps) {
  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4" id="instagram-integration-section">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Instagram Integration</h2>
          <p className="text-xs text-slate-500">Receive and reply to Instagram DMs via your AI bot</p>
        </div>
      </div>

      {!instagramConnected ? (
        <div className="space-y-3">
          {/* Webhook URL hint */}
          <div className="bg-app-bg rounded-xl px-4 py-3 border border-app space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 1 — Register Webhook in Meta Developer Console</p>
            <p className="text-xs text-slate-500">Callback URL (paste this in your Meta App → Webhooks):</p>
            <code className="block text-xs bg-app-surface border border-app rounded-lg px-3 py-2 font-mono text-indigo-700 break-all select-all">
              {DISPLAY_WEBHOOK_URL}
            </code>
            <p className="text-xs text-slate-400 mt-1">Verify Token: use <span className="font-mono bg-slate-100 px-1 rounded">{igVerifyToken || "leadsync_ig_verify_2026"}</span> in Meta App verification.</p>
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Step 2 — Enter Page Credentials</p>
          <input
            type="text"
            placeholder="Instagram Page ID (numeric, e.g. 1234567890)"
            value={igPageIdInput}
            onChange={(e) => setIgPageIdInput(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="Long-lived Page Access Token"
              value={igTokenInput}
              onChange={(e) => setIgTokenInput(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
            <button
              id="btn-connect-instagram"
              onClick={handleConnectInstagram}
              disabled={!igPageIdInput || !igTokenInput}
              className={`bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition ${(!igPageIdInput || !igTokenInput) ? "opacity-50 cursor-not-allowed" : "hover:from-pink-600 hover:to-purple-700"}`}
            >
              Connect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-pink-50 p-4 rounded-xl border border-pink-100">
            <div className="flex items-center gap-3">
              <div className="bg-pink-100 p-2 rounded-full text-pink-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </div>
              <div>
                <p className="font-semibold text-pink-900">Instagram Active</p>
                <p className="text-xs text-pink-600 font-mono">Page ID: {instagramPageId}</p>
              </div>
            </div>
            <button
              id="btn-disconnect-instagram"
              onClick={handleDisconnectInstagram}
              className="text-red-500 text-sm hover:text-red-600 px-3 py-1.5 bg-app-surface border border-red-100 rounded-lg shadow-sm transition"
            >
              Disconnect
            </button>
          </div>
          {/* Webhook URL reminder when connected */}
          <div className="bg-app-bg rounded-xl px-4 py-3 border border-app">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Webhook URL (for Meta App)</p>
            <code className="text-xs font-mono text-indigo-700 break-all select-all">
              {DISPLAY_WEBHOOK_URL}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
