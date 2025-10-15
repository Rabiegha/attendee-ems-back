import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { InvitationStatus, GetInvitationsQueryDto, InvitationResponseDto, GetInvitationsResponseDto } from './dto/invitation.dto';
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
  async sendInvitation(email: string, roleId: string, orgId: string, invitedByUserId: string, organizationName?: string) {
    // Récupérer l'utilisateur qui envoie l'invitation pour vérifier ses permissions
    const invitingUser = await this.prisma.user.findUnique({
      where: { id: invitedByUserId },
      include: { role: true }
    });
    
    if (!invitingUser) {
      throw new NotFoundException('Utilisateur invitant non trouvé');
    }

    const isSuperAdmin = invitingUser.role.code === 'SUPER_ADMIN';

    // Vérifier que l'organisation existe
    let organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    
    // Si l'organisation n'existe pas
    if (!organization) {
      // Si c'est un super admin et qu'un nom d'organisation est fourni, créer l'organisation
      if (isSuperAdmin && organizationName) {
        // Générer un slug à partir du nom
        const slug = organizationName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
          .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces et tirets
          .trim()
          .replace(/\s+/g, '-') // Remplacer les espaces par des tirets
          .replace(/-+/g, '-'); // Éviter les tirets multiples
        
        organization = await this.prisma.organization.create({
          data: {
            id: orgId, // Utiliser l'ID fourni
            name: organizationName,
            slug: slug,
          }
        });
      } else {
        throw new NotFoundException('Organisation non trouvée');
      }
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
    if (existingUser) {
      throw new BadRequestException('Un utilisateur avec cet email existe déjà dans cette organisation');
    }

    // Vérifier s'il existe déjà une invitation en cours pour cet email dans cette organisation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: { 
        email, 
        org_id: orgId,
        status: InvitationStatus.PENDING
      },
    });

    let isReplacement = false;
    if (existingInvitation) {
      isReplacement = true;
      // Annuler l'invitation existante
      await this.prisma.invitation.update({
        where: { id: existingInvitation.id },
        data: { status: InvitationStatus.CANCELLED }
      });
    }

    // Annuler toutes les autres anciennes invitations pour cet email dans cette organisation
    // (peu importe leur statut - cela évite les conflits de contrainte unique)
    await this.prisma.invitation.updateMany({
      where: { 
        email, 
        org_id: orgId,
        status: { not: InvitationStatus.CANCELLED }
      },
      data: { status: InvitationStatus.CANCELLED }
    });

    // Générer un token unique d'invitation
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Expire dans 48h

    // Créer la nouvelle invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        token: invitationToken,
        expires_at: expiresAt,
        organization: { connect: { id: orgId } },
        role: { connect: { id: roleId } },
        invited_by: { connect: { id: invitedByUserId } },
        status: InvitationStatus.PENDING,
      }
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
      id: invitation.id,
      email: invitation.email,
      invitationToken,
      expiresAt,
      emailSent,
      organization: organization.name,
      role: role.name,
      isReplacement,
    };
  }

  /**
   * Valide un token d'invitation (sans le consommer)
   */
  async validateInvitationToken(token: string) {
    // Trouver l'invitation avec ce token
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!invitation) {
      throw new BadRequestException('Token d\'invitation invalide');
    }

    // Vérifier l'expiration
    if (invitation.expires_at < new Date()) {
      // Marquer l'invitation comme expirée
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      throw new BadRequestException('Le token d\'invitation a expiré');
    }

    // Vérifier si l'invitation a déjà été utilisée
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Ce lien d\'invitation a déjà été utilisé');
    }

    // Vérifier si l'invitation a été annulée
    if (invitation.status === InvitationStatus.CANCELLED) {
      throw new BadRequestException('Cette invitation a été annulée');
    }

    return {
      valid: true,
      email: invitation.email,
      organization: invitation.organization?.name,
      role: invitation.role?.name,
      expiresAt: invitation.expires_at,
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
    // Trouver l'invitation avec ce token
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!invitation) {
      throw new BadRequestException('Token d\'invitation invalide');
    }

    // Vérifier l'expiration
    if (invitation.expires_at < new Date()) {
      // Marquer l'invitation comme expirée
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      throw new BadRequestException('Le token d\'invitation a expiré');
    }

    // Vérifier si l'invitation a déjà été utilisée
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Ce lien d\'invitation a déjà été utilisé');
    }

    // Vérifier si l'invitation a été annulée
    if (invitation.status === InvitationStatus.CANCELLED) {
      throw new BadRequestException('Cette invitation a été annulée');
    }

    // Hasher le mot de passe
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Créer le compte utilisateur
    const newUser = await this.prisma.user.create({
      data: {
        email: invitation.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        password_hash: hashedPassword,
        org_id: invitation.org_id,
        role_id: invitation.role_id,
        is_active: true,
      },
      include: {
        organization: true,
        role: true,
      },
    });

    // Marquer l'invitation comme acceptée
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED }
    });

    return {
      user: newUser,
      message: 'Compte créé avec succès',
    };
  }

  /**
   * Récupère la liste des invitations avec pagination et filtres
   */
  async getInvitations(query: GetInvitationsQueryDto, orgId: string): Promise<GetInvitationsResponseDto> {
    const { status, limit = 20, offset = 0 } = query;

    const where: any = { org_id: orgId };
    if (status) {
      where.status = status;
    }

    const [invitations, total, pending] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        include: {
          organization: true,
          role: true,
          invited_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.invitation.count({ where }),
      this.prisma.invitation.count({ 
        where: { ...where, status: InvitationStatus.PENDING } 
      }),
    ]);

    return {
      invitations: invitations.map(invitation => ({
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        orgId: invitation.org_id,
        organizationName: invitation.organization.name,
        roleId: invitation.role_id,
        roleName: invitation.role.name,
        invitedByUserId: invitation.invited_by_user_id,
        invitedByUserName: `${invitation.invited_by.first_name || ''} ${invitation.invited_by.last_name || ''}`.trim() || invitation.invited_by.email,
        status: invitation.status as InvitationStatus,
        createdAt: invitation.created_at,
        updatedAt: invitation.updated_at,
      })),
      total,
      pending,
    };
  }

  /**
   * Annule une invitation
   */
  async cancelInvitation(invitationId: string, orgId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, org_id: orgId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation non trouvée');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Cette invitation a déjà été acceptée');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED },
    });
  }

  /**
   * Renvoie une invitation (crée une nouvelle invitation avec un nouveau token)
   */
  async resendInvitation(invitationId: string, orgId: string, invitedByUserId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, org_id: orgId },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation non trouvée');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Cette invitation a déjà été acceptée');
    }

    // Annuler l'ancienne invitation
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED },
    });

    // Créer une nouvelle invitation
    return this.sendInvitation(invitation.email, invitation.role_id, orgId, invitedByUserId);
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
      return false;
    }
  }
}