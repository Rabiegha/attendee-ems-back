/**
 * Template d'email pour la réinitialisation de mot de passe
 */
export const PasswordResetEmailTemplate = (params: {
  resetUrl: string;
  userName?: string;
}): string => {
  const { resetUrl, userName } = params;
  const greeting = userName ? `Bonjour ${userName}` : 'Bonjour';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réinitialisation de mot de passe</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background-color: #2563eb; padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Réinitialisation de mot de passe</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            ${greeting},
          </p>
          
          <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
            Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2563eb; 
                      color: #ffffff; 
                      padding: 14px 28px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      display: inline-block;
                      font-weight: 600;
                      font-size: 15px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          
          <!-- Info box -->
          <div style="background-color: #f3f4f6; border-left: 3px solid #2563eb; padding: 16px; margin: 30px 0; border-radius: 4px;">
            <p style="color: #374151; margin: 0; font-size: 14px;">
              <strong>Ce lien est valide pendant 1 heure.</strong>
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
            Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
            <strong style="color: #6b7280;">EMS - Event Management System</strong><br>
            Cet email a été envoyé automatiquement, merci de ne pas y répondre.
          </p>
        </div>
        
      </div>
      
      <!-- Link fallback (outside main container) -->
      <div style="max-width: 600px; margin: 20px auto; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0;">
          Problème avec le bouton ? <a href="${resetUrl}" style="color: #2563eb; text-decoration: none;">Cliquez ici</a>
        </p>
      </div>
    </body>
    </html>
  `;
};
