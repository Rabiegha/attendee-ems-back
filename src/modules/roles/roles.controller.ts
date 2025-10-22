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
    description: 'Récupère tous les rôles avec leurs permissions associées. SUPER_ADMIN voit tous les rôles (templates + org-specific). Les autres voient uniquement les rôles de leur organisation.'
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

    let rolesWithPermissions;
    
    // SUPER_ADMIN voit TOUS les rôles (templates système + tous les rôles org-specific)
    if (userRole === 'SUPER_ADMIN') {
      rolesWithPermissions = await this.rolesService.findAllWithPermissions();
    } else {
      // Les autres utilisateurs ne voient QUE les rôles de leur organisation
      // (les rôles où org_id = leur org_id)
      rolesWithPermissions = await this.rolesService.findByOrganizationWithPermissions(userOrgId);
    }
    
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
    description: 'Permet de modifier les permissions associées à un rôle. SUPER_ADMIN peut modifier tous les rôles. ADMIN peut uniquement modifier les rôles de son organisation (pas les templates système).'
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions mises à jour avec succès'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes ou tentative de modification d\'un rôle système'
  })
  async updateRolePermissions(
    @Param('id') roleId: string,
    @Body('permissionIds') permissionIds: string[],
    @Request() req
  ) {
    const userRole = req.user.role;
    const userOrgId = req.user.org_id;

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

    // Mettre à jour les permissions
    const updatedRole = await this.rolesService.updateRolePermissions(roleId, permissionIds);
    
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
