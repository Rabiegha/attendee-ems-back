import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
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

  @Post()
  @Permissions('organizations.create')
  @ApiOperation({
    summary: 'Créer une nouvelle organisation',
    description: 'Crée une nouvelle organisation (Super Admin uniquement)'
  })
  @ApiBody({ type: CreateOrganizationDto })
  @ApiResponse({
    status: 201,
    description: 'Organisation créée avec succès'
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides'
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes'
  })
  @ApiResponse({
    status: 409,
    description: 'Organisation avec ce slug existe déjà'
  })
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @Permissions('organizations.read:any')
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
  @Permissions('organizations.read:any', 'organizations.read:own')
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

  @Get(':id')
  @Permissions('organizations.read:any')
  @ApiOperation({
    summary: 'Récupérer une organisation par ID',
    description: 'Récupère les informations d\'une organisation spécifique par son ID'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'organisation à récupérer',
    example: '123e4567-e89b-12d3-a456-426614174000'
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
  @ApiResponse({
    status: 404,
    description: 'Organisation non trouvée'
  })
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}
