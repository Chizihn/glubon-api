export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailTemplates {
  static welcomeEmail(firstName: string): EmailTemplate {
    return {
      subject: "Welcome to Glubon - Start Your Property Journey!",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Glubon</title>
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
            .features { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .features ul { list-style: none; font-size: 15px; }
            .features li { display: flex; align-items: center; margin-bottom: 12px; }
            .features li::before { content: '✔'; color: #1d4ed8; margin-right: 12px; font-size: 18px; }
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
              <h1>Welcome to Glubon!</h1>
              <p>Your Journey to Seamless Property Rentals</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>We’re thrilled to welcome you to Glubon, Nigeria’s leading platform for property rentals. Discover your perfect home or list your property with ease.</p>
              <div class="features">
                <p><strong>Explore Glubon’s Features:</strong></p>
                <ul>
                  <li>Browse verified properties</li>
                  <li>Search rentals by location</li>
                  <li>Connect with property owners</li>
                  <li>Save favorite listings</li>
                  <li>Secure rental process</li>
                </ul>
              </div>
              <p>Ready to begin?</p>
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
              <p>Have questions? Our support team is here to assist.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a> | <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Glubon, ${firstName}! Nigeria’s leading platform for property rentals. Start your journey at ${process.env.FRONTEND_URL}/dashboard. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static oauthWelcomeEmail(firstName: string, provider: string): EmailTemplate {
    return {
      subject: "Welcome to Glubon!",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Glubon</title>
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
            .features { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .features ul { list-style: none; font-size: 15px; }
            .features li { display: flex; align-items: center; margin-bottom: 12px; }
            .features li::before { content: '✔'; color: #1d4ed8; margin-right: 12px; font-size: 18px; }
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
              <h1>Welcome to Glubon!</h1>
              <p>Your Journey to Seamless Property Rentals</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>Thank you for joining Glubon with your ${provider} account. Your email has been verified, and you’re ready to explore.</p>
              <div class="features">
                <p><strong>Explore Glubon’s Features:</strong></p>
                <ul>
                  <li>Browse verified properties</li>
                  <li>Search rentals by location</li>
                  <li>Connect with property owners</li>
                  <li>Save favorite listings</li>
                  <li>Secure rental process</li>
                </ul>
              </div>
              <p>Enhance your account security by setting a password in your profile.</p>
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
              <p>Have questions? Our support team is here to assist.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a> | <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Glubon, ${firstName}! You’ve joined with your ${provider} account. Start exploring at ${process.env.FRONTEND_URL}/dashboard. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static verificationCode(
    firstName: string,
    code: string,
    purpose: "email_verification" | "password_reset"
  ): EmailTemplate {
    const purposeText =
      purpose === "email_verification"
        ? "Email Verification"
        : "Password Reset";
    const actionText =
      purpose === "email_verification"
        ? "verify your email"
        : "reset your password";

    return {
      subject: `Glubon ${purposeText} Code: ${code}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${purposeText} Code</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; text-align: center; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .code { font-size: 32px; font-weight: 700; color: #1d4ed8; background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; }
            .warning { background: #fef3c7; border: 1px solid #fde68a; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 15px; }
            .footer { text-align: center; padding: 24px; background: #f8fafc; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .footer a { color: #1d4ed8; text-decoration: none; }
            .footer a:hover { text-decoration: underline; }
            @media (max-width: 600px) {
              .container { margin: 10px; }
              .header { padding: 24px 16px; }
              .header h1 { font-size: 24px; }
              .content { padding: 24px; }
              .code { font-size: 28px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${purposeText}</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>Use the code below to ${actionText}:</p>
              <div class="code">${code}</div>
              <div class="warning">
                <p><strong>⚠ Security Notice:</strong> This code expires in 15 minutes. Ignore if you didn’t request it.</p>
              </div>
              <p>Never share this code with anyone.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a> | <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, Your Glubon ${purposeText.toLowerCase()} code is: ${code}. It expires in 15 minutes. Contact support at ${
        process.env.FRONTEND_URL
      }/support.`,
    };
  }

  static accountLinkedEmail(
    firstName: string,
    provider: string
  ): EmailTemplate {
    return {
      subject: "Your Glubon Account is Linked!",
      html: `
        <!DOCTYPE html>
        <html gp lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Linked</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff;ugon border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .header p { font-size: 16px; opacity: 0.9; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8; }
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
              <h1>Account Linked</h1>
              <p>Your ${provider} Account is Connected</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <div class="card">
                <p>Your ${provider} account is now linked to Glubon.</p>
                <p>Sign in with either your ${provider} account or email/password.</p>
              </div>
              <p>If you didn’t link this account, contact support immediately.</p>
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${process.env.FRONTEND_URL}/support">Contact Support</a> | <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${firstName}, Your ${provider} account is linked to Glubon. Access your dashboard at ${process.env.FRONTEND_URL}/dashboard. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static propertyAlert(
    firstName: string,
    propertyTitle: string,
    propertyId: string,
    alertType: "new_match" | "price_drop" | "status_change"
  ): EmailTemplate {
    const alertTexts = {
      new_match: "New Property Match",
      price_drop: "Price Drop Alert",
      status_change: "Property Status Update",
    };

    return {
      subject: `Glubon: ${alertTexts[alertType]} - ${propertyTitle}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Alert</title>
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
            .property-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1d4ed8; }
            .property-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
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
              <h1>Property Alert</h1>
              <p>${alertTexts[alertType]}</p>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <p>We found something you’ll love:</p>
              <div class="property-card">
                <h3>${propertyTitle}</h3>
                <p><strong>Alert:</strong> ${alertTexts[alertType]}</p>
                ${alertType === "price_drop" ? "<p>💰 Price reduced!</p>" : ""}
                ${
                  alertType === "new_match"
                    ? "<p>🎯 Matches your search!</p>"
                    : ""
                }
                ${
                  alertType === "status_change"
                    ? "<p>📊 Status updated!</p>"
                    : ""
                }
              </div>
              <a href="${
                process.env.FRONTEND_URL
              }/properties/${propertyId}" class="button">View Property</a>
              <p>Don’t miss this opportunity!</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/settings/notifications">Manage Notifications</a> | <a href="${
        process.env.FRONTEND_URL
      }/support">Contact Support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, ${alertTexts[alertType]} for "${propertyTitle}". View it at ${process.env.FRONTEND_URL}/properties/${propertyId}. Manage notifications at ${process.env.FRONTEND_URL}/settings/notifications.`,
    };
  }

  static propertyApproval(
    ownerName: string,
    propertyTitle: string,
    propertyId: string,
    approved: boolean
  ): EmailTemplate {
    const status = approved ? "Approved" : "Rejected";
    const emoji = approved ? "✅" : "❌";

    return {
      subject: `Glubon: Property ${status} - ${propertyTitle}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property ${status}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: ${
              approved
                ? "linear-gradient(135deg, #00b894 0%, #00cec9 100%)"
                : "linear-gradient(135deg, #e17055 0%, #d63031 100%)"
            }; color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .status-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${
              approved ? "#00b894" : "#d63031"
            }; }
            .status-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
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
              <h1>${emoji} Property ${status}</h1>
            </div>
            <div class="content">
              <h2>Hello ${ownerName}!</h2>
              <div class="status-card">
                <h3>${propertyTitle}</h3>
                <p><strong>Status:</strong> ${status}</p>
                ${
                  approved
                    ? "<p>🎉 Your property is live! Renters can now view and contact you.</p>"
                    : "<p>Your property didn’t meet our listing criteria. Review our guidelines and resubmit.</p>"
                }
              </div>
              ${
                approved
                  ? `<a href="${process.env.FRONTEND_URL}/dashboard/properties" class="button">View My Properties</a>`
                  : `<a href="${process.env.FRONTEND_URL}/dashboard/properties/edit/${propertyId}" class="button">Edit & Resubmit</a>`
              }
              <p>Thank you for choosing Glubon!</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a> | <a href="${
        process.env.FRONTEND_URL
      }/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${ownerName}, Your property "${propertyTitle}" has been ${status.toLowerCase()}. ${
        approved
          ? "It’s live on Glubon!"
          : "Review and resubmit at " +
            process.env.FRONTEND_URL +
            "/dashboard/properties/edit/" +
            propertyId
      }. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

  static identityVerification(
    firstName: string,
    verificationType: string,
    approved: boolean
  ): EmailTemplate {
    const status = approved ? "Approved" : "Rejected";
    const emoji = approved ? "✅" : "❌";

    return {
      subject: `Glubon: ${verificationType} Verification ${status}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Identity Verification ${status}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2a44; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { background: ${
              approved
                ? "linear-gradient(135deg, #00b894 0%, #00cec9 100%)"
                : "linear-gradient(135deg, #e17055 0%, #d63031 100%)"
            }; color: #ffffff; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .content { padding: 32px; }
            .content h2 { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
            .content p { font-size: 16px; margin-bottom: 16px; }
            .verification-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${
              approved ? "#00b894" : "#d63031"
            }; }
            .verification-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
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
              <h1>${emoji} Verification ${status}</h1>
            </div>
            <div class="content">
              <h2>Hello ${firstName}!</h2>
              <div class="verification-card">
                <h3>${verificationType} Verification</h3>
                <p><strong>Status:</strong> ${status}</p>
                ${
                  approved
                    ? "<p>🎉 Your identity is verified! Enjoy full access to Glubon.</p>"
                    : "<p>We couldn’t verify your identity. Ensure documents are clear and match your profile.</p>"
                }
              </div>
              <a href="${
                process.env.FRONTEND_URL
              }/dashboard/verification" class="button">${
        approved ? "View Status" : "Resubmit Documents"
      }</a>
              <p>Thank you for keeping Glubon secure!</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 Glubon. All rights reserved.</p>
              <p><a href="${
                process.env.FRONTEND_URL
              }/support">Contact Support</a> | <a href="${
        process.env.FRONTEND_URL
      }/terms">Terms of Service</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hello ${firstName}, Your ${verificationType} verification is ${status.toLowerCase()}. ${
        approved
          ? "Enjoy full access!"
          : "Resubmit documents at " +
            process.env.FRONTEND_URL +
            "/dashboard/verification"
      }. Contact support at ${process.env.FRONTEND_URL}/support.`,
    };
  }

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
}
