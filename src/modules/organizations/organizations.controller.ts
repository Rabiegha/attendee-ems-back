import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @Permissions('organizations.read')
  @ApiOperation({
    summary: 'Récupérer toutes les organisations',
    description: 'Récupère la liste de toutes les organisations (Super Admin uniquement)'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des organisations récupérée avec succès'
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
    return this.organizationsService.findAll();
  }

  @Get('me')
  @Permissions('organizations.read')
  @ApiOperation({
    summary: 'Récupérer mon organisation',
    description: 'Récupère les informations de l\'organisation de l\'utilisateur connecté'
  })
  @ApiResponse({
    status: 200,
    description: 'Organisation récupérée avec succès'
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes'
  })
  async getMyOrganization(@Request() req) {
    const orgId = req.user.org_id;
    return this.organizationsService.findById(orgId);
  }
}
