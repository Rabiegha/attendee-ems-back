import { Controller, Get, Patch, Body, Param, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('roles')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.read')
  @ApiOperation({
    summary: 'Récupérer la liste des rôles',
    description: 'Récupère tous les rôles avec leurs permissions associées. SUPER_ADMIN peut filtrer par orgId ou obtenir les templates système. Les autres voient uniquement les rôles de leur organisation.'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des rôles récupérée avec succès'
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes'
  })
  async findAll(@Request() req) {
    const userRole = req.user.role; // 'SUPER_ADMIN', 'ADMIN', etc.
    const userOrgId = req.user.org_id;
    const queryOrgId = req.query.orgId; // Query param optionnel pour SUPER_ADMIN
    const templatesOnly = req.query.templatesOnly === 'true'; // Query param pour obtenir uniquement les templates

    // 🔍 DEBUG LOGS
    console.log('🔍 [ROLES API] Request params:', {
      userRole,
      userOrgId,
      queryOrgId,
      templatesOnly,
      fullQuery: req.query
    });

    let rolesWithPermissions;
    
    if (userRole === 'SUPER_ADMIN') {
      // SUPER_ADMIN avec filtres avancés
      if (templatesOnly) {
        // Récupérer uniquement les templates système (pour création nouvelle org)
        console.log('📋 [ROLES API] Fetching SYSTEM TEMPLATES');
        rolesWithPermissions = await this.rolesService.findSystemTemplates();
      } else if (queryOrgId) {
        // Récupérer les rôles d'une organisation spécifique
        console.log(`🏢 [ROLES API] Fetching roles for org: ${queryOrgId}`);
        rolesWithPermissions = await this.rolesService.findByOrganizationWithPermissions(queryOrgId);
      } else {
        // Par défaut : tous les rôles
        console.log('🌐 [ROLES API] Fetching ALL ROLES (no filter)');
        rolesWithPermissions = await this.rolesService.findAllWithPermissions();
      }
    } else {
      // Les autres utilisateurs ne voient QUE les rôles de leur organisation
      console.log(`🔒 [ROLES API] Fetching roles for user's org: ${userOrgId}`);
      rolesWithPermissions = await this.rolesService.findByOrganizationWithPermissions(userOrgId);
    }
    
    console.log(`✅ [ROLES API] Returning ${rolesWithPermissions.length} roles`);
    
    return rolesWithPermissions.map(role => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      level: role.level, // 🔥 Ajouté pour la hiérarchie des rôles
      org_id: role.org_id,
      is_system_role: role.is_system_role,
      created_at: role.created_at,
      updated_at: role.updated_at,
      permissions: role.rolePermissions.map(rp => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        description: rp.permission.description
      }))
    }));
  }

  @Get('me')
  async getMyRole(@Request() req) {
    const userId = req.user.id;
    const userRole = await this.rolesService.findUserRole(userId);
    
    if (!userRole) {
      return { message: 'No role assigned to user' };
    }
    
    return userRole;
  }

  @Patch(':id/permissions')
  @Permissions('roles.assign')
  @ApiOperation({
    summary: 'Mettre à jour les permissions d\'un rôle',
    description: 'Permet de modifier les permissions associées à un rôle. Respecte la hiérarchie : ' +
                 'un utilisateur peut uniquement modifier les permissions des rôles de niveau strictement inférieur au sien, ' +
                 'et ne peut pas modifier les permissions de son propre rôle.'
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions mises à jour avec succès'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes, violation de hiérarchie, ou tentative de modification de son propre rôle'
  })
  async updateRolePermissions(
    @Param('id') roleId: string,
    @Body('permissionIds') permissionIds: string[],
    @Request() req
  ) {
    const userRole = req.user.role;
    const userOrgId = req.user.org_id;
    const updaterUserId = req.user.id;

    // Récupérer le rôle à modifier
    const role = await this.rolesService.findById(roleId);
    
    if (!role) {
      throw new BadRequestException('Rôle non trouvé');
    }

    // SUPER_ADMIN peut tout modifier
    if (userRole !== 'SUPER_ADMIN') {
      // Les ADMIN ne peuvent modifier QUE les rôles de leur organisation
      if (role.org_id !== userOrgId) {
        throw new ForbiddenException('Vous ne pouvez modifier que les rôles de votre organisation');
      }

      // Les ADMIN ne peuvent PAS modifier les templates système (is_system_role = true)
      if (role.is_system_role) {
        throw new ForbiddenException('Vous ne pouvez pas modifier un template système');
      }
    }

    // Mettre à jour les permissions (avec vérification hiérarchique dans le service)
    const updatedRole = await this.rolesService.updateRolePermissions(roleId, permissionIds, updaterUserId);
    
    return {
      id: updatedRole.id,
      code: updatedRole.code,
      name: updatedRole.name,
      description: updatedRole.description,
      org_id: updatedRole.org_id,
      is_system_role: updatedRole.is_system_role,
      permissions: updatedRole.rolePermissions.map(rp => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        description: rp.permission.description
      }))
    };
  }
}
