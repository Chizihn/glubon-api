export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Re-export all template modules
export * from './userEmailTemplates';
export * from './propertyEmailTemplates';
export * from './adminEmailTemplates';
export * from './chatEmailTemplates';

/**
 * @deprecated Use the modular template classes instead:
 * - UserEmailTemplates
 * - PropertyEmailTemplates
 * - AdminEmailTemplates
 * - ChatEmailTemplates
 */
export class EmailTemplates {
  

  static chatNotification(
    recipientName: string,
    senderName: string,
    propertyTitle: string,
    messagePreview: string,
    chatId: string
  ): EmailTemplate {
    return {
      subject: `New Message from ${senderName} - ${propertyTitle}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Message</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .header p { font-size: 16px; opacity: 0.9; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .message-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8; }
            .message-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
            .message-card p.preview { font-style: italic; color: #6b7280; margin-bottom: 12px; }
            .message-card p.sender { font-size: 14px; color: #6b7280; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; transition: background-color 0.2s ease; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
            @media (max-width: 600px) {
              .container { margin: 10px; }
              .header { padding: 24px 16px; }
              .header h1 { font-size: 24px; }
              .content { padding: 24px; }
              .button { display: block; text-align: center; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 New Message</h1>
            </div>
            <div class="content">
              <h2>Hello ${recipientName}!</h2>
              <p>You have a new message from <strong>${senderName}</strong> about:</p>
              <div class="message-card">
                <h3>${propertyTitle}</h3>
                <p class="preview">"${messagePreview}..."</p>
                <p class="sender">From: ${senderName}</p>
              </div>
              <a href="${process.env.FRONTEND_URL}/chat/${chatId}" class="button">Reply Now</a>
              <p>Respond promptly to keep the conversation going!</p>
            </div>
            <div class="footer">
              <p>&copy; 202 Kiddies. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Manage Notifications</a> | <a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `New message from ${senderName} about "${propertyTitle}": "${messagePreview}..." Reply at ${process.env.FRONTEND_URL}/chat/${chatId}. Manage notifications at ${process.env.FRONTEND_URL}/settings/notifications.`,
    };
  }

  static notificationEmail(
    firstName: string,
    title: string,
    message: string,
    type: string
  ): EmailTemplate {
    return {
      subject: title,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; transition: background-color 0.2s ease; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
            @media (max-width: 600px) {
              .container { margin: 10px; }
              .header { padding: 24px 16px; }
              .header h1 { font-size: 24px; }
              .content { padding: 24px; }
              .button { display: block; text-align: center; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${title}</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>${message}</p>
              <p>Manage your notifications in your account settings.</p>
              <a href="${process.env.FRONTEND_URL}/settings/notifications" class="button">Manage Notifications</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a> | <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${firstName}, ${message} Manage notifications at ${process.env.FRONTEND_URL}/settings/notifications. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }
  static accountSuspended(firstName: string, reason?: string): EmailTemplate {
    return {
      subject: "Your Glubon Account Has Been Suspended",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Suspended</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Suspended</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Your Glubon account has been suspended.${
                reason ? ` Reason: ${reason}` : ""
              }</p>
              <p>If you believe this is a mistake, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, your Glubon account has been suspended.${
        reason ? ` Reason: ${reason}` : ""
      } Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static accountReactivated(firstName: string): EmailTemplate {
    return {
      subject: "Your Glubon Account Has Been Reactivated!",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Reactivated</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Reactivated</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Your Glubon account has been reactivated. Welcome back!</p>
              <p>You can now log in and continue using our services.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, your Glubon account has been reactivated. Welcome back! Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  /**
   * @deprecated Use AdminEmailTemplates.adminAnnouncement instead
   */
  static adminAnnouncement(title: string, message: string): EmailTemplate {
    return {
      subject: title,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${title}</h1>
            </div>
            <div class="content">
              <h2>Announcement</h2>
              <p>${message}</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${title}\n\n${message}\nContact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static inviteEmail(
    inviterName: string,
    inviteeEmail: string,
    inviteLink: string
  ): EmailTemplate {
    return {
      subject: `You are invited to join Glubon!`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Glubon</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; transition: background-color 0.2s ease; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited!</h1>
            </div>
            <div class="content">
              <h2>Hello,</h2>
              <p>${inviterName} has invited you to join Glubon. Click the button below to accept your invitation and get started.</p>
              <a href="${inviteLink}" class="button">Accept Invitation</a>
              <p>If you did not expect this invitation, you can ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `${inviterName} has invited you to join Glubon. Accept at: ${inviteLink}`,
    };
  }

  static reminderEmail(
    firstName: string,
    reminderText: string,
    actionLink?: string
  ): EmailTemplate {
    return {
      subject: "Reminder from Glubon",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reminder</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #f59e42 0%, #fbbf24 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; transition: background-color 0.2s ease; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reminder</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>${reminderText}</p>
              ${
                actionLink
                  ? `<a href="${actionLink}" class="button">Take Action</a>`
                  : ""
              }
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, ${reminderText}${
        actionLink ? ` Take action: ${actionLink}` : ""
      }`,
    };
  }

