import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import { SendInvitationDto, CompleteInvitationDto, GetInvitationsQueryDto, InvitationResponseDto, GetInvitationsResponseDto } from './dto/invitation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('invitations')
@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer la liste des invitations' })
  @ApiResponse({ status: 200, description: 'Liste des invitations récupérée', type: GetInvitationsResponseDto })
  async getInvitations(
    @Query() query: GetInvitationsQueryDto,
    @Request() req: any,
  ) {
    const orgId = req.user.org_id; // Récupéré depuis le JWT
    return this.invitationService.getInvitations(query, orgId);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envoyer une invitation utilisateur' })
  @ApiResponse({ status: 201, description: 'Invitation envoyée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Organisation ou rôle non trouvé' })
  async sendInvitation(@Body() sendInvitationDto: SendInvitationDto, @Request() req: any) {
    const { email, roleId, orgId, organizationName } = sendInvitationDto;
    const invitedByUserId = req.user.id; // ID de l'utilisateur qui envoie l'invitation
    return this.invitationService.sendInvitation(email, roleId, orgId, invitedByUserId, organizationName);
  }

  @Get('validate/:token')
  @ApiOperation({ summary: 'Valider un token d\'invitation' })
  @ApiResponse({ status: 200, description: 'Token validé avec succès' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  async validateInvitationToken(@Param('token') token: string) {
    return this.invitationService.validateInvitationToken(token);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Annuler une invitation' })
  @ApiResponse({ status: 200, description: 'Invitation annulée avec succès' })
  @ApiResponse({ status: 404, description: 'Invitation non trouvée' })
  async cancelInvitation(@Param('id') invitationId: string, @Request() req: any) {
    const orgId = req.user.org_id;
    return this.invitationService.cancelInvitation(invitationId, orgId);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renvoyer une invitation' })
  @ApiResponse({ status: 201, description: 'Invitation renvoyée avec succès' })
  @ApiResponse({ status: 404, description: 'Invitation non trouvée' })
  async resendInvitation(@Param('id') invitationId: string, @Request() req: any) {
    const orgId = req.user.org_id;
    const invitedByUserId = req.user.id;
    return this.invitationService.resendInvitation(invitationId, orgId, invitedByUserId);
  }

  @Post('complete/:token')
  @ApiOperation({ summary: 'Compléter une invitation utilisateur' })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès' })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  async completeInvitation(
    @Param('token') token: string,
    @Body() completeInvitationDto: CompleteInvitationDto,
  ) {
    return this.invitationService.completeInvitation(token, completeInvitationDto);
  }
}