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
    code: string,
    purpose: 'email_verification' | 'password_reset'
  ): EmailTemplate {
    const purposeText = purpose === 'email_verification' 
      ? 'Email Verification' 
      : 'Password Reset';
    
    const actionText = purpose === 'email_verification'
      ? 'verify your email'
      : 'reset your password';

    const { html, text } = generateBaseTemplate({
      title: purposeText,
      content: `
        <h2>Hello ${firstName}!</h2>
        <p>Use the code below to ${actionText}:</p>
        <div style="font-size: 32px; font-weight: 700; color: #1d4ed8; background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; text-align: center;">
          ${code}
        </div>
        <div style="background: #fef3c7; border: 1px solid #fde68a; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 15px;">
          <p><strong>⚠ Security Notice:</strong> This code expires in 15 minutes. Ignore if you didn't request it.</p>
        </div>
        <p>Never share this code with anyone.</p>
      `
    });

    return {
      subject: `Glubon ${purposeText} Code: ${code}`,
      html,
      text: `Hello ${firstName}, Your Glubon ${purposeText.toLowerCase()} code is: ${code}. It expires in 15 minutes. Contact support at ${process.env.FRONTEND_URL}/support.`
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
