import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Decorator pour extraire le user du JWT
 * 
 * Usage:
 * @Get()
 * findAll(@CurrentUser() user: JwtPayload) {
 *   console.log(user.sub, user.mode, user.currentOrgId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
