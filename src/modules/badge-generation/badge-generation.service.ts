import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { R2Service } from '../../infra/storage/r2.service';
import puppeteer, { Browser } from 'puppeteer';
import { BadgeStatus } from '@prisma/client';

@Injectable()
export class BadgeGenerationService {
  private readonly logger = new Logger(BadgeGenerationService.name);
  private browser: Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
  ) {}

  /**
   * Initialise le browser Puppeteer (singleton pour performance)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.log('Initializing Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      });
    }
    return this.browser;
  }

  /**
   * Ferme le browser (à appeler au shutdown de l'application)
   */
  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Remplace les variables {{variable}} dans le HTML par les vraies valeurs
   */
  private replaceVariables(html: string, data: Record<string, any>): string {
    let result = html;
    
    // Remplace {{variable}} par la valeur correspondante
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, data[key] || '');
    });
    
    // Remplace les variables restantes par une chaîne vide
    result = result.replace(/{{[^}]+}}/g, '');
    
    return result;
  }

  /**
   * Génère un badge pour une inscription
   */
  async generateBadge(
    registrationId: string,
    orgId: string | null,
    userId?: string,
  ): Promise<any> {
    try {
      // 1. Récupérer l'inscription avec ses relations
      const whereClause: any = { 
        id: registrationId,
      };
      
      // Pour SUPER_ADMIN (orgId = null), on ne filtre pas par org_id
      // Pour les autres rôles, on filtre par org_id pour la sécurité
      if (orgId !== null) {
        whereClause.org_id = orgId;
      }

      this.logger.log(`🔍 BADGE DEBUG: Searching registration with:`, {
        registrationId,
        orgId,
        whereClause,
      });

      const registration = await this.prisma.registration.findFirst({
        where: whereClause,
        include: {
          attendee: true,
          event: true,
          eventAttendeeType: {
            include: {
              attendeeType: true,
            },
          },
          badgeTemplate: true,
        },
      });

      if (!registration) {
        throw new NotFoundException('Registration not found');
      }

      // 2. Déterminer le template à utiliser
      let badgeTemplate = registration.badgeTemplate;

      // Si pas de template sur la registration, chercher le template configuré dans l'event
      if (!badgeTemplate) {
        // D'abord, chercher le template configuré dans les settings de l'événement
        const eventSettingsWhere: any = {
          event_id: registration.event_id,
        };
        
        if (orgId) {
          eventSettingsWhere.org_id = orgId;
        }

        const eventSettings = await this.prisma.eventSetting.findFirst({
          where: eventSettingsWhere,
          include: {
            badgeTemplate: true,
          },
        });

        if (eventSettings?.badgeTemplate) {
          badgeTemplate = eventSettings.badgeTemplate;
        } else {
          // Sinon, chercher le template par défaut de l'org
          const templateWhere: any = {
            is_active: true,
            is_default: true,
            OR: [
              { event_id: registration.event_id },
              { event_id: null },
            ],
          };
          
          if (orgId) {
            templateWhere.org_id = orgId;
          }

          badgeTemplate = await this.prisma.badgeTemplate.findFirst({
            where: templateWhere,
            orderBy: [
              { event_id: 'desc' }, // Prioriser les templates spécifiques à l'event
            ],
          });
        }
      }

      if (!badgeTemplate) {
        throw new BadRequestException('No badge template found for this registration');
      }

      // 3. Préparer les données du badge (utilise les snapshots ou les données actuelles de l'attendee)
      const badgeData = {
        first_name: registration.snapshot_first_name || registration.attendee.first_name || '',
        last_name: registration.snapshot_last_name || registration.attendee.last_name || '',
        full_name: `${registration.snapshot_first_name || registration.attendee.first_name || ''} ${registration.snapshot_last_name || registration.attendee.last_name || ''}`.trim(),
        email: registration.snapshot_email || registration.attendee.email || '',
        phone: registration.snapshot_phone || registration.attendee.phone || '',
        company: registration.snapshot_company || registration.attendee.company || '',
        job_title: registration.snapshot_job_title || registration.attendee.job_title || '',
        country: registration.snapshot_country || registration.attendee.country || '',
        attendee_type: registration.eventAttendeeType?.attendeeType?.name || '',
        event_name: registration.event.name || '',
        event_code: registration.event.code || '',
        registration_id: registration.id,
      };

      // 4. Générer le HTML final avec variables remplacées
      const htmlContent = this.replaceVariables(badgeTemplate.html || '', badgeData);
      const cssContent = badgeTemplate.css || '';

      // HTML complet pour Puppeteer
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                width: ${badgeTemplate.width}px; 
                height: ${badgeTemplate.height}px;
                overflow: hidden;
              }
              ${cssContent}
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;

      // 5. Vérifier si un badge existe déjà
      let badge = await this.prisma.badge.findFirst({
        where: {
          registration_id: registrationId,
        },
      });

      // Créer ou mettre à jour le badge en status "generating"
      if (badge) {
        badge = await this.prisma.badge.update({
          where: { id: badge.id },
          data: {
            status: BadgeStatus.generating,
            error_message: null,
          },
        });
      } else {
        badge = await this.prisma.badge.create({
          data: {
            org_id: orgId,
            registration_id: registrationId,
            badge_template_id: badgeTemplate.id,
            event_id: registration.event_id,
            status: BadgeStatus.generating,
            generated_by: userId,
            badge_data: badgeData,
          },
        });
      }

      // 6. Générer le PDF avec Puppeteer
      this.logger.log(`Generating PDF for badge ${badge.id}...`);
      
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      await page.setViewport({
        width: badgeTemplate.width,
        height: badgeTemplate.height,
        deviceScaleFactor: 2, // Pour une meilleure qualité
      });

      await page.setContent(fullHtml, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        width: `${badgeTemplate.width}px`,
        height: `${badgeTemplate.height}px`,
        printBackground: true,
        preferCSSPageSize: true,
      });

      await page.close();

      this.logger.log(`PDF generated: ${pdfBuffer.length} bytes`);

      // 7. Upload du PDF sur Cloudflare R2
      const pdfUrl = await this.r2Service.uploadBadgePdf(registrationId, Buffer.from(pdfBuffer));

      // 8. Incrémenter le compteur d'utilisation du template
      await this.prisma.badgeTemplate.update({
        where: { id: badgeTemplate.id },
        data: {
          usage_count: {
            increment: 1,
          },
        },
      });

      // 9. Mettre à jour le badge avec les infos de génération
      const updatedBadge = await this.prisma.badge.update({
        where: { id: badge.id },
        data: {
          pdf_url: pdfUrl,
          html_snapshot: htmlContent,
          css_snapshot: cssContent,
          data_snapshot: badgeData,
          status: BadgeStatus.completed,
          generated_at: new Date(),
          generated_by: userId,
        },
        include: {
          registration: {
            include: {
              attendee: true,
            },
          },
          badgeTemplate: true,
        },
      });

      this.logger.log(`Badge ${badge.id} generated successfully`);

      return updatedBadge;
    } catch (error) {
      this.logger.error(`Error generating badge for registration ${registrationId}:`, error);

      // Marquer le badge comme failed si il existe
      const existingBadge = await this.prisma.badge.findFirst({
        where: { registration_id: registrationId },
      });

      if (existingBadge) {
        await this.prisma.badge.update({
          where: { id: existingBadge.id },
          data: {
            status: BadgeStatus.failed,
            error_message: error.message,
          },
        });
      }

      throw new InternalServerErrorException(`Failed to generate badge: ${error.message}`);
    }
  }

  /**
   * Génère des badges en masse pour un événement
   */
  async generateBulk(
    eventId: string,
    orgId: string | null,
    userId?: string,
    filters?: {
      attendeeTypeId?: string;
      status?: string;
    },
  ): Promise<{ 
    total: number; 
    generated: number; 
    failed: number;
    results: any[];
  }> {
    // Récupérer toutes les inscriptions de l'événement
    const whereClause: any = {
      event_id: eventId,
    };
    
    // Pour SUPER_ADMIN (orgId = null), on ne filtre pas par org_id
    // Pour les autres rôles, on filtre par org_id pour la sécurité
    if (orgId !== null) {
      whereClause.org_id = orgId;
    }
    
    if (filters?.attendeeTypeId) {
      whereClause.attendee_type_id = filters.attendeeTypeId;
    }
    
    if (filters?.status) {
      whereClause.status = filters.status as any;
    }

    const registrations = await this.prisma.registration.findMany({
      where: whereClause,
      select: {
        id: true,
      },
    });

    const total = registrations.length;
    let generated = 0;
    let failed = 0;
    const results = [];

    this.logger.log(`Starting bulk badge generation for ${total} registrations...`);

    // Générer les badges un par un (on peut paralléliser si besoin)
    for (const registration of registrations) {
      try {
        const badge = await this.generateBadge(registration.id, orgId, userId);
        generated++;
        results.push({
          registrationId: registration.id,
          badgeId: badge.id,
          status: 'success',
        });
      } catch (error) {
        failed++;
        results.push({
          registrationId: registration.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    this.logger.log(`Bulk generation completed: ${generated} generated, ${failed} failed`);

    return {
      total,
      generated,
      failed,
      results,
    };
  }

  /**
   * Régénère un badge existant
   */
  async regenerateBadge(
    badgeId: string,
    orgId: string,
    userId?: string,
  ): Promise<any> {
    const badge = await this.prisma.badge.findFirst({
      where: {
        id: badgeId,
        org_id: orgId,
      },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    return this.generateBadge(badge.registration_id, orgId, userId);
  }

  /**
   * Récupère les infos d'un badge
   */
  async getBadge(badgeId: string, orgId: string): Promise<any> {
    const badge = await this.prisma.badge.findFirst({
      where: {
        id: badgeId,
        org_id: orgId,
      },
      include: {
        registration: {
          include: {
            attendee: true,
          },
        },
        badgeTemplate: true,
        generatedByUser: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    return badge;
  }

  /**
   * Récupère le badge d'une inscription
   */
  async getBadgeByRegistration(registrationId: string, orgId: string): Promise<any> {
    const badge = await this.prisma.badge.findFirst({
      where: {
        registration_id: registrationId,
        org_id: orgId,
      },
      include: {
        registration: {
          include: {
            attendee: true,
          },
        },
        badgeTemplate: true,
        generatedByUser: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    return badge; // Peut être null si pas encore généré
  }

  /**
   * Génère un badge de test avec un template et des données fictives
   */
  async generateTestBadge(
    templateId: string,
    testData: Record<string, any>,
    orgId: string,
    userId?: string,
  ): Promise<{ pdf_url: string; test_data: Record<string, any> }> {
    // 1. Récupérer le template
    const badgeTemplate = await this.prisma.badgeTemplate.findFirst({
      where: {
        id: templateId,
        org_id: orgId,
        is_active: true,
      },
    });

    if (!badgeTemplate) {
      throw new NotFoundException('Badge template not found');
    }

    // 2. Générer le HTML final avec variables remplacées
    const htmlContent = this.replaceVariables(badgeTemplate.html || '', testData);
    const cssContent = badgeTemplate.css || '';

    // HTML complet pour Puppeteer
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              width: ${badgeTemplate.width}px; 
              height: ${badgeTemplate.height}px;
              overflow: hidden;
            }
            ${cssContent}
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // 3. Générer le PDF avec Puppeteer
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    await page.setViewport({
      width: badgeTemplate.width,
      height: badgeTemplate.height,
      deviceScaleFactor: 2,
    });

    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      width: `${badgeTemplate.width}px`,
      height: `${badgeTemplate.height}px`,
      printBackground: true,
      preferCSSPageSize: true,
    });

    await page.close();

    // 4. Upload du PDF sur Cloudflare R2 avec nom de test
    const testKey = `test-${templateId}-${Date.now()}`;
    const pdfUrl = await this.r2Service.uploadBadgePdf(testKey, Buffer.from(pdfBuffer));

    this.logger.log(`Test badge generated for template ${templateId}: ${pdfUrl}`);

    return {
      pdf_url: pdfUrl,
      test_data: testData,
    };
  }

  /**
   * Supprime un badge
   */
  async deleteBadge(badgeId: string, orgId: string): Promise<void> {
    const badge = await this.prisma.badge.findFirst({
      where: {
        id: badgeId,
        org_id: orgId,
      },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    // Supprimer le PDF de R2 si il existe
    if (badge.pdf_url) {
      try {
        // Extraire la clé du fichier depuis l'URL
        const key = badge.pdf_url.split('/').pop();
        if (key) {
          await this.r2Service.deleteFile(`badges/${key}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete badge PDF from R2: ${error.message}`);
      }
    }

    // Supprimer le badge de la DB
    await this.prisma.badge.delete({
      where: { id: badgeId },
    });
  }
}
