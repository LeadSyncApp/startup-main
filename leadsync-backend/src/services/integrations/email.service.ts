import nodemailer from 'nodemailer';
import { Resend } from 'resend';

console.log('🔧 Email service initializing...');

// Environment-based provider selection
const useResend = !!process.env.RESEND_API_KEY;
const useSmtp = !useResend && !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// Validate required environment variables
if (useResend) {
  if (!process.env.RESEND_API_KEY || !process.env.SMTP_FROM) {
    console.error('❌ Email service - Missing Resend configuration');
    throw new Error('Missing required Resend environment variables: RESEND_API_KEY, SMTP_FROM');
  }
  
  console.log('📧 Email service - Using Resend provider with sender:', process.env.SMTP_FROM);
} else if (useSmtp) {
  const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missingVars = requiredSmtpVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ Email service - Missing SMTP environment variables:', missingVars.join(', '));
    throw new Error(`Missing required SMTP environment variables: ${missingVars.join(', ')}`);
  }
  console.log('📧 Email service - Using SMTP provider');
} else {
  console.error('❌ Email service - No email provider configured');
  throw new Error('No email provider configured. Set RESEND_API_KEY for Resend or SMTP_* variables for SMTP.');
}

// Initialize Resend client (if configured)
let resendClient: Resend | null = null;
if (useResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

// Lazy SMTP transporter - created only when needed (fallback)
let smtpTransporter: nodemailer.Transporter | null = null;

const createSmtpTransporter = (): nodemailer.Transporter => {
  if (!smtpTransporter && useSmtp) {
    console.log('📧 Creating SMTP transporter...');
    
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      family: 4, // Force IPv4
      requireTLS: true, // Force TLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        servername: process.env.SMTP_HOST,
      },
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 30000, // 30 seconds
    } as nodemailer.TransportOptions);
    
    console.log('✅ SMTP transporter created successfully');
  }
  return smtpTransporter!;
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const fromAddress = process.env.SMTP_FROM || '';
    console.log('📤 Email service - Sending email:', {
      to: options.to,
      subject: options.subject,
      from: fromAddress,
      provider: useResend ? 'Resend' : 'SMTP',
      isProduction: process.env.NODE_ENV === 'production',
    });

    if (useResend && resendClient) {
      // Use Resend for production
      const result = await resendClient.emails.send({
        from: fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || '',
        replyTo: options.replyTo || fromAddress,
        headers: {
          'X-Mailer': 'LeadSync CRM',
          'Precedence': 'bulk',
        },
      });
      
      // Check for actual Resend API errors
      if (result.error || !result.data) {
        console.error('❌ Email service - Resend API error:', {
          error: result.error,
          data: result.data,
          to: options.to,
          subject: options.subject,
          provider: 'Resend',
        });
        throw new Error(`Resend API error: ${result.error?.message || 'Unknown error'}`);
      }
      
      console.log('✅ Email service - Resend email sent successfully:', {
        fullResponse: result,
        messageId: result.data?.id,
        to: options.to,
        subject: options.subject,
        provider: 'Resend',
      });
    } else if (useSmtp) {
      // Use SMTP as fallback with spam-reducing headers
      const transporter = createSmtpTransporter();

      const mailOptions: any = {
        from: fromAddress,
        to: options.to,
        replyTo: options.replyTo || fromAddress,
        subject: options.subject,
        html: options.html,
        text: options.text || '',
        headers: {
          'X-Mailer': 'LeadSync CRM',
          'Precedence': 'bulk',
          'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
          'Auto-Submitted': 'auto-generated',
        },
        // List-Unsubscribe header signals to Gmail/Outlook this is legitimate transactional mail
        list: {
          unsubscribe: {
            url: process.env.FRONTEND_URL || 'https://leadsync.app',
            comment: 'Manage notification preferences in your account settings',
          },
        },
      };

      const result = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email service - SMTP email sent successfully:', {
        messageId: result.messageId,
        response: result.response,
        to: options.to,
        subject: options.subject,
      });
    } else {
      throw new Error('No email provider available');
    }
  } catch (error) {
    console.error('❌ Email service - Failed to send email:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject,
      provider: useResend ? 'Resend' : 'SMTP',
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
          <p>You received this because a password reset was requested for your account.</p>
          <p>© 2024 LeadSync CRM. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const generateInviteEmailHtml = (inviterName: string, companyName: string, inviteUrl: string, role: string, staffId: string | null, message: string | null): string => {
  const roleLabel = role === "MANAGER" ? "Manager" : "Staff Member";
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to LeadSync CRM</title>
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
          padding-bottom: 20px;
          border-bottom: 2px solid #d4a843;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #d4a843;
          margin-bottom: 5px;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background-color: #d4a843;
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #c49a36;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          font-size: 14px;
          color: #666;
          text-align: center;
        }
        .role-badge {
          display: inline-block;
          padding: 6px 16px;
          background-color: #fef3c7;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin: 10px 0;
        }
        .info-box {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
          margin: 16px 0;
        }
        .info-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #9ca3af;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #333;
          font-family: 'Courier New', monospace;
        }
        .message-box {
          background-color: #fef3c7;
          border-left: 4px solid #d4a843;
          padding: 16px;
          margin: 16px 0;
          border-radius: 4px;
          font-style: italic;
          color: #6b5b2d;
        }
        .expiry {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 4px;
          padding: 12px;
          margin: 20px 0;
          color: #92400e;
          font-size: 14px;
        }
        .url-display {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin: 16px 0;
          word-break: break-all;
          font-size: 13px;
          color: #d4a843;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">LeadSync CRM</div>
          <h1 style="color: #333; font-size: 22px;">You're Invited</h1>
        </div>
        
        <p>Hello,</p>
        
        <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on LeadSync CRM as a <strong>${roleLabel}</strong>.</p>
        
        <div style="text-align: center;">
          <span class="role-badge">${roleLabel}</span>
        </div>

        ${staffId ? `
        <div class="info-box">
          <div class="info-label">Your Staff ID</div>
          <div class="info-value">${staffId}</div>
        </div>
        ` : ''}

        ${message ? `
        <div class="message-box">
          "${message}"
        </div>
        ` : ''}

        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </div>
        
        <div class="expiry">
          <strong>Note:</strong> This invitation link expires in 7 days.
        </div>

        <p style="font-size: 14px; color: #666;">
          If the button above does not work, copy and paste the following link into your browser:
        </p>
        <div class="url-display">${inviteUrl}</div>

        <p style="font-size: 14px; color: #666;">
          If you have any questions, please reach out to ${inviterName} at your company.
        </p>
        
        <div class="footer">
          <p>This invitation was sent on behalf of ${companyName} using LeadSync CRM.</p>
          <p>You received this because ${inviterName} invited you to join their team on LeadSync.</p>
          <p>© 2024 LeadSync CRM. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};