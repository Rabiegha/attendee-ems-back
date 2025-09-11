import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Index,
} from 'sequelize-typescript';
import { Organization } from '../organizations/organizations.model';
import { Role } from '../roles/roles.model';

@Table({
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['org_id', 'email'],
    },
  ],
})
export class User extends Model {
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
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  password_hash: string;

  @ForeignKey(() => Role)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  role_id: string;

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  is_active: boolean;

  @CreatedAt
  created_at: Date;

  @UpdatedAt
  updated_at: Date;

  @BelongsTo(() => Organization)
  organization: Organization;

  @BelongsTo(() => Role)
  role: Role;
}
