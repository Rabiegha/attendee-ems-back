import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Organization } from './organizations.model';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization)
    private organizationModel: typeof Organization,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    return this.organizationModel.create(createOrganizationDto);
  }

  async findById(id: string): Promise<Organization> {
    return this.organizationModel.findByPk(id);
  }

  async findBySlug(slug: string): Promise<Organization> {
    return this.organizationModel.findOne({ where: { slug } });
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationModel.findAll();
  }
}
