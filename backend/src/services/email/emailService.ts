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

function formatTrialDate(isoDate: string): string {
  if (!isoDate) return 'soon';
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export class EmailService {
  async sendTrialWelcomeEmail(toEmail: string, trialEndsAt: string): Promise<void> {
    const endDate = formatTrialDate(trialEndsAt);
    await send(toEmail, 'Welcome to DocAssistAI — your 7-day trial is active!', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Welcome to DocAssistAI!</h2>
        <p>Your free 7-day trial is now active. Here's what you can do:</p>
        <ul style="padding-left:20px;color:#334155">
          <li><strong>Record patient encounters</strong> — use your microphone or paste transcripts</li>
          <li><strong>Generate clinical notes</strong> — SOAP, H&P, progress notes, and more</li>
          <li><strong>Customize templates</strong> — tailor note sections to your workflow</li>
        </ul>
        <p>Your trial ends on <strong>${endDate}</strong>. No credit card is required during your trial.</p>
        <a href="${APP_URL}/scribe/dashboard" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Start Documenting
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">Questions? Reply to this email or contact admin@docassistai.app.</p>
      </div>
    `);
  }

  async sendTrialMidpointEmail(toEmail: string, trialEndsAt: string): Promise<void> {
    const endDate = formatTrialDate(trialEndsAt);
    await send(toEmail, 'Your DocAssistAI trial is halfway done', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">Your trial is halfway through!</h2>
        <p>Just a friendly reminder — your DocAssistAI free trial ends on <strong>${endDate}</strong>.</p>
        <p>Have you tried all the features?</p>
        <ul style="padding-left:20px;color:#334155">
          <li>Create notes from live recordings or pasted transcripts</li>
          <li>Customize note templates for your specialty</li>
          <li>Use billing code suggestions for faster coding</li>
        </ul>
        <p>To keep using DocAssistAI after your trial, add a payment method to your account.</p>
        <a href="${APP_URL}/scribe/account" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Add Payment Method
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">Plans start at $20/month. Cancel anytime.</p>
      </div>
    `);
  }

  async sendTrialUrgentEmail(toEmail: string, trialEndsAt: string): Promise<void> {
    const endDate = formatTrialDate(trialEndsAt);
    await send(toEmail, 'Your DocAssistAI trial ends tomorrow!', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626">Your trial ends tomorrow!</h2>
        <p>Your DocAssistAI free trial ends on <strong>${endDate}</strong>. After that, you'll lose access to note generation and your dashboard.</p>
        <p><strong>Don't worry</strong> — your existing notes and settings will be saved and waiting for you.</p>
        <p>Add a payment method now to continue without interruption:</p>
        <a href="${APP_URL}/scribe/account" style="display:inline-block;background:#2dd4bf;color:#0f172a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">
          Continue Using DocAssistAI
        </a>
        <p style="color:#64748b;font-size:13px;margin-top:24px">Plans start at $20/month or $200/year (save $40). Cancel anytime.</p>
      </div>
    `);
  }

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

  async sendCoderInviteEmail(to: string, managerName: string, teamName: string, inviteToken: string): Promise<void> {
    const acceptUrl = `${APP_URL}/coder/join/${inviteToken}`;
    await send(to, `You're invited to join ${teamName} on DocAssistAI CodeAssist`, `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">You've Been Invited</h1>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          <strong>${managerName}</strong> has invited you to join <strong>${teamName}</strong> as a billing coder on DocAssistAI CodeAssist.
        </p>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          CodeAssist helps billing coders extract ICD-10, CPT, and E&M codes from clinical notes with AI assistance.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background: #14b8a6; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
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
