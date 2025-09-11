import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Organization } from '../organizations/organizations.model';
import { Role } from '../roles/roles.model';
import { Permission } from '../permissions/permissions.model';

@Table({
  tableName: 'role_permissions',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['org_id', 'role_id', 'permission_id'],
    },
  ],
})
export class RolePermission extends Model {
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

  @ForeignKey(() => Role)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  role_id: string;

  @ForeignKey(() => Permission)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  permission_id: string;

  @BelongsTo(() => Organization)
  organization: Organization;

  @BelongsTo(() => Role)
  role: Role;

  @BelongsTo(() => Permission)
  permission: Permission;
}
