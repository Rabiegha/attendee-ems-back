/**
 * Template d'email pour l'invitation d'un utilisateur
 */
export const InvitationEmailTemplate = (params: {
  invitationUrl: string;
  organizationName: string;
  roleName: string;
}): string => {
  const { invitationUrl, organizationName, roleName } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation - ${organizationName}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Invitation à rejoindre</h1>
          <h2 style="color: #ffffff; margin: 10px 0 0 0; font-size: 28px; font-weight: bold;">${organizationName}</h2>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Bonjour,
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Vous avez été invité à rejoindre <strong>${organizationName}</strong> en tant que <strong>${roleName}</strong>.
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
            Pour compléter votre inscription et créer votre mot de passe, cliquez sur le bouton ci-dessous :
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 40px 0;">
            <a href="${invitationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 16px 32px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      display: inline-block;
                      font-weight: bold;
                      font-size: 16px;
                      box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              Compléter mon inscription
            </a>
          </div>
          
          <!-- Link fallback -->
          <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 30px 0 20px 0; text-align: center;">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
          </p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              ⚠️ <strong>Ce lien expirera dans 48 heures.</strong>
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email en toute sécurité.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 12px; line-height: 1.6; margin: 0; text-align: center;">
            <strong>EMS - Event Management System</strong><br>
            Cet email a été envoyé automatiquement, merci de ne pas y répondre.
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
};
