/**
 * Authorization Module
 * Module NestJS qui configure l'injection de dépendances pour le système RBAC
 */

import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../../infra/db/prisma.module';

// Core
import { AuthorizationService } from './core/authorization.service';
import { PermissionResolver } from './core/permission-resolver';

// Ports
import { RBAC_QUERY_PORT } from './ports/rbac-query.port';
import { MEMBERSHIP_PORT } from './ports/membership.port';
import { MODULE_GATING_PORT } from './ports/module-gating.port';
import { AUTH_CONTEXT_PORT } from './ports/auth-context.port';

// Adapters DB
import { PrismaRbacQueryAdapter } from './adapters/db/prisma-rbac-query.adapter';
import { PrismaMembershipAdapter } from './adapters/db/prisma-membership.adapter';
import { PrismaModuleGatingAdapter } from './adapters/db/prisma-module-gating.adapter';
import { PrismaAuthContextAdapter } from './adapters/db/prisma-auth-context.adapter';

// Guards
import { RequirePermissionGuard } from './adapters/http/guards/require-permission.guard';

// Controllers
import { MeAbilityController } from './adapters/http/controllers/me-ability.controller';
import { RbacAdminController } from './adapters/http/controllers/rbac-admin.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [MeAbilityController, RbacAdminController],
  providers: [
    // Adapters (implémentations des ports)
    {
      provide: RBAC_QUERY_PORT,
      useClass: PrismaRbacQueryAdapter,
    },
    {
      provide: MEMBERSHIP_PORT,
      useClass: PrismaMembershipAdapter,
    },
    {
      provide: MODULE_GATING_PORT,
      useClass: PrismaModuleGatingAdapter,
    },
    {
      provide: AUTH_CONTEXT_PORT,
      useClass: PrismaAuthContextAdapter,
    },

    // Core Services
    {
      provide: PermissionResolver,
      useFactory: (rbacQueryPort) => {
        return new PermissionResolver(rbacQueryPort);
      },
      inject: [RBAC_QUERY_PORT],
    },
    {
      provide: AuthorizationService,
      useFactory: (permissionResolver, membershipPort) => {
        return new AuthorizationService(permissionResolver, membershipPort);
      },
      inject: [PermissionResolver, MEMBERSHIP_PORT],
    },

    // Guards
    RequirePermissionGuard,
  ],
  exports: [
    // Exporter les services pour utilisation dans d'autres modules
    AuthorizationService,
    PermissionResolver,
    RequirePermissionGuard,
    RBAC_QUERY_PORT,
    MEMBERSHIP_PORT,
    MODULE_GATING_PORT,
    AUTH_CONTEXT_PORT,
  ],
})
export class AuthzModule {}
