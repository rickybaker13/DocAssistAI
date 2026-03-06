export class EmailService {
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Password reset requested for ${toEmail}: ${resetUrl}`);
    }
  }

  async sendPasswordResetOtpEmail(toEmail: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Password reset OTP for ${toEmail}: ${otp}`);
    }
  }

  async sendTrialExpiringEmail(toEmail: string, daysLeft: number): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Trial expiring for ${toEmail}: ${daysLeft} days left`);
    }
    // TODO: Replace with real email provider (SendGrid, SES, etc.)
  }

  async sendSubscriptionExpiredEmail(toEmail: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Subscription expired for ${toEmail}`);
    }
    // TODO: Replace with real email provider
  }

  async sendPaymentFailedEmail(toEmail: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Payment failed for ${toEmail}`);
    }
    // TODO: Replace with real email provider
  }
}

export const emailService = new EmailService();
