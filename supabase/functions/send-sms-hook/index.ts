// Supabase Auth "Send SMS" hook → Fast2SMS (India). Same provider and fallback behaviour as
// NearbyU's backend/src/modules/auth/otpSender.ts:
//   1. "otp" route (cheap; needs the website verified in Fast2SMS → OTP Message menu)
//   2. on status 996 (not verified yet) falls back to "q" (Quick SMS; no DLT, costs more)
// Without FAST2SMS_API_KEY the OTP is only logged (Dashboard → Edge Functions → Logs) so
// testing still works. Switching provider (MSG91, 2Factor…) only changes this file.
import { Webhook } from 'npm:standardwebhooks@1.0.0';

interface SmsHookPayload {
  user: { phone: string };
  sms: { otp: string };
}

function hookError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendViaFast2Sms(apiKey: string, phone: string, otp: string): Promise<boolean> {
  const numbers = phone.replace(/^\+?91/, '');
  const post = (payload: Record<string, string>) =>
    fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, numbers }),
    });

  let response = await post({ route: 'otp', variables_values: otp });
  let body = (await response.json().catch(() => null)) as { return?: boolean; status_code?: number } | null;
  if (!body?.return && body?.status_code === 996) {
    response = await post({
      route: 'q',
      message: `Your Housie Tambola King code is ${otp}. Do not share it with anyone.`,
      flash: '0',
    });
    body = (await response.json().catch(() => null)) as typeof body;
  }
  if (!response.ok || !body?.return) {
    console.error('Fast2SMS failed', { status: response.status, body });
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const hookSecret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
  if (!hookSecret) return hookError('SMS hook secret not configured');

  let payload: SmsHookPayload;
  try {
    const wh = new Webhook(hookSecret);
    payload = wh.verify(rawBody, Object.fromEntries(req.headers)) as SmsHookPayload;
  } catch {
    return hookError('Invalid hook signature', 401);
  }

  const phone = payload.user.phone;
  const otp = payload.sms.otp;
  if (!/^\+?91[6-9]\d{9}$/.test(phone)) {
    return hookError('Only Indian mobile numbers are supported', 400);
  }

  const apiKey = Deno.env.get('FAST2SMS_API_KEY');
  if (!apiKey) {
    console.log('OTP generated (no SMS provider configured — not sent)', { phone, otp });
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const sent = await sendViaFast2Sms(apiKey, phone, otp).catch((err) => {
    console.error('Fast2SMS error', err);
    return false;
  });
  if (!sent) return hookError('Could not send the SMS. Please try again.');
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
