import { EmailTemplate } from "./email";

export const resetPasswordTemplate = (data: {
  name: string;
  resetLink: string;
  expiryHours: number;
}): EmailTemplate => {
  const { name, resetLink, expiryHours } = data;
  
  return {
    subject: `Password Reset Request`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .button {
                  display: inline-block; 
                  padding: 10px 20px; 
                  background-color: #4CAF50; 
                  color: white; 
                  text-decoration: none; 
                  border-radius: 4px;
                  margin: 20px 0;
              }
              .footer { 
                  margin-top: 30px; 
                  font-size: 12px; 
                  color: #666; 
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h2>Hello ${name},</h2>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              
              <p>
                  <a href="${resetLink}" class="button">Reset Password</a>
              </p>
              
              <p>Or copy and paste this link into your browser:</p>
              <p>${resetLink}</p>
              
              <p>This link will expire in ${expiryHours} hours.</p>
              
              <p>If you didn't request this, you can safely ignore this email.</p>
              
              <div class="footer">
                  <p>Best regards,<br>The Glubon Team</p>
                  <p>If you're having trouble with the button above, copy and paste the URL below into your web browser.</p>
                  <p>${resetLink}</p>
              </div>
          </div>
      </body>
      </html>
    `,
    text: `
      Hello ${name},
      
      We received a request to reset your password. Use the link below to set a new password:
      
      ${resetLink}
      
      This link will expire in ${expiryHours} hours.
      
      If you didn't request this, you can safely ignore this email.
      
      Best regards,
      The Glubon Team
    `
  };
};
