interface SendSmsParams {
  to: string      // E.164 format: +4512345678
  message: string
}

interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendSms({ to, message }: SendSmsParams): Promise<SendSmsResult> {
  const token = process.env.GATEWAYAPI_TOKEN
  if (!token) {
    console.error('GATEWAYAPI_TOKEN not set')
    return { success: false, error: 'SMS not configured' }
  }

  try {
    const response = await fetch('https://gatewayapi.com/rest/mtsms', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'DesignKlip',
        recipients: [{ msisdn: to.replace('+', '') }],
        message: message,
        encoding: 'UTF8',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('GatewayAPI error:', response.status, errorText)
      return { success: false, error: `GatewayAPI ${response.status}` }
    }

    const data = (await response.json()) as { ids?: (number | string)[] }
    return {
      success: true,
      messageId: String(data.ids?.[0] ?? ''),
    }
  } catch (err) {
    console.error('SMS send failed:', err)
    return { success: false, error: String(err) }
  }
}
