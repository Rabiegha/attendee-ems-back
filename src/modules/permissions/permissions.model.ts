import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany,
  Index,
} from 'sequelize-typescript';
import { Organization } from '../organizations/organizations.model';
import { RolePermission } from '../role-permissions/role-permissions.model';

@Table({
  tableName: 'permissions',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['org_id', 'code'],
    },
  ],
})
export class Permission extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @ForeignKey(() => Organization)
  @Index
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  org_id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  code: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @BelongsTo(() => Organization)
  organization: Organization;

  @HasMany(() => RolePermission)
  rolePermissions: RolePermission[];
}
