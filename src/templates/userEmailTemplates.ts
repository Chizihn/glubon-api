import { EmailTemplate } from './email';
import { generateBaseTemplate } from './baseTemplate';

export class UserEmailTemplates {
  static welcomeEmail(firstName: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: 'Welcome to Glubon!',
      subtitle: 'Your Journey to Seamless Property Rentals',
      content: `
        <h2>Hello ${firstName}!</h2>
        <p>We're thrilled to welcome you to Glubon, Nigeria's leading platform for property rentals. Discover your perfect home or list your property with ease.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8;">
          <p><strong>Explore Glubon's Features:</strong></p>
          <ul style="list-style: none;">
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Browse verified properties
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Search rentals by location
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Connect with property owners
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Save favorite listings
            </li>
            <li style="display: flex; align-items: center;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Secure rental process
            </li>
          </ul>
        </div>
        <p>Ready to begin?</p>
      `,
      cta: {
        text: 'Get Started',
        url: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    return {
      subject: 'Welcome to Glubon - Start Your Property Journey!',
      html,
      text
    };
  }

  static oauthWelcomeEmail(firstName: string, provider: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: 'Welcome to Glubon!',
      subtitle: 'Your Journey to Seamless Property Rentals',
      content: `
        <h2>Hello ${firstName}!</h2>
        <p>Thank you for joining Glubon with your ${provider} account. Your email has been verified, and you're ready to explore.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8;">
          <p><strong>Explore Glubon's Features:</strong></p>
          <ul style="list-style: none;">
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Browse verified properties
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Search rentals by location
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Connect with property owners
            </li>
            <li style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Save favorite listings
            </li>
            <li style="display: flex; align-items: center;">
              <span style="color: #1d4ed8; margin-right: 12px;">✓</span> Secure rental process
            </li>
          </ul>
        </div>
        <p>Enhance your account security by setting a password in your profile.</p>
      `,
      cta: {
        text: 'Get Started',
        url: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    return {
      subject: 'Welcome to Glubon!',
      html,
      text
    };
  }

  static verificationCode(
    firstName: string,
    codeOrLink: string,
    purpose: 'email_verification' | 'password_reset'
  ): EmailTemplate {
    const purposeText = purpose === 'email_verification' 
      ? 'Verify Your Email' 
      : 'Reset Your Password';
    
    const actionText = purpose === 'email_verification'
      ? 'verify your email address'
      : 'reset your password';

    const isLink = codeOrLink.startsWith('http');
    const code = isLink ? codeOrLink.split('token=')[1]?.split('&')[0] || '' : codeOrLink;
    const displayCode = code.length > 8 ? `${code.substring(0, 4)}...${code.slice(-4)}` : code;

    const { html, text } = generateBaseTemplate({
      title: purposeText,
      content: `
        <h2>Hello ${firstName},</h2>
        <p>You're receiving this email because you requested to ${actionText} for your Glubon account.</p>
        
        <div style="background: #F0F9FF; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #0EA5E9;">
          <p style="color: #0369A1; font-weight: 500; margin: 0 0 12px 0;">
            ${isLink ? 'Click the button below to continue:' : 'Use the following verification code:'}
          </p>
          
          ${isLink ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${codeOrLink}" class="button" style="background-color: #1D4ED8; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; transition: all 0.2s ease;">
                ${purpose === 'email_verification' ? 'Verify Email' : 'Reset Password'}
              </a>
            </div>
            <p style="color: #6B7280; font-size: 14px; text-align: center; margin: 16px 0 0 0;">
              Or copy and paste this link in your browser:<br>
              <span style="word-break: break-all; color: #3B82F6;">${codeOrLink}</span>
            </p>
          ` : `
            <div style="font-size: 28px; font-weight: 700; color: #1D4ED8; background: #EFF6FF; padding: 20px; border-radius: 8px; margin: 16px 0; letter-spacing: 2px; text-align: center; font-family: monospace;">
              ${displayCode}
            </div>
          `}
        </div>
        
        <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
            <strong>Security Notice:</strong> This ${isLink ? 'link' : 'verification code'} will expire in 1 hour. 
            If you didn't request this, please ignore this email or contact our support team immediately.
          </p>
        </div>
        
        <p style="color: #6B7280; font-size: 14px; margin: 24px 0 0 0;">
          <strong>Need help?</strong> Contact our support team at 
          <a href="mailto:support@glubon.com" style="color: #3B82F6; text-decoration: none;">support@glubon.com</a> 
          or visit our <a href="${process.env.FRONTEND_URL || 'https://glubon.com'}/help" style="color: #3B82F6; text-decoration: none;">Help Center</a>.
        </p>
      `,
      cta: isLink ? {
        text: purpose === 'email_verification' ? 'Verify Email' : 'Reset Password',
        url: codeOrLink
      } : undefined
    });

    const subject = purpose === 'email_verification'
      ? 'Verify Your Glubon Account'
      : 'Reset Your Glubon Password';

    return {
      subject,
      html,
      text: `${subject}
${'='.repeat(subject.length)}

Hello ${firstName},

You're receiving this email because you requested to ${actionText} for your Glubon account.

${isLink 
  ? `To continue, please click the link below:
${codeOrLink}

Or copy and paste the link into your browser.` 
  : `Your verification code is:

${code}

Enter this code in the verification page to continue.`
}

This ${isLink ? 'link' : 'verification code'} will expire in 1 hour.

If you didn't request this, please ignore this email or contact our support team immediately.

---
Need help? Contact our support team at support@glubon.com or visit ${process.env.FRONTEND_URL || 'https://glubon.com'}/help

© ${new Date().getFullYear()} Glubon. All rights reserved.`
    };
  }

  static accountLinkedEmail(firstName: string, provider: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: 'Account Linked',
      subtitle: `Your ${provider} Account is Connected`,
      content: `
        <h2>Hello ${firstName}!</h2>
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8;">
          <p>Your ${provider} account is now linked to Glubon.</p>
          <p>You can now sign in with either your ${provider} account or your email/password.</p>
        </div>
        <p>If you didn't link this account, please contact our support team immediately.</p>
      `,
      cta: {
        text: 'Go to Dashboard',
        url: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    return {
      subject: 'Your Glubon Account is Linked!',
      html,
      text: `Hi ${firstName}, Your ${provider} account is now linked to Glubon. Access your dashboard at ${process.env.FRONTEND_URL}/dashboard. Contact support at ${process.env.FRONTEND_URL}/support.`
    };
  }

  static notificationEmail(
    firstName: string,
    title: string,
    message: string,
    type: string
  ): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title,
      content: `
        <h2>Hello ${firstName},</h2>
        <p>${message}</p>
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>${title}</strong></p>
          <p>${message}</p>
        </div>
        <p>Thank you for using Glubon.</p>
      `,
      cta: {
        text: 'View in Dashboard',
        url: `${process.env.FRONTEND_URL}/dashboard`
      },
      footerLinks: [
        { text: 'Notification Settings', url: `${process.env.FRONTEND_URL}/settings/notifications` },
        { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` }
      ]
    });

