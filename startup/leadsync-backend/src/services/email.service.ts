import nodemailer from 'nodemailer';

console.log('🔧 Email service initializing...');

// Validate required environment variables
const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Email service - Missing environment variables:', missingVars.join(', '));
  throw new Error(`Missing required email environment variables: ${missingVars.join(', ')}`);
}

// Create transporter with environment-based configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration
transporter.verify((error: Error | null, success: boolean) => {
  if (error) {
    console.error('❌ Email service - Transporter verification failed:', error);
  } else {
    console.log('✅ Email service - Transporter ready');
  }
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    console.log('📤 Email service - Sending email:', {
      to: options.to,
      subject: options.subject,
      from: process.env.SMTP_FROM,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
    });

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || '',
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email service - Email sent successfully:', {
      messageId: result.messageId,
      response: result.response,
      to: options.to,
      subject: options.subject,
    });
  } catch (error) {
    console.error('❌ Email service - Failed to send email:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
    });
    throw error;
  }
};

export const generatePasswordResetHtml = (resetUrl: string, userName: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - LeadSync CRM</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #1d4ed8;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .expiry {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 4px;
          padding: 12px;
          margin: 20px 0;
          color: #92400e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">LeadSync CRM</div>
          <h1>Password Reset Request</h1>
        </div>
        
        <p>Hello ${userName},</p>
        
        <p>We received a request to reset your password for your LeadSync CRM account. Click the button below to reset your password:</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        
        <div class="expiry">
          <strong>Important:</strong> This link will expire in 10 minutes for security reasons.
        </div>
        
        <p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>
        
        <div class="footer">
          <p>This is an automated message from LeadSync CRM. Please do not reply to this email.</p>
          <p>© 2024 LeadSync CRM. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
