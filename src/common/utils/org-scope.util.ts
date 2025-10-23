import { ForbiddenException } from '@nestjs/common';

/**
 * Resolves the effective organization ID based on user permissions
 * 
 * @param reqUser - The authenticated user from the request
 * @param explicitOrgId - Optional organization ID provided in the request (query/body)
 * @param allowAny - Whether the user has :any permission (super admin)
 * @returns The organization ID to use for the operation
 * @throws ForbiddenException if user tries to access another organization without :any permission
 */
export function resolveEffectiveOrgId({
  reqUser,
  explicitOrgId,
  allowAny,
}: {
  reqUser: any;
  explicitOrgId?: string;
  allowAny: boolean;
}): string {
  const callerOrgId = reqUser.org_id;

  // Super admin can act on any org
  if (allowAny) {
    return explicitOrgId ?? callerOrgId;
  }

  // Non-super-admin: must stay in their own org
  if (explicitOrgId && explicitOrgId !== callerOrgId) {
    throw new ForbiddenException(
      `Access denied: you cannot act on another organization (${explicitOrgId})`,
    );
  }

  return callerOrgId;
}