    return {
      subject: `Glubon ${type === 'alert' ? '🔔' : 'ℹ️'} ${title}`,
      html,
      text: `Hello ${firstName},\n\n${title}\n${message}\n\nView in dashboard: ${process.env.FRONTEND_URL}/dashboard`
    };
  }

  static userStatusChangeNotification(
    firstName: string,
    status: string,
    reason?: string
  ): EmailTemplate {
    const isSuspension = status.toLowerCase().includes('suspend');
    const title = isSuspension ? 'Account Suspension Notice' : 'Account Status Update';
    
    const { html, text } = generateBaseTemplate({
      title,
      content: `
        <h2>Hello ${firstName},</h2>
        <p>Your account status has been updated to: <strong>${status}</strong></p>
        
        ${reason ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
        ` : ''}
        
        <p>${isSuspension 
          ? 'Your account has been temporarily suspended. You will not be able to access certain features during this time.'
          : 'Your account status has been updated. You may now have access to additional features.'}
        </p>
        
        ${isSuspension ? `
          <p>If you believe this is a mistake or have any questions, please contact our support team.</p>
        ` : ''}
      `,
      cta: isSuspension ? {
        text: 'Contact Support',
        url: `${process.env.FRONTEND_URL}/support`
      } : {
        text: 'Go to Dashboard',
        url: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    return {
      subject: `Glubon: ${title}`,
      html,
      text: `Hello ${firstName},\n\nYour account status has been updated to: ${status}\n\n${reason ? `Reason: ${reason}\n\n` : ''}${isSuspension 
        ? 'Your account has been temporarily suspended. Contact support for assistance.' 
        : 'Your account status has been updated.'}`
    };
  }
}
