export class EmailService {
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email] Password reset requested for ${toEmail}: ${resetUrl}`);
    }
  }
}

export const emailService = new EmailService();
