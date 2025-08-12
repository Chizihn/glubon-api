import { EmailTemplate } from './email';
import { generateBaseTemplate } from './baseTemplate';

export class AdminEmailTemplates {
  static adminWelcomeEmail(firstName: string, temporaryPassword: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: 'Welcome to Glubon Admin',
      content: `
        <h2>Hello ${firstName}!</h2>
        <p>Your Glubon Admin account has been successfully created. Here are your login details:</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
          <p><em>You'll be prompted to change this password on your first login.</em></p>
        </div>
        
        <p>For security reasons, please change your password immediately after logging in for the first time.</p>
      `,
      cta: {
        text: 'Login to Admin Dashboard',
        url: `${process.env.ADMIN_URL || process.env.FRONTEND_URL}/admin`
      }
    });

    return {
      subject: 'Welcome to Glubon Admin',
      html,
      text: `Hello ${firstName}, your Glubon Admin account is ready. Temporary password: ${temporaryPassword}. Login at ${process.env.ADMIN_URL || process.env.FRONTEND_URL}/admin`
    };
  }

  static adminAnnouncement(title: string, message: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: `Admin Announcement: ${title}`,
      content: `
        <h2>${title}</h2>
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          ${message}
        </div>
        <p>This is an important announcement from the Glubon Admin team.</p>
      `,
      cta: {
        text: 'Go to Dashboard',
        url: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    return {
      subject: `Glubon Announcement: ${title}`,
      html,
      text: `${title}\n\n${message.replace(/<[^>]*>?/gm, '')}\n\nGo to dashboard: ${process.env.FRONTEND_URL}/dashboard`
    };
  }

  static identityVerification(
    firstName: string,
    verificationType: string,
    approved: boolean
  ): EmailTemplate {
    const status = approved ? 'approved' : 'rejected';
    const statusEmoji = approved ? '✅' : '❌';
    const statusColor = approved ? '#10b981' : '#ef4444';
    
    const { html, text } = generateBaseTemplate({
      title: `Identity Verification ${statusEmoji}`,
      content: `
        <h2>Hello ${firstName},</h2>
        <p>Your ${verificationType} verification has been <strong style="color: ${statusColor};">${status}</strong>.</p>
        
        <div style="background: ${approved ? '#ecfdf5' : '#fef2f2'}; border-left: 4px solid ${statusColor}; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p>${approved 
            ? '🎉 Congratulations! Your verification was successful.' 
            : 'We were unable to verify your identity with the provided information.'}</p>
          
          ${!approved ? `
            <p>Possible reasons for rejection:</p>
            <ul style="margin: 8px 0 0 20px;">
              <li>Document is expired</li>
              <li>Document is not clear or complete</li>
              <li>Information doesn't match your profile</li>
              <li>Document type not accepted</li>
            </ul>
            <p style="margin-top: 12px;">You can submit a new verification request with corrected information.</p>
          ` : ''}
        </div>
        
        ${!approved ? `
          <p>If you believe this was a mistake, please contact our support team for assistance.</p>
        ` : ''}
      `,
      cta: approved ? {
        text: 'Go to Dashboard',
        url: `${process.env.FRONTEND_URL}/dashboard`
      } : {
        text: 'Update Verification',
        url: `${process.env.FRONTEND_URL}/settings/verification`
      }
    });

    return {
      subject: `Identity Verification ${approved ? 'Approved' : 'Rejected'} - Glubon`,
      html,
      text: `Hello ${firstName}, your ${verificationType} verification has been ${status}. ${approved 
        ? 'You can now access all features.' 
        : 'Please update your verification information.'}`
    };
  }

  static adminDeactivationNotification(firstName: string): EmailTemplate {
    const { html, text } = generateBaseTemplate({
      title: 'Admin Account Deactivated',
      content: `
        <h2>Hello ${firstName},</h2>
        <p>Your admin account has been deactivated by a system administrator.</p>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>Important:</strong> You no longer have administrative access to the Glubon platform.</p>
        </div>
        
        <p>If you believe this is a mistake, please contact the system administrator immediately.</p>
      `,
      cta: {
        text: 'Contact Support',
        url: `${process.env.FRONTEND_URL}/support`
      },
      footerLinks: [
        { text: 'Help Center', url: `${process.env.FRONTEND_URL}/help` },
        { text: 'Terms of Service', url: `${process.env.FRONTEND_URL}/terms` }
      ]
    });

    return {
      subject: 'Your Glubon Admin Access Has Been Deactivated',
      html,
      text: `Hello ${firstName},\n\nYour admin account has been deactivated by a system administrator. You no longer have administrative access to the Glubon platform.\n\nIf you believe this is a mistake, please contact support immediately at ${process.env.FRONTEND_URL}/support.`
    };
  }
}
