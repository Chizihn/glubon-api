import { EmailTemplate } from './email';
import { generateBaseTemplate } from './baseTemplate';

export class PropertyEmailTemplates {
  static propertyAlert(
    firstName: string,
    propertyTitle: string,
    propertyId: string,
    alertType: 'new_match' | 'price_drop' | 'status_change'
  ): EmailTemplate {
    const alertTexts = {
      new_match: 'New Property Match',
      price_drop: 'Price Drop Alert',
      status_change: 'Property Status Update'
    };

    const alertIcons = {
      new_match: '🎯',
      price_drop: '💰',
      status_change: '📊'
    };

    const propertyUrl = `${process.env.FRONTEND_URL}/properties/${propertyId}`;
    const notificationsUrl = `${process.env.FRONTEND_URL}/settings/notifications`;

    const { html, text } = generateBaseTemplate({
      title: 'Property Alert',
      subtitle: alertTexts[alertType],
      content: `
        <h2>Hello ${firstName}!</h2>
        <p>We found something you'll love:</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8;">
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">${propertyTitle}</h3>
          <p><strong>Alert:</strong> ${alertTexts[alertType]}</p>
          ${alertType === 'price_drop' ? '<p>💰 Price reduced!</p>' : ''}
          ${alertType === 'new_match' ? '<p>🎯 Matches your search criteria!</p>' : ''}
          ${alertType === 'status_change' ? '<p>📊 Status has been updated!</p>' : ''}
        </div>
        <p>Don't miss this opportunity!</p>
      `,
      cta: {
        text: 'View Property',
        url: propertyUrl
      },
      footerLinks: [
        { text: 'Manage Notifications', url: notificationsUrl },
        { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` },
        { text: 'Terms of Service', url: `${process.env.FRONTEND_URL}/terms` }
      ]
    });

    return {
      subject: `Glubon: ${alertTexts[alertType]} - ${propertyTitle}`,
      html,
      text: `Hello ${firstName}, ${alertTexts[alertType]} for "${propertyTitle}". View it at ${propertyUrl}. Manage notifications at ${notificationsUrl}.`
    };
  }

  static propertyApproval(
    ownerName: string,
    propertyTitle: string,
    propertyId: string,
    approved: boolean
  ): EmailTemplate {
    const status = approved ? 'Approved' : 'Rejected';
    const emoji = approved ? '✅' : '❌';
    const propertyUrl = `${process.env.FRONTEND_URL}/properties/${propertyId}`;
    const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

    const { html, text } = generateBaseTemplate({
      title: `Property ${status} ${emoji}`,
      content: `
        <h2>Hello ${ownerName}!</h2>
        <p>Your property listing <strong>${propertyTitle}</strong> has been <strong>${status.toLowerCase()}</strong> by our team.</p>
        
        <div style="background: ${approved ? '#ecfdf5' : '#fef2f2'}; border-left: 4px solid ${approved ? '#10b981' : '#ef4444'}; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p>${approved ? '🎉 Congratulations! Your property is now live on Glubon.' : 'We found some issues with your listing that need to be addressed.'}</p>
          ${!approved ? '<p>Please review our listing guidelines and update your property details accordingly.</p>' : ''}
        </div>
        
        ${approved ? `<p>You can view your live listing by clicking the button below:</p>` : ''}
      `,
      cta: approved ? {
        text: 'View Property',
        url: propertyUrl
      } : {
        text: 'Update Listing',
        url: `${dashboardUrl}/properties/${propertyId}/edit`
      }
    });

    return {
      subject: `Glubon: Property ${status} - ${propertyTitle}`,
      html,
      text: `Hello ${ownerName}, your property "${propertyTitle}" has been ${status.toLowerCase()}. ${approved ? `View it at ${propertyUrl}` : 'Please update your listing.'}`
    };
  }

  static propertyInquiry(
    ownerName: string,
    inquirerName: string,
    propertyTitle: string,
    inquiryMessage: string,
    propertyId: string
  ): EmailTemplate {
    const propertyUrl = `${process.env.FRONTEND_URL}/properties/${propertyId}`;
    const messagesUrl = `${process.env.FRONTEND_URL}/dashboard/messages`;

    const { html, text } = generateBaseTemplate({
      title: 'New Property Inquiry',
      content: `
        <h2>Hello ${ownerName}!</h2>
        <p>You've received a new inquiry for your property <strong>${propertyTitle}</strong> from ${inquirerName}.</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>${inquirerName}'s message:</strong></p>
          <p>"${inquiryMessage}"</p>
        </div>
        
        <p>Please respond to this inquiry as soon as possible to increase your chances of securing a rental.</p>
      `,
      cta: {
        text: 'View Property & Respond',
        url: propertyUrl
      },
      footerLinks: [
        { text: 'View All Messages', url: messagesUrl },
        { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` },
        { text: 'Manage Notifications', url: `${process.env.FRONTEND_URL}/settings/notifications` }
      ]
    });

    return {
      subject: `New Inquiry: ${propertyTitle}`,
      html,
      text: `Hello ${ownerName}, you've received a new inquiry for your property "${propertyTitle}" from ${inquirerName}. Message: "${inquiryMessage}". Respond at ${propertyUrl}`
    };
  }
}
