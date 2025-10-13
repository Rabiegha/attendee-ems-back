import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvitationService } from './invitation.service';
import { SendInvitationDto, CompleteInvitationDto } from './dto/invitation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envoyer une invitation utilisateur' })
  @ApiResponse({ status: 201, description: 'Invitation envoyée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Organisation ou rôle non trouvé' })
  async sendInvitation(@Body() sendInvitationDto: SendInvitationDto) {
    const { email, roleId, orgId } = sendInvitationDto;
    return this.invitationService.sendInvitation(email, roleId, orgId);
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