export async function registerTelegramWebhook(
  botToken: string,
  integrationId: string
) {
  const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`

  const response = await fetch(telegramUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: `${process.env.API_BASE_URL}/api/telegram/webhook/${integrationId}`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to register webhook: ${error}`)
  }

  return response.json()
}
