interface TelegramIntegrationProps {
  telegramConnected: boolean;
  telegramUsername: string | null;
  botToken: string;
  setBotToken: (value: string) => void;
  handleConnectTelegram: () => void;
  handleDisconnectTelegram: () => void;
}

export function TelegramIntegration({
  telegramConnected,
  telegramUsername,
  botToken,
  setBotToken,
  handleConnectTelegram,
  handleDisconnectTelegram,
}: TelegramIntegrationProps) {
  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border space-y-4" id="telegram-integration-section">
      <h2 className="text-lg font-semibold">
        Telegram Integration
      </h2>

      {!telegramConnected ? (
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ex: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            id="btn-connect-telegram"
            onClick={handleConnectTelegram}
            disabled={!botToken}
            className={`bg-blue-600 text-white px-4 py-2 rounded-lg ${!botToken ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
          >
            Connect Bot
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.17 2.06c.36-.08.73.13.84.48.06.19.03.39-.08.55L11.54 18.5l-6-3.8 2.5-1.55L19.42 3.12a.6.6 0 0 1 1.75-1.06zM2 12v3l5 3v-3H2z" /></svg>
            </div>
            <div>
              <p className="font-medium text-green-900">
                Bot Active
              </p>
              <p className="text-sm text-green-700">
                {telegramUsername ? `@${telegramUsername}` : "Connected"}
              </p>
            </div>
          </div>

          <button
            id="btn-disconnect-telegram"
            onClick={handleDisconnectTelegram}
            className="text-red-500 text-sm hover:underline hover:text-red-600 px-3 py-1 bg-app-surface border border-red-100 rounded-lg shadow-sm"
          >
            Disconnect
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-2">
        Paste your bot token from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 underline">BotFather</a> to connect.
      </p>
    </div>
  );
}