  static propertyInquiry(
    ownerName: string,
    inquirerName: string,
    propertyTitle: string,
    inquiryMessage: string,
    propertyId: string
  ): EmailTemplate {
    return {
      subject: `New Inquiry for ${propertyTitle}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Inquiry</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .inquiry { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Property Inquiry</h1>
            </div>
            <div class="content">
              <h2>Hello ${ownerName},</h2>
              <p>${inquirerName} sent an inquiry about your property "${propertyTitle}":</p>
              <div class="inquiry">
                <p>${inquiryMessage}</p>
              </div>
              <a href="${process.env.FRONTEND_URL}/properties/${propertyId}" class="button">View Property</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${ownerName}, ${inquirerName} sent an inquiry about your property "${propertyTitle}": ${inquiryMessage}. View: ${process.env.FRONTEND_URL}/properties/${propertyId}`,
    };
  }

  static propertyLiked(
    ownerName: string,
    likerName: string,
    propertyTitle: string,
    propertyId: string
  ): EmailTemplate {
    return {
      subject: `Your property was liked!`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Liked</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Property Liked</h1>
            </div>
            <div class="content">
              <h2>Hello ${ownerName},</h2>
              <p>${likerName} liked your property "${propertyTitle}".</p>
              <a href="${process.env.FRONTEND_URL}/properties/${propertyId}" class="button">View Property</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${ownerName}, ${likerName} liked your property "${propertyTitle}". View: ${process.env.FRONTEND_URL}/properties/${propertyId}`,
    };
  }

  static propertyViewed(
    ownerName: string,
    viewerName: string,
    propertyTitle: string,
    propertyId: string
  ): EmailTemplate {
    return {
      subject: `Your property was viewed!`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Viewed</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Property Viewed</h1>
            </div>
            <div class="content">
              <h2>Hello ${ownerName},</h2>
              <p>${viewerName} viewed your property "${propertyTitle}".</p>
              <a href="${process.env.FRONTEND_URL}/properties/${propertyId}" class="button">View Property</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${ownerName}, ${viewerName} viewed your property "${propertyTitle}". View: ${process.env.FRONTEND_URL}/properties/${propertyId}`,
    };
  }

  /**
   * @deprecated Use AdminEmailTemplates.adminWelcomeEmail instead
   */
  static adminWelcomeEmail(firstName: string, password: string): EmailTemplate {
    return {
      subject: "Welcome to Glubon Admin Panel",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome Admin</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Glubon Admin</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Congratulations! You've been granted admin access to the Glubon platform.</p>
              <p>You can now manage users, properties, and other administrative tasks. Log in to the admin panel to get started.</p>
              <a href="${process.env.FRONTEND_URL}/admin/login" class="button">Access Admin Panel</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${firstName}, You've been granted admin access to the Glubon platform. 

      Your password to access the admin platform is ${password}
      
      Log in to the admin panel to manage users and properties: ${process.env.FRONTEND_URL}/admin/login`,
    };
  }

  static userStatusChangeNotification(
    firstName: string,
    status: string,
    reason: string
  ): EmailTemplate {
    return {
      subject: `Your Glubon Account Status Update`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Status Update</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .status { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Status Update</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Your Glubon account status has been updated to: <strong>${status}</strong>.</p>
              <div class="status">
                <p>Please review your account details or contact support if you have any questions.</p>
              </div>
              <a href="${process.env.FRONTEND_URL}/account" class="button">View Account</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${firstName}, Your Glubon account status has been updated to: ${status}. Your account was changed for ${reason.toLocaleLowerCase()}
      
      View your account: ${process.env.FRONTEND_URL}/account`,
    };
  }

  static adminDeactivationNotification(firstName: string): EmailTemplate {
    return {
      subject: "Glubon Admin Access Deactivated",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Access Deactivated</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #fff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .button { display: inline-block; padding: 12px 24px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
            .button:hover { background: #1e40af; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Admin Access Deactivated</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName},</h2>
              <p>Your admin access to the Glubon platform has been deactivated.</p>
              <p>If you believe this is an error or have questions, please contact our support team.</p>
              <a href="${process.env.FRONTEND_URL}/support" class="button">Contact Support</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${firstName}, Your admin access to the Glubon platform has been deactivated. Contact support: ${process.env.FRONTEND_URL}/support`,
    };
  }
}
