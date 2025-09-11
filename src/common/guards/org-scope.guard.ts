import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    if (!user || !user.org_id) {
      throw new ForbiddenException('Organization scope required');
    }

    // Attach org_id to request for easy access in controllers/services
    request['org_id'] = user.org_id;

    return true;
  }
}
