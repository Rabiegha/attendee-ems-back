import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto, UsersListResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

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
    return this.usersService.create(createUserDto, orgId);
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
  ) {
    const orgId = req.user.org_id;
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.usersService.findAll(orgId, pageNumber, limitNumber, search);
  }
}
