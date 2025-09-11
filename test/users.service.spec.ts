import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../src/modules/users/users.service';
import { User } from '../src/modules/users/users.model';
import { AuthService } from '../src/auth/auth.service';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: typeof User;
  let authService: AuthService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    org_id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    role_id: '123e4567-e89b-12d3-a456-426614174002',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
  };

  const mockAuthService = {
    hashPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get<typeof User>(getModelToken(User));
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      role_id: '123e4567-e89b-12d3-a456-426614174002',
    };
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should create a new user successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(null); // No existing user
      mockAuthService.hashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.create(createUserDto, orgId);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email, org_id: orgId },
      });
      expect(mockAuthService.hashPassword).toHaveBeenCalledWith(createUserDto.password);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        ...createUserDto,
        org_id: orgId,
        password_hash: 'hashed-password',
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser); // Existing user

      await expect(service.create(createUserDto, orgId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email, org_id: orgId },
      });
      expect(mockAuthService.hashPassword).not.toHaveBeenCalled();
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should hash password before creating user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockAuthService.hashPassword.mockResolvedValue('super-secure-hash');
      mockUserModel.create.mockResolvedValue(mockUser);

      await service.create(createUserDto, orgId);

      expect(mockAuthService.hashPassword).toHaveBeenCalledWith('password123');
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password_hash: 'super-secure-hash',
        }),
      );
    });
  });

  describe('findAll', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should return paginated users for organization', async () => {
      const mockUsers = [mockUser];
      mockUserModel.findAndCountAll.mockResolvedValue({
        rows: mockUsers,
        count: 1,
      });

      const result = await service.findAll(orgId, 1, 10);

      expect(mockUserModel.findAndCountAll).toHaveBeenCalledWith({
        where: { org_id: orgId },
        include: expect.any(Array),
        limit: 10,
        offset: 0,
        order: [['created_at', 'DESC']],
      });
      expect(result).toEqual({
        users: mockUsers,
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter users by search term', async () => {
      const mockUsers = [mockUser];
      mockUserModel.findAndCountAll.mockResolvedValue({
        rows: mockUsers,
        count: 1,
      });

      await service.findAll(orgId, 1, 10, 'test');

      expect(mockUserModel.findAndCountAll).toHaveBeenCalledWith({
        where: {
          org_id: orgId,
          email: { [expect.any(Symbol)]: '%test%' }, // Op.iLike
        },
        include: expect.any(Array),
        limit: 10,
        offset: 0,
        order: [['created_at', 'DESC']],
      });
    });

    it('should handle pagination correctly', async () => {
      mockUserModel.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      await service.findAll(orgId, 3, 5);

      expect(mockUserModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 10, // (3-1) * 5
        }),
      );
    });
  });

  describe('findById', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should find user by id and org scope', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(userId, orgId);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { id: userId, org_id: orgId },
        include: expect.any(Array),
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.findById(userId, orgId);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    const email = 'test@example.com';
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should find user by email and org scope', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email, orgId);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        where: { email, org_id: orgId },
        include: expect.any(Array),
      });
      expect(result).toEqual(mockUser);
    });

    it('should enforce org scope in query', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await service.findByEmail(email, orgId);

      expect(mockUserModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            org_id: orgId,
          }),
        }),
      );
    });
  });
});
