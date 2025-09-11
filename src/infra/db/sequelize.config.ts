import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { ConfigService } from '../../config/config.service';

export const createSequelizeConfig = (configService: ConfigService): SequelizeModuleOptions => ({
  dialect: 'postgres',
  uri: configService.databaseUrl,
  autoLoadModels: true,
  synchronize: false, // Use migrations instead
  logging: configService.nodeEnv === 'development' ? console.log : false,
});
