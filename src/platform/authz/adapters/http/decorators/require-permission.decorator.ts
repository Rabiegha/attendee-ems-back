/**
 * Require Permission Decorator
 * Décore une route pour exiger une permission spécifique
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Décorateur pour exiger une permission
 * 
 * @example
 * @RequirePermission('event.create')
 * async createEvent() { ... }
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

/**
 * Décorateur pour exiger plusieurs permissions (AND logic)
 * 
 * @example
 * @RequireAllPermissions(['event.create', 'event.publish'])
 * async createAndPublishEvent() { ... }
 */
export const RequireAllPermissions = (permissions: string[]) =>
  SetMetadata('requireAllPermissions', permissions);

/**
 * Décorateur pour exiger au moins une permission (OR logic)
 * 
 * @example
 * @RequireAnyPermission(['event.update', 'event.delete'])
 * async modifyEvent() { ... }
 */
export const RequireAnyPermission = (permissions: string[]) =>
  SetMetadata('requireAnyPermission', permissions);
