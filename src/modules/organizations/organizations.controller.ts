import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @Permissions('organizations.read')
  async getMyOrganization(@Request() req) {
    const orgId = req.user.org_id;
    return this.organizationsService.findById(orgId);
  }
}
