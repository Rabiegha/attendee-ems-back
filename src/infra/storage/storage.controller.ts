import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2Service } from './r2.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly r2Service: R2Service) {}

  /**
   * Endpoint pour uploader un fichier de test
   * POST /storage/upload/test
   */
  @Post('upload/test')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTestFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      // Upload vers R2
      const url = await this.r2Service.uploadFile(
        `test/${Date.now()}-${file.originalname}`,
        file.buffer,
        file.mimetype,
      );

      return {
        success: true,
        message: 'File uploaded successfully',
        url,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Endpoint pour générer un badge de test
   * GET /storage/badge/generate/:id
   */
  @Get('badge/generate/:id')
  async generateTestBadge(@Param('id') id: string) {
    try {
      // Créer un PDF simple de test
      const testPdfContent = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Test Badge) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000015 00000 n\n0000000068 00000 n\n0000000125 00000 n\n0000000324 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n417\n%%EOF',
      );

      // Upload vers R2
      const url = await this.r2Service.uploadBadgePdf(id, testPdfContent);

      return {
        success: true,
        message: 'Test badge PDF generated and uploaded',
        registrationId: id,
        url,
      };
    } catch (error) {
      throw new BadRequestException(`Badge generation failed: ${error.message}`);
    }
  }

  /**
   * Endpoint pour obtenir une URL signée (upload direct depuis le front)
   * GET /storage/signed-url/:key
   */
  @Get('signed-url/:key')
  async getSignedUrl(@Param('key') key: string) {
    try {
      const signedUrl = await this.r2Service.getSignedUploadUrl(key);

      return {
        success: true,
        signedUrl,
        expiresIn: 3600, // 1 heure
      };
    } catch (error) {
      throw new BadRequestException(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Endpoint de debug pour vérifier la configuration R2
   * GET /storage/debug/config
   */
  @Get('debug/config')
  async getR2Config() {
    return {
      accountId: process.env.R2_ACCOUNT_ID ? '***' + process.env.R2_ACCOUNT_ID.slice(-4) : 'NOT_SET',
      bucketName: process.env.R2_BUCKET_NAME || 'NOT_SET',
      publicUrl: process.env.R2_PUBLIC_URL || 'NOT_SET',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ? '***' + process.env.R2_ACCESS_KEY_ID.slice(-4) : 'NOT_SET',
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
    };
  }

  /**
   * Endpoint pour lister tous les badges dans R2
   * GET /storage/badges/list
   */
  @Get('badges/list')
  async listBadges() {
    try {
      const files = await this.r2Service.listFiles('badges/');
      
      // Organiser les fichiers par répertoire
      const badges = files.map(file => {
        const parts = file.split('/');
        const registrationId = parts[1]; // badges/{registrationId}/badge.pdf
        const filename = parts[2];
        
        return {
          registrationId,
          filename,
          fullPath: file,
          url: this.r2Service.getPublicUrl(file),
        };
      });

      return {
        success: true,
        count: badges.length,
        badges,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to list badges: ${error.message}`);
    }
  }

  /**
   * Endpoint pour nettoyer les badges de test
   * GET /storage/badges/cleanup/test
   */
  @Get('badges/cleanup/test')
  async cleanupTestBadges() {
    try {
      const result = await this.r2Service.cleanupTestBadges();

      return {
        success: true,
        message: `Cleanup completed: ${result.deleted} files deleted`,
        deleted: result.deleted,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    } catch (error) {
      throw new BadRequestException(`Cleanup failed: ${error.message}`);
    }
  }
}
