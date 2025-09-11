import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
} from 'sequelize-typescript';
import { User } from '../users/users.model';
import { Role } from '../roles/roles.model';
import { Permission } from '../permissions/permissions.model';

@Table({
  tableName: 'organizations',
  timestamps: true,
})
export class Organization extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  slug: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  timezone: string;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => Role)
  roles: Role[];

  @HasMany(() => Permission)
  permissions: Permission[];
}
