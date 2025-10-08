import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permissions('permissions.read')
  @ApiOperation({
    summary: 'Récupérer la liste des permissions',
    description: 'Récupère toutes les permissions disponibles dans le système'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des permissions récupérée avec succès'
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
    return this.permissionsService.findAll();
  }
}
