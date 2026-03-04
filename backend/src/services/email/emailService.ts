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
}

export const emailService = new EmailService();
