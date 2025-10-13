import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Injectable()
export class InvitationService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    // Configuration SMTP depuis les variables d'environnement
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Envoie une invitation à un utilisateur
   */
  async sendInvitation(email: string, roleId: string, orgId: string) {
    // Vérifier que l'organisation existe
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!organization) {
      throw new NotFoundException('Organisation non trouvée');
    }

    // Vérifier que le rôle existe
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: { email, org_id: orgId },
    });
    if (existingUser && existingUser.is_active) {
      throw new BadRequestException('Un utilisateur actif avec cet email existe déjà');
    }

    // Générer un token unique d'invitation
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Expire dans 48h

    // Créer ou mettre à jour l'utilisateur incomplet
    const user = await this.prisma.user.upsert({
      where: { email_org_id: { email, org_id: orgId } },
      update: {
        invitation_token: invitationToken,
        invitation_token_expires_at: expiresAt,
        role_id: roleId,
        is_active: false,
      },
      create: {
        email,
        org_id: orgId,
        role_id: roleId,
        password_hash: '', // Vide, sera défini lors de la complétion
        invitation_token: invitationToken,
        invitation_token_expires_at: expiresAt,
        is_active: false,
      },
    });

    // Construire l'URL d'invitation
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationUrl = `${baseUrl}/complete-invitation/${invitationToken}`;

    // Envoyer l'email d'invitation
    const emailSent = await this.sendInvitationEmail(
      email,
      invitationUrl,
      organization.name,
      role.name
    );

    return {
      id: user.id,
      email: user.email,
      invitationToken,
      expiresAt,
      emailSent,
      organization: organization.name,
      role: role.name,
    };
  }

  /**
   * Complète l'inscription d'un utilisateur invité
   */
  async completeInvitation(token: string, userData: {
    firstName: string;
    lastName: string;
    password: string;
  }) {
    // Trouver l'utilisateur avec ce token
    const user = await this.prisma.user.findUnique({
      where: { invitation_token: token },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Token d\'invitation invalide');
    }

    // Vérifier l'expiration
    if (user.invitation_token_expires_at && user.invitation_token_expires_at < new Date()) {
      throw new BadRequestException('Le token d\'invitation a expiré');
    }

    // Hasher le mot de passe
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Finaliser le compte utilisateur
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        password_hash: hashedPassword,
        invitation_token: null,
        invitation_token_expires_at: null,
        is_active: true,
        must_change_password: false,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    return {
      user: updatedUser,
      message: 'Compte activé avec succès',
    };
  }

  /**
   * Envoie l'email d'invitation
   */
  private async sendInvitationEmail(
    email: string,
    invitationUrl: string,
    organizationName: string,
    roleName: string
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
        to: email,
        subject: `Invitation à rejoindre ${organizationName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Vous êtes invité à rejoindre ${organizationName}</h2>
            
            <p>Bonjour,</p>
            
            <p>Vous avez été invité à rejoindre <strong>${organizationName}</strong> en tant que <strong>${roleName}</strong>.</p>
            
            <p>Pour compléter votre inscription et créer votre mot de passe, cliquez sur le lien ci-dessous :</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Compléter mon inscription
              </a>
            </div>
            
            <p><strong>Ce lien expirera dans 48 heures.</strong></p>
            
            <p>Si vous n'avez pas demandé cette invitation, vous pouvez ignorer cet email.</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              EMS - Event Management System<br>
              Cet email a été envoyé automatiquement, merci de ne pas y répondre.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      return false;
    }
  }
}