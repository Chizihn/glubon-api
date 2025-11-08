interface BaseTemplateOptions {
  title: string;
  subtitle?: string;
  content: string;
  cta?: {
    text: string;
    url: string;
  } | undefined;
  footerLinks?: Array<{ text: string; url: string }>;
}

export function generateBaseTemplate({
  title,
  subtitle,
  content,
  cta,
  footerLinks = [
    { text: 'Help Center', url: `${process.env.FRONTEND_URL}/help` },
    { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` },
    { text: 'Privacy Policy', url: `${process.env.FRONTEND_URL}/privacy` },
    { text: 'Terms of Service', url: `${process.env.FRONTEND_URL}/terms` },
  ],
}: BaseTemplateOptions): { html: string; text: string } {
  const currentYear = new Date().getFullYear();
  const logoUrl = 'https://glubon.com/logo.png'; // Replace with your actual logo URL
  const appUrl = process.env.FRONTEND_URL || 'https://glubon.com';

  const html = `
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="x-apple-disable-message-reformatting">
      <title>${title} | Glubon</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        /* Base Styles */
        body, html {
          margin: 0 !important;
          padding: 0 !important;
          -ms-text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1F2937;
          background-color: #F3F4F6;
        }
        
        /* Container */
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        /* Header */
        .email-header {
          background: linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%);
          padding: 32px 24px;
          text-align: center;
        }
        
        .logo {
          max-width: 180px;
          height: auto;
          margin-bottom: 16px;
        }
        
        .email-header h1 {
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px 0;
          line-height: 1.3;
        }
        
        .email-header p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 15px;
          margin: 0;
          line-height: 1.5;
        }
        
        /* Content */
        .email-body {
          padding: 32px 24px;
        }
        
        .email-body h2 {
          color: #111827;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 20px 0;
        }
        
        .email-body p {
          color: #4B5563;
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 20px 0;
        }
        
        /* Button */
        .button-container {
          margin: 32px 0;
          text-align: center;
        }
        
        .button {
          display: inline-block;
          background: #1D4ED8;
          color: #FFFFFF !important;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 6px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .button:hover {
          background: #1E40AF;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        /* Footer */
        .email-footer {
          background: #F9FAFB;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #E5E7EB;
        }
        
        .footer-links {
          margin: 0 0 16px 0;
          padding: 0;
          list-style: none;
        }
        
        .footer-links li {
          display: inline-block;
          margin: 0 8px;
        }
        
        .footer-links a {
          color: #6B7280;
          font-size: 13px;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .footer-links a:hover {
          color: #1D4ED8;
          text-decoration: underline;
        }
        
        .copyright {
          color: #9CA3AF;
          font-size: 13px;
          margin: 16px 0 0 0;
        }
        
        .social-links {
          margin: 24px 0 16px 0;
        }
        
        .social-links a {
          display: inline-block;
          margin: 0 8px;
          color: #6B7280;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .social-links a:hover {
          color: #1D4ED8;
        }
        
        /* Responsive */
        @media screen and (max-width: 600px) {
          .email-container {
            margin: 0 10px;
            border-radius: 6px;
          }
          
          .email-header, .email-body {
            padding: 24px 16px;
          }
          
          .email-header h1 {
            font-size: 22px;
          }
          
          .button {
            display: block;
            width: 100%;
            text-align: center;
          }
          
          .footer-links li {
            display: block;
            margin: 8px 0;
          }
        }
        
        /* Utility Classes */
        .text-muted {
          color: #6B7280 !important;
        }
        
        .text-center {
          text-align: center !important;
        }
        
        .mb-0 {
          margin-bottom: 0 !important;
        }
        
        .mt-0 {
          margin-top: 0 !important;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <!--[if mso]>
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600" align="center">
            <tr>
            <td>
            <![endif]-->
            
            <div class="email-container">
              <!-- Header -->
              <div class="email-header">
                <a href="${appUrl}" style="display: inline-block;">
                  <img src="${logoUrl}" alt="Glubon" class="logo" style="max-width: 180px; height: auto;">
                </a>
                <h1>${title}</h1>
                ${subtitle ? `<p style="color: rgba(255, 255, 255, 0.9); font-size: 15px; margin: 8px 0 0 0; line-height: 1.5;">${subtitle}</p>` : ''}
              </div>
              
              <!-- Body -->
              <div class="email-body">
                ${content}
                
                ${cta ? `
                  <div class="button-container">
                    <a href="${cta.url}" class="button" style="color: #FFFFFF; text-decoration: none;">
                      ${cta.text}
                    </a>
                  </div>
                ` : ''}
              </div>
              
              <!-- Footer -->
              <div class="email-footer">
                <div class="social-links">
                  <a href="https://facebook.com/glubon" style="color: #6B7280; text-decoration: none; margin: 0 8px;">Facebook</a>
                  <a href="https://twitter.com/glubon" style="color: #6B7280; text-decoration: none; margin: 0 8px;">Twitter</a>
                  <a href="https://instagram.com/glubon" style="color: #6B7280; text-decoration: none; margin: 0 8px;">Instagram</a>
                  <a href="https://linkedin.com/company/glubon" style="color: #6B7280; text-decoration: none; margin: 0 8px;">LinkedIn</a>
                </div>
                
                <ul class="footer-links" style="list-style: none; padding: 0; margin: 0 0 16px 0;">
                  ${footerLinks.map(link => `
                    <li style="display: inline-block; margin: 0 8px;">
                      <a href="${link.url}" style="color: #6B7280; font-size: 13px; text-decoration: none;">
                        ${link.text}
                      </a>
                    </li>
                  `).join('')}
                </ul>
                
                <p class="copyright" style="color: #9CA3AF; font-size: 13px; margin: 16px 0 0 0;">
                  &copy; ${currentYear} Glubon. All rights reserved.
                </p>
              </div>
            </div>
            
            <!--[if mso]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Generate plain text version
  let text = `${title}\n${'='.repeat(title.length)}\n\n`;
  if (subtitle) text += `${subtitle}\n\n`;
  text += `${content.replace(/<[^>]*>?/gm, '')}\n\n`;
  if (cta) text += `${cta.text}: ${cta.url}\n\n`;
  text += `---\n`;
  text += footerLinks.map(link => `${link.text}: ${link.url}`).join(' | ');
  text += `\n\n`;
  text += `Follow us:\n`;
  text += `Facebook: https://facebook.com/glubon\n`;
  text += `Twitter: https://twitter.com/glubon\n`;
  text += `Instagram: https://instagram.com/glubon\n`;
  text += `LinkedIn: https://linkedin.com/company/glubon\n\n`;
  text += `© ${currentYear} Glubon. All rights reserved.`;

  return { html, text };
}
