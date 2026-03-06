import { Resend } from 'resend';

const FROM_ADDRESS = process.env.EMAIL_FROM || 'DocAssistAI <noreply@docassistai.app>';
const APP_URL = process.env.FRONTEND_URL || 'https://www.docassistai.app';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] (no RESEND_API_KEY) To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    const result = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    console.log(`[email] Sent to ${to} | Subject: ${subject} | id: ${result.data?.id ?? 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err);
  }
}

export class EmailService {
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    await send(toEmail, 'Reset your DocAssistAI password', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Reset your password</h2>
        <p>Click the link below to set a new password. This link expires in 30 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `);
  }

  async sendPasswordResetOtpEmail(toEmail: string, otp: string): Promise<void> {
    await send(toEmail, `${otp} is your DocAssistAI verification code`, `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Your verification code</h2>
        <p>Enter this code to reset your password. It expires in 15 minutes.</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a">
          ${otp}
        </div>
        <p style="color:#64748b;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `);
  }

  async sendTrialExpiringEmail(toEmail: string, daysLeft: number): Promise<void> {
    await send(toEmail, `Your DocAssistAI trial ends in ${daysLeft} days`, `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Your free trial is ending soon</h2>
        <p>You have <strong>${daysLeft} days</strong> left on your DocAssistAI trial.</p>
        <p>Add a payment method to keep using all features after your trial ends. Your notes and settings will be saved.</p>
        <a href="${APP_URL}/scribe/account" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Add Payment Method
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">$20/month after your trial. Cancel anytime.</p>
      </div>
    `);
  }

  async sendSubscriptionExpiredEmail(toEmail: string): Promise<void> {
    await send(toEmail, 'Your DocAssistAI access has expired', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Your subscription has expired</h2>
        <p>Your DocAssistAI trial or subscription has ended. Add a payment method to restore access.</p>
        <p>Don't worry — all your notes and settings are safe and waiting for you.</p>
        <a href="${APP_URL}/scribe/account" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Restore Access
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">Questions? Reply to this email or contact admin@docassistai.app.</p>
      </div>
    `);
  }

  async sendPaymentFailedEmail(toEmail: string): Promise<void> {
    await send(toEmail, 'DocAssistAI payment failed — action needed', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">We couldn't process your payment</h2>
        <p>Your monthly DocAssistAI subscription payment of $20 failed. Please update your payment method to continue using the app.</p>
        <a href="${APP_URL}/scribe/account" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Update Payment Method
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">Your access has been paused until payment is resolved. Your notes and settings are safe.</p>
      </div>
    `);
  }
}

export const emailService = new EmailService();
