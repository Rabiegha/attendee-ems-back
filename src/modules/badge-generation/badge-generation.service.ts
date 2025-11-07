import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { R2Service } from '../../infra/storage/r2.service';
import { BadgeTemplatesService } from '../badge-templates/badge-templates.service';
import puppeteer, { Browser } from 'puppeteer';
import { BadgeStatus } from '@prisma/client';
import * as QRCode from 'qrcode';

@Injectable()
export class BadgeGenerationService {
  private readonly logger = new Logger(BadgeGenerationService.name);
  private browser: Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private r2Service: R2Service,
    private badgeTemplatesService: BadgeTemplatesService,
  ) {}

  /**
   * Initialise le browser Puppeteer (singleton pour performance)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.log('Initializing Puppeteer browser...');
      
      // Configuration flexible pour différents environnements
      const browserOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      };

      // Vérifier si PUPPETEER_EXECUTABLE_PATH est défini (Docker/Production)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        this.logger.log(`Using Chromium from env: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        browserOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        try {
          this.browser = await puppeteer.launch(browserOptions);
          this.logger.log('✅ Browser launched successfully with env path');
          return this.browser;
        } catch (error) {
          this.logger.error('❌ Failed to launch with env path:', error.message);
          // Continue vers auto-détection
        }
      }

      // Essayer de détecter le chemin du navigateur automatiquement
      try {
        // Laisser Puppeteer détecter automatiquement le navigateur
        this.logger.log('Attempting to launch browser with auto-detection...');
        this.browser = await puppeteer.launch(browserOptions);
        this.logger.log('✅ Browser launched successfully with auto-detection');
      } catch (autoError) {
        this.logger.warn('Auto-detection failed, trying with explicit paths...', autoError.message);
        
        // Essayer différents chemins communs (Windows en dev, Linux en prod)
        const possiblePaths = [
          // Windows (développement local)
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          // Linux (production Docker/Ubuntu)
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/opt/google/chrome/chrome',
          // macOS
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ];

        for (const path of possiblePaths) {
          try {
            this.logger.log(`Trying browser path: ${path}`);
            this.browser = await puppeteer.launch({
              ...browserOptions,
              executablePath: path,
            });
            this.logger.log(`✅ Browser launched successfully with path: ${path}`);
            break;
          } catch (pathError) {
            this.logger.warn(`Failed with path ${path}:`, pathError.message);
            continue;
          }
        }

        if (!this.browser) {
          throw new Error('Could not find a suitable browser executable. Please install Chromium or Chrome.');
        }
      }
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
   * Génère un QR Code en base64 à partir de données
   */
  private async generateQRCode(data: string): Promise<string> {
    try {
      // Générer le QR Code en Data URL (base64)
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 500, // Taille suffisante pour une bonne qualité
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error(`Error generating QR Code: ${error.message}`);
      // Retourner un QR Code vide en cas d'erreur
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    }
  }

  /**
   * Génère le HTML et CSS depuis template_data si html/css sont vides
   */
  private generateHTMLFromTemplateData(badgeTemplate: any): { html: string; css: string } {
    try {
      const templateData = badgeTemplate.template_data as any;
      
      if (!templateData || !templateData.elements) {
        this.logger.warn('No elements found in template_data');
        return { html: '', css: '' };
      }

      const elements = templateData.elements;
      const background = templateData.background;
      const format = templateData.format || { width: 400, height: 600 };
      
      // Generate HTML
      let html = '<div class="badge-container">\n';
      
      elements.forEach((el: any) => {
        if (el.type === 'text') {
          const content = el.content || '';
          html += `  <div class="element element-${el.id}">${content}</div>\n`;
        } else if (el.type === 'image') {
          html += `  <div class="element element-${el.id}"><img src="{{photo_url}}" alt="Photo" /></div>\n`;
        } else if (el.type === 'qrcode' || el.type === 'qr') {
          html += `  <div class="element element-${el.id}"><img src="{{qr_code_url}}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" /></div>\n`;
        }
      });
      
      html += '</div>';
      
      // Generate CSS
      const badgeWidth = badgeTemplate.width;
      const badgeHeight = badgeTemplate.height;
      
      let css = `.badge-container {
  position: relative;
  width: ${badgeWidth}px;
  height: ${badgeHeight}px;
  ${background ? `background: ${background.startsWith('http') || background.startsWith('data:') ? `url(${background})` : background};` : 'background: #ffffff;'}
  background-size: cover;
  background-position: center;
  overflow: hidden;
}\n\n`;

      css += `.element {
  position: absolute;
  box-sizing: border-box;
}\n\n`;

      css += `.element img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}\n\n`;

      elements.forEach((el: any) => {
        const style = el.style || {};
        
        css += `.element-${el.id} {
  left: ${el.x}px;
  top: ${el.y}px;
  width: ${el.width || 'auto'}px;
  height: ${el.height || 'auto'}px;`;
        
        if (el.type === 'text') {
          css += `\n  font-size: ${style.fontSize || el.fontSize || 16}px;
  font-weight: ${style.fontWeight || el.fontWeight || 'normal'};
  font-style: ${style.fontStyle || el.fontStyle || 'normal'};
  text-align: ${style.textAlign || el.textAlign || 'left'};
  color: ${style.color || el.color || '#000000'};`;
          if (style.fontFamily || el.fontFamily) {
            css += `\n  font-family: ${style.fontFamily || el.fontFamily};`;
          }
          if (style.textTransform) css += `\n  text-transform: ${style.textTransform};`;
        }
        
        if (el.borderRadius) css += `\n  border-radius: ${el.borderRadius};`;
        if (style.rotation) css += `\n  transform: rotate(${style.rotation}deg);`;
        if (style.opacity !== undefined) css += `\n  opacity: ${style.opacity};`;
        if (style.zIndex !== undefined) css += `\n  z-index: ${style.zIndex};`;
        
        css += '\n}\n\n';
      });
      
      this.logger.log(`✅ Generated HTML/CSS from template_data`);
      
      return { html, css };
    } catch (error) {
      this.logger.error('Error generating HTML/CSS from template_data:', error);
      return { html: '', css: '' };
    }
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

            // 2. Récupérer le template de badge approprié
      let badgeTemplate = null;
      
      if (registration.badge_template_id) {
        // Si un template est déjà assigné à la registration, l'utiliser
        const templateWhere: any = {
          id: registration.badge_template_id,
          is_active: true,
        };
        
        if (orgId) {
          templateWhere.org_id = orgId;
        }

        badgeTemplate = await this.badgeTemplatesService.findOne(
          registration.badge_template_id,
          orgId || registration.org_id,
        );
      } else {
        // Sinon, utiliser la nouvelle fonction pour récupérer le bon template
        badgeTemplate = await this.badgeTemplatesService.getTemplateForEvent(
          registration.event_id,
          orgId || registration.org_id,
        );
      }

      if (!badgeTemplate) {
        throw new BadRequestException('No badge template found for this registration');
      }

      // 3. Préparer les données du badge (utilise les snapshots ou les données actuelles de l'attendee)
      const firstName = registration.snapshot_first_name || registration.attendee.first_name || '';
      const lastName = registration.snapshot_last_name || registration.attendee.last_name || '';
      const email = registration.snapshot_email || registration.attendee.email || '';
      const phone = registration.snapshot_phone || registration.attendee.phone || '';
      const company = registration.snapshot_company || registration.attendee.company || '';
      const jobTitle = registration.snapshot_job_title || registration.attendee.job_title || '';
      const country = registration.snapshot_country || registration.attendee.country || '';
      const attendeeType = registration.eventAttendeeType?.attendeeType?.name || '';
      const eventName = registration.event.name || '';
      const eventCode = registration.event.code || '';
      
      const badgeData = {
        // Snake_case (pour compatibilité avec anciens templates)
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        phone,
        company,
        job_title: jobTitle,
        country,
        attendee_type: attendeeType,
        event_name: eventName,
        event_code: eventCode,
        registration_id: registration.id,
        
        // CamelCase (pour les nouveaux templates)
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        jobTitle,
        attendeeType,
        eventName,
        eventCode,
        registrationId: registration.id,
      };

      // 3.5 Générer le QR Code avec l'ID de l'inscription
      const qrCodeData = registration.id; // Utiliser l'ID de registration comme donnée du QR Code
      const qrCodeDataUrl = await this.generateQRCode(qrCodeData);
      
      // Ajouter le QR Code aux données du badge
      badgeData['qr_code_url'] = qrCodeDataUrl;
      badgeData['qrCodeUrl'] = qrCodeDataUrl;

      // 4. Générer le HTML final avec variables remplacées
      // Fallback: si html/css sont vides, générer depuis template_data
      let htmlContent = badgeTemplate.html || '';
      let cssContent = badgeTemplate.css || '';
      
      if (!htmlContent || !cssContent) {
        this.logger.warn(`Template ${badgeTemplate.id} has no HTML/CSS, generating from template_data`);
        const generated = this.generateHTMLFromTemplateData(badgeTemplate);
        if (!htmlContent) htmlContent = generated.html;
        if (!cssContent) cssContent = generated.css;
      }
      
      // Remplacer les variables
      htmlContent = this.replaceVariables(htmlContent, badgeData);

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

      this.logger.debug(`Generated HTML Preview (first 500 chars): ${fullHtml.substring(0, 500)}`);
      this.logger.debug(`Badge dimensions: ${badgeTemplate.width}x${badgeTemplate.height}`);
      this.logger.debug(`Badge data:`, badgeData);

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
            badge_template_id: badgeTemplate.id, // Mettre à jour le template lors de la régénération
            badge_data: badgeData, // Mettre à jour les données aussi
          },
        });
      } else {
        badge = await this.prisma.badge.create({
          data: {
            org_id: registration.org_id, // Utiliser l'org_id de la registration au lieu de orgId qui peut être null
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

      // Log du HTML pour debug
      this.logger.debug(`HTML Content length: ${fullHtml.length} characters`);
      
      await page.setContent(fullHtml, {
        waitUntil: ['load', 'domcontentloaded'],
        timeout: 30000,
      });

      // Attendre un délai supplémentaire pour que le CSS soit bien appliqué
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pdfBuffer = await page.pdf({
        width: `${badgeTemplate.width}px`,
        height: `${badgeTemplate.height}px`,
        printBackground: true,
        preferCSSPageSize: false, // Désactiver pour forcer nos dimensions
        scale: 1, // Échelle 1:1
        pageRanges: '1', // Forcer uniquement la première page
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      });

      // Générer aussi une image PNG
      const imageBuffer = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: badgeTemplate.width,
          height: badgeTemplate.height,
        },
        omitBackground: false,
      });

      await page.close();

      this.logger.log(`PDF generated: ${pdfBuffer.length} bytes`);
      this.logger.log(`Image generated: ${imageBuffer.length} bytes`);

      // 7. Upload du PDF et de l'image sur Cloudflare R2
      const pdfUrl = await this.r2Service.uploadBadgePdf(registrationId, Buffer.from(pdfBuffer));
      const imageUrl = await this.r2Service.uploadBadgeImage(registrationId, Buffer.from(imageBuffer));

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
          image_url: imageUrl,
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

      // 10. Mettre à jour la registration avec les URLs des badges
      await this.prisma.registration.update({
        where: { id: registrationId },
        data: {
          badge_pdf_url: pdfUrl,
          badge_image_url: imageUrl,
        },
      });

      this.logger.log(`Badge ${badge.id} generated successfully and registration updated`);

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
      preferCSSPageSize: false, // Désactiver pour forcer nos dimensions
      scale: 1, // Échelle 1:1
      pageRanges: '1', // Forcer uniquement la première page
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
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

  /**
   * Génère une preview PNG du badge (qualité basse ou haute)
   * Utilisé pour l'affichage rapide dans le modal de preview
   */
  async generateBadgePreview(
    registrationId: string,
    orgId: string | null,
    quality: 'low' | 'high' = 'low',
  ): Promise<string> {
    // 1. Récupérer l'inscription avec ses relations
    const whereClause: any = { id: registrationId };
    if (orgId !== null) {
      whereClause.org_id = orgId;
    }

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

    // 2. Récupérer le template de badge approprié
    let badgeTemplate = null;
    
    if (registration.badge_template_id) {
      badgeTemplate = await this.badgeTemplatesService.findOne(
        registration.badge_template_id,
        orgId || registration.org_id,
      );
    } else {
      badgeTemplate = await this.badgeTemplatesService.getTemplateForEvent(
        registration.event_id,
        orgId || registration.org_id,
      );
    }

    if (!badgeTemplate) {
      throw new BadRequestException('No badge template found for this registration');
    }

    // 3. Générer HTML/CSS depuis template_data si nécessaire
    if (!badgeTemplate.html || !badgeTemplate.css) {
      const generated = this.generateHTMLFromTemplateData(badgeTemplate);
      badgeTemplate = {
        ...badgeTemplate,
        html: generated.html || badgeTemplate.html,
        css: generated.css || badgeTemplate.css,
      };
    }

    // 4. Préparer les données du badge
    const firstName = registration.snapshot_first_name || registration.attendee.first_name || '';
    const lastName = registration.snapshot_last_name || registration.attendee.last_name || '';
    const email = registration.snapshot_email || registration.attendee.email || '';
    const phone = registration.snapshot_phone || registration.attendee.phone || '';
    const company = registration.snapshot_company || registration.attendee.company || '';
    const jobTitle = registration.snapshot_job_title || registration.attendee.job_title || '';
    const country = registration.snapshot_country || registration.attendee.country || '';
    const attendeeType = registration.eventAttendeeType?.attendeeType?.name || '';
    const eventName = registration.event.name || '';
    const eventCode = registration.event.code || '';

    const badgeData = {
      // Snake_case (backward compatibility)
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      company,
      job_title: jobTitle,
      country,
      full_name: `${firstName} ${lastName}`.trim(),
      event_name: eventName,
      event_code: eventCode,
      attendee_type: attendeeType,
      registration_id: registration.id,
      
      // CamelCase (new templates)
      firstName,
      lastName,
      jobTitle,
      fullName: `${firstName} ${lastName}`.trim(),
      eventName,
      eventCode,
      attendeeType,
      registrationId: registration.id,
      
      // URLs dynamiques (si disponibles - photo_url pas encore implémenté)
      photo_url: '', // TODO: Ajouter quand le champ sera dans le schema
    };

    // 4.5 Générer le QR Code
    const qrCodeData = registration.id;
    const qrCodeDataUrl = await this.generateQRCode(qrCodeData);
    badgeData['qr_code_url'] = qrCodeDataUrl;
    badgeData['qrCodeUrl'] = qrCodeDataUrl;

    // 5. Remplacer les variables dans HTML
    const htmlContent = this.replaceVariables(badgeTemplate.html || '', badgeData);
    const cssContent = badgeTemplate.css || '';

    // 6. HTML complet
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

    // 7. Générer PNG avec Puppeteer
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Qualité basse : petit viewport et compression
    // Qualité haute : plein viewport et meilleure compression
    const scaleFactor = quality === 'low' ? 0.3 : 1;
    const jpegQuality = quality === 'low' ? 40 : 90;

    await page.setViewport({
      width: Math.round(badgeTemplate.width * scaleFactor),
      height: Math.round(badgeTemplate.height * scaleFactor),
      deviceScaleFactor: 1,
    });

    await page.setContent(fullHtml, {
      waitUntil: quality === 'low' ? 'domcontentloaded' : 'networkidle0',
    });

    // Générer PNG
    const pngBuffer = await page.screenshot({
      type: 'jpeg', // JPEG pour compression
      quality: jpegQuality,
      fullPage: true,
    });

    await page.close();

    // 8. Upload temporaire sur R2 (ou retourner base64)
    // Pour simplifier, on retourne en base64
    const base64Image = `data:image/jpeg;base64,${Buffer.from(pngBuffer).toString('base64')}`;

    this.logger.log(`✅ Badge preview generated (${quality}) for registration ${registrationId}`);

    return base64Image;
  }
}
 
