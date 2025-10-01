import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export interface SeedResult {
  success: boolean;
  message: string;
  data?: any;
}

export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

export function logError(message: string, error?: any): void {
  console.error(`❌ ${message}`, error);
}

export function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
