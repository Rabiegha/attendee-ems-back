import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    
    this.bucketName = process.env.R2_BUCKET_NAME || 'ems-badges';
    this.publicUrl = process.env.R2_PUBLIC_URL || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.logger.warn('R2 credentials not configured. Storage operations will fail.');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Upload un fichier vers R2
   * @param key - Chemin du fichier (ex: badges/uuid/badge.pdf)
   * @param buffer - Contenu du fichier
   * @param contentType - Type MIME du fichier
   * @returns URL publique du fichier
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      // Retourne l'URL publique
      const publicUrl = this.getPublicUrl(key);
      this.logger.log(`File uploaded successfully: ${key}`);
      
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}:`, error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload un badge PDF
   * @param registrationId - ID de la registration
   * @param pdfBuffer - Buffer du PDF
   * @returns URL publique du PDF
   */
  async uploadBadgePdf(
    registrationId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const key = `badges/${registrationId}/badge.pdf`;
    return this.uploadFile(key, pdfBuffer, 'application/pdf');
  }

  /**
   * Upload une image de badge (PNG/JPEG)
   * @param registrationId - ID de la registration
   * @param imageBuffer - Buffer de l'image
   * @param extension - Extension du fichier (png, jpg, jpeg)
   * @returns URL publique de l'image
   */
  async uploadBadgeImage(
    registrationId: string,
    imageBuffer: Buffer,
    extension: 'png' | 'jpg' | 'jpeg' = 'png',
  ): Promise<string> {
    const key = `badges/${registrationId}/badge.${extension}`;
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
    
    return this.uploadFile(key, imageBuffer, contentType);
  }

  /**
   * Supprime un fichier de R2
   * @param key - Chemin du fichier
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Génère une URL signée temporaire (pour uploads directs depuis le front)
   * @param key - Chemin du fichier
   * @param expiresIn - Durée de validité en secondes (défaut: 1h)
   * @returns URL signée
   */
  async getSignedUploadUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Construit l'URL publique d'un fichier
   * @param key - Chemin du fichier
   * @returns URL publique
   */
  private getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    
    // Fallback si R2_PUBLIC_URL n'est pas configuré
    return `https://${this.bucketName}.r2.dev/${key}`;
  }

  /**
   * Extrait la clé (path) depuis une URL R2
   * @param url - URL complète du fichier
   * @returns Clé du fichier
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Enlève le / du début
    } catch {
      return null;
    }
  }
}
