import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
    description: 'Récupère tous les rôles avec leurs permissions associées'
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
  async findAll() {
    const rolesWithPermissions = await this.rolesService.findAllWithPermissions();
    
    return rolesWithPermissions.map(role => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
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
}
