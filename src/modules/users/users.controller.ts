import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto, UsersListResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { resolveUserReadScope } from '../../common/utils/resolve-user-scope.util';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users.create')
  @ApiOperation({
    summary: 'Créer un nouvel utilisateur',
    description: 'Crée un nouvel utilisateur dans l\'organisation courante'
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
    type: UserResponseDto
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
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    const orgId = req.user.org_id;
    
    // Récupérer le niveau hiérarchique du créateur
    // IMPORTANT: Utiliser req.user.id (pas .sub car peut être undefined selon le JWT)
    const userId = req.user.id || req.user.sub;
    const creatorUser = await this.usersService.findOne(userId, orgId);
    const creatorRoleLevel = creatorUser?.role?.level;
    
    return this.usersService.create(createUserDto, orgId, creatorRoleLevel);
  }

  @Get()
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Récupérer la liste des utilisateurs',
    description: 'Récupère la liste paginée des utilisateurs de l\'organisation'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page (défaut: 1)',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre d\'éléments par page (défaut: 10)',
    example: 10
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Terme de recherche pour filtrer les utilisateurs',
    example: 'jean'
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filtrer par statut actif/inactif',
    example: 'true'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs récupérée avec succès',
    type: UsersListResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes'
  })
  async findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const scope = resolveUserReadScope(req.user);
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const isActiveFilter = isActive !== undefined ? isActive === 'true' : undefined;
    
    // Debug log
    console.log('🔍 Users findAll called with:', { 
      page: pageNumber, 
      limit: limitNumber, 
      search, 
      isActive: isActiveFilter,
      isActiveRaw: isActive 
    });
    
    return this.usersService.findAll(pageNumber, limitNumber, search, {
      scope,
      orgId: req.user.org_id,
      userId: req.user.id || req.user.sub,
      isActive: isActiveFilter,
    });
  }

  @Get('me')
  @Permissions('users.read:own', 'users.read:any')
  @ApiOperation({
    summary: 'Récupérer ses propres informations utilisateur',
    description: 'Récupère les informations de l\'utilisateur actuellement connecté'
  })
  @ApiResponse({
    status: 200,
    description: 'Informations utilisateur récupérées avec succès',
    type: UserResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé'
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes'
  })
  async getMe(@Request() req) {
    const userId = req.user.id;
    const orgId = req.user.org_id;
    return this.usersService.findOne(userId, orgId);
  }

  @Get(':id')
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Récupérer un utilisateur par ID',
    description: 'Récupère les informations d\'un utilisateur spécifique par son ID'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'utilisateur à récupérer',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur récupéré avec succès',
    type: UserResponseDto
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
    description: 'Utilisateur non trouvé'
  })
  async findOne(@Param('id') id: string, @Request() req) {
    const orgId = req.user.org_id;
    return this.usersService.findOne(id, orgId);
  }

  @Patch(':id')
  @Permissions('users.update')
  @ApiOperation({
    summary: 'Modifier un utilisateur',
    description: 'Modifie les informations d\'un utilisateur. Respecte la hiérarchie des rôles : ' +
                 'un utilisateur peut uniquement modifier des utilisateurs de niveau inférieur au sien, ' +
                 'et ne peut pas modifier son propre rôle.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'utilisateur à modifier',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur modifié avec succès',
    type: UserResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou violation de hiérarchie'
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
    description: 'Utilisateur non trouvé'
  })
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto, 
    @Request() req
  ) {
    const orgId = req.user.org_id;
    const updaterUserId = req.user.id;
    
    // Récupérer le niveau hiérarchique du modificateur
    const updaterUser = await this.usersService.findOne(updaterUserId, orgId);
    const updaterRoleLevel = updaterUser?.role?.level;
    
    return this.usersService.update(id, updateUserDto, orgId, updaterUserId, updaterRoleLevel);
  }

  @Post('bulk-delete')
  @Permissions('users.delete')
  @ApiOperation({
    summary: 'Supprimer plusieurs utilisateurs',
    description: 'Supprime plusieurs utilisateurs par leurs IDs'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs des utilisateurs à supprimer'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateurs supprimés avec succès',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number' }
      }
    }
  })
  async bulkDelete(@Body('ids') ids: string[], @Request() req) {
    const { user } = req;
    const allowAny = user.permissions?.some(p => p.code?.endsWith(':any'));
    const orgId = allowAny ? null : user.org_id;
    
    const deletedCount = await this.usersService.bulkDelete(ids, orgId);
    return { deletedCount };
  }

  @Post('bulk-export')
  @Permissions('users.read')
  @ApiOperation({
    summary: 'Exporter plusieurs utilisateurs',
    description: 'Exporte plusieurs utilisateurs au format CSV ou Excel'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs des utilisateurs à exporter'
        },
        format: {
          type: 'string',
          enum: ['csv', 'xlsx'],
          default: 'csv',
          description: 'Format d\'export'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Export généré avec succès'
  })
  async bulkExport(
    @Body('ids') ids: string[],
    @Body('format') format: 'csv' | 'xlsx' = 'csv',
    @Request() req,
    @Res() res: Response
  ) {
    const { user } = req;
    const allowAny = user.permissions?.some(p => p.permission.endsWith(':any'));
    const orgId = allowAny ? null : user.org_id;
    
    const { buffer, filename, mimeType } = await this.usersService.bulkExport(ids, format, orgId);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  }
}
