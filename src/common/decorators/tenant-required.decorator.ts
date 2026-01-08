import { SetMetadata } from '@nestjs/common';

/**
 * Decorator pour marquer qu'une route nécessite un contexte tenant
 * Utilisé conjointement avec TenantContextGuard
 * 
 * Usage:
 * @TenantRequired()
 * @Get('events')
 * findAll() { ... }
 */
export const TENANT_REQUIRED_KEY = 'tenantRequired';
export const TenantRequired = () => SetMetadata(TENANT_REQUIRED_KEY, true);
