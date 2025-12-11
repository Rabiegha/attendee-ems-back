import { RbacContext } from "@/rbac/rbac.service";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<any>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // MVP : orgId = user.org_id comme aujourd’hui
    const orgId = user.org_id;
    if (!orgId) {
      throw new ForbiddenException('Organization scope required');
    }

    const rbacContext: RbacContext = {
      accountType: user.account_type || 'tenant',
      orgId,
      bypass: user.is_root || user.role === 'SUPER_ADMIN',
    };

    request.rbacContext = rbacContext;

    return true;
  }
}