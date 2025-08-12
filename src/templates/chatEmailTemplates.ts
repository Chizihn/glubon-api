import { EmailTemplate } from './email';
import { generateBaseTemplate } from './baseTemplate';

export class ChatEmailTemplates {
  static chatNotification(
    recipientName: string,
    senderName: string,
    propertyTitle: string,
    messagePreview: string,
    chatId: string
  ): EmailTemplate {
    const chatUrl = `${process.env.FRONTEND_URL}/messages/${chatId}`;
    
    const { html, text } = generateBaseTemplate({
      title: 'New Message Received',
      content: `
        <h2>Hello ${recipientName},</h2>
        <p>You've received a new message from <strong>${senderName}</strong> regarding the property <strong>${propertyTitle}</strong>.</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>${senderName}:</strong></p>
          <p>${messagePreview}</p>
        </div>
        
        <p>Please log in to your account to view and respond to this message.</p>
      `,
      cta: {
        text: 'View Message',
        url: chatUrl
      },
      footerLinks: [
        { text: 'Message Settings', url: `${process.env.FRONTEND_URL}/settings/notifications` },
        { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` }
      ]
    });

    return {
      subject: `New message from ${senderName} about ${propertyTitle}`,
      html,
      text: `Hello ${recipientName},\n\nYou've received a new message from ${senderName} about the property "${propertyTitle}":\n\n${messagePreview}\n\nView and respond: ${chatUrl}`
    };
  }

  static propertyInquiry(
    ownerName: string,
    inquirerName: string,
    propertyTitle: string,
    inquiryMessage: string,
    chatId: string
  ): EmailTemplate {
    const chatUrl = `${process.env.FRONTEND_URL}/messages/${chatId}`;
    
    const { html, text } = generateBaseTemplate({
      title: 'New Property Inquiry',
      content: `
        <h2>Hello ${ownerName},</h2>
        <p>You've received a new inquiry for your property <strong>${propertyTitle}</strong> from ${inquirerName}.</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p><strong>Message from ${inquirerName}:</strong></p>
          <p>${inquiryMessage}</p>
        </div>
        
        <p>Please respond promptly to increase your chances of securing a rental agreement.</p>
      `,
      cta: {
        text: 'Respond to Inquiry',
        url: chatUrl
      },
      footerLinks: [
        { text: 'View All Messages', url: `${process.env.FRONTEND_URL}/messages` },
        { text: 'View Property', url: `${process.env.FRONTEND_URL}/properties/${chatId.split('_')[0]}` }
      ]
    });

    return {
      subject: `New inquiry for ${propertyTitle} from ${inquirerName}`,
      html,
      text: `Hello ${ownerName},\n\nYou've received a new inquiry for your property "${propertyTitle}" from ${inquirerName}:\n\n${inquiryMessage}\n\nRespond now: ${chatUrl}`
    };
  }

  static propertyLiked(
    ownerName: string,
    likerName: string,
    propertyTitle: string,
    propertyId: string
  ): EmailTemplate {
    const propertyUrl = `${process.env.FRONTEND_URL}/properties/${propertyId}`;
    const likerProfileUrl = `${process.env.FRONTEND_URL}/users/${likerName.toLowerCase().replace(/\s+/g, '-')}`;
    
    const { html, text } = generateBaseTemplate({
      title: 'Your Property Was Liked',
      content: `
        <h2>Hello ${ownerName},</h2>
        <p><strong>${likerName}</strong> liked your property <strong>${propertyTitle}</strong>.</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #1d4ed8; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p>This shows strong interest in your property. Consider reaching out to discuss potential rental opportunities.</p>
        </div>
        
        <p>View your property's dashboard to see more details about this interaction.</p>
      `,
      cta: {
        text: 'View Property',
        url: propertyUrl
      },
      footerLinks: [
        { text: 'View Profile', url: likerProfileUrl },
        { text: 'View All Likes', url: `${process.env.FRONTEND_URL}/dashboard/properties/${propertyId}/activity` }
      ]
    });

    return {
      subject: `🎉 ${likerName} liked your property ${propertyTitle}`,
      html,
      text: `Hello ${ownerName},\n\n${likerName} liked your property "${propertyTitle}". This shows strong interest in your listing.\n\nView property: ${propertyUrl}\nView profile: ${likerProfileUrl}`
    };
  }
}
