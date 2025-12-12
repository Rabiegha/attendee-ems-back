import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InvitationEmailTemplate } from './templates/invitation.template';
import { PasswordResetEmailTemplate } from './templates/password-reset.template';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailEnabled: boolean;

  constructor() {
    // Configuration SMTP depuis les variables d'environnement
    this.emailEnabled = process.env.EMAIL_ENABLED === 'true';
    
    this.logger.log('📧 Initializing Email Service');
    this.logger.debug({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      enabled: this.emailEnabled,
    });

    if (this.emailEnabled) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      this.logger.warn('⚠️ Email service is DISABLED (EMAIL_ENABLED=false)');
    }
  }

  /**
   * Envoie un email générique
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.warn(`📧 [DISABLED] Would send email to ${options.to}: ${options.subject}`);
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Envoie un email d'invitation
   */
  async sendInvitationEmail(params: {
    email: string;
    invitationUrl: string;
    organizationName: string;
    roleName: string;
  }): Promise<boolean> {
    const html = InvitationEmailTemplate(params);
    
    return this.sendEmail({
      to: params.email,
      subject: `Invitation à rejoindre ${params.organizationName}`,
      html,
    });
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(params: {
    email: string;
    resetUrl: string;
    userName?: string;
  }): Promise<boolean> {
    const html = PasswordResetEmailTemplate(params);
    
    return this.sendEmail({
      to: params.email,
      subject: 'Réinitialisation de votre mot de passe',
      html,
    });
  }

  /**
   * Vérifie la configuration SMTP
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.warn('Email service is disabled');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('❌ SMTP connection failed:', error);
      return false;
    }
  }
}
