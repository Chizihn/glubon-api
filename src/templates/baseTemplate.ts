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
        /* Reset */
        body, html {
          margin: 0;
          padding: 0;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #F3F4F6;
          color: #374151;
        }

        /* Layout */
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #F3F4F6;
          padding-bottom: 40px;
        }

        .main {
          background-color: #ffffff;
          margin: 0 auto;
          width: 100%;
          max-width: 600px;
          border-spacing: 0;
          font-family: 'Inter', sans-serif;
          color: #374151;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }

        /* Header */
        .header {
          padding: 32px 0;
          text-align: center;
        }

        .logo {
          width: 48px;
          height: 48px;
          border-radius: 8px;
        }

        /* Content */
        .content {
          padding: 0 40px 40px 40px;
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px 0;
          text-align: center;
          letter-spacing: -0.025em;
        }

        .subtitle {
          font-size: 16px;
          color: #6B7280;
          margin: 0 0 32px 0;
          text-align: center;
          line-height: 1.5;
        }

        .text {
          font-size: 16px;
          line-height: 1.625;
          color: #374151;
          margin: 0 0 24px 0;
        }

        /* Button */
        .btn-container {
          text-align: center;
          margin: 32px 0;
        }

        .btn {
          display: inline-block;
          background-color: #2563EB;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          padding: 12px 32px;
          border-radius: 8px;
          transition: background-color 0.2s;
        }

        .btn:hover {
          background-color: #1D4ED8;
        }

        /* Footer */
        .footer {
          padding: 32px 0;
          text-align: center;
          background-color: #F3F4F6;
        }

        .footer-text {
          font-size: 12px;
          color: #9CA3AF;
          margin-bottom: 12px;
        }

        .footer-links {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .footer-link {
          display: inline-block;
          color: #6B7280;
          font-size: 12px;
          text-decoration: none;
          margin: 0 8px;
        }

        .footer-link:hover {
          color: #374151;
          text-decoration: underline;
        }

        /* Utilities */
        .divider {
          height: 1px;
          background-color: #E5E7EB;
          margin: 32px 0;
          border: none;
        }

        /* Responsive */
        @media screen and (max-width: 600px) {
          .main {
            width: 100% !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .content {
            padding: 0 24px 32px 24px !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <table class="main" align="center">
          <!-- Header -->
          <tr>
            <td class="header">
              <a href="${appUrl}">
                <img src="${logoUrl}" alt="Glubon" class="logo">
              </a>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              <h1 class="title">${title}</h1>
              ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
              
              <div class="text">
                ${content}
              </div>

              ${cta ? `
                <div class="btn-container">
                  <a href="${cta.url}" class="btn">${cta.text}</a>
                </div>
              ` : ''}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">&copy; ${currentYear} Glubon. All rights reserved.</p>
          <div class="footer-links">
            ${footerLinks.map(link => `
              <a href="${link.url}" class="footer-link">${link.text}</a>
            `).join('')}
          </div>
          <div style="margin-top: 16px;">
            <a href="https://twitter.com/glubon" class="footer-link">Twitter</a>
            <a href="https://instagram.com/glubon" class="footer-link">Instagram</a>
            <a href="https://linkedin.com/company/glubon" class="footer-link">LinkedIn</a>
          </div>
        </div>
      </div>
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
  text += `© ${currentYear} Glubon. All rights reserved.`;

  return { html, text };
}
