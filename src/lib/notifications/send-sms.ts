const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER
const TO_NUMBER = process.env.ADMIN_CELL_NUMBER
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function sendSms(body: string): Promise<void> {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER || !TO_NUMBER) {
    console.warn('[sms] Twilio env vars not set — skipping SMS')
    return
  }

  const params = new URLSearchParams({ From: FROM_NUMBER, To: TO_NUMBER, Body: body })

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
      },
      body: params,
    })
    if (!res.ok) {
      console.error('[sms] Twilio send failed:', await res.text())
    }
  } catch (err) {
    console.error('[sms] Twilio send failed:', err)
  }
}
