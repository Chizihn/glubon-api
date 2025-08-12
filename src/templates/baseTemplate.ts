interface BaseTemplateOptions {
  title: string;
  subtitle?: string;
  content: string;
  cta?: {
    text: string;
    url: string;
  };
  footerLinks?: Array<{ text: string; url: string }>;
}

export function generateBaseTemplate({
  title,
  subtitle,
  content,
  cta,
  footerLinks = [
    { text: 'Contact Support', url: `${process.env.FRONTEND_URL}/support` },
    { text: 'Terms of Service', url: `${process.env.FRONTEND_URL}/terms` },
  ],
}: BaseTemplateOptions): { html: string; text: string } {
  const html = `
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
        .header p { font-size: 16px; opacity: 0.9; }
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
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <div class="content">
          ${content}
          ${cta ? `<a href="${cta.url}" class="button">${cta.text}</a>` : ''}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Glubon. All rights reserved.</p>
          <p>${footerLinks
            .map(link => `<a href="${link.url}">${link.text}</a>`)
            .join(' | ')}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Generate plain text version (simplified)
  let text = `${title}\n\n`;
  if (subtitle) text += `${subtitle}\n\n`;
  text += `${content.replace(/<[^>]*>?/gm, '')}\n\n`;
  if (cta) text += `${cta.text}: ${cta.url}\n\n`;
  text += `---\n`;
  text += footerLinks.map(link => `${link.text}: ${link.url}`).join(' | ');
  text += `\n\n© ${new Date().getFullYear()} Glubon. All rights reserved.`;

  return { html, text };
}
