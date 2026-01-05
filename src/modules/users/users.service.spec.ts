import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../infra/db/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;
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

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAuthService = {
    hashPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
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
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockAuthService.hashPassword.mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({ ...mockUser, ...createUserDto });

      const result = await service.create(createUserDto, orgId);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: createUserDto.email, org_id: orgId },
      });
      expect(mockAuthService.hashPassword).toHaveBeenCalledWith(createUserDto.password);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          ...createUserDto,
          org_id: orgId,
          password_hash: 'hashed-password',
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto, orgId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: createUserDto.email, org_id: orgId },
      });
      expect(mockAuthService.hashPassword).not.toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before creating user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockAuthService.hashPassword.mockResolvedValue('super-secure-hash');
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await service.create(createUserDto, orgId);

      expect(mockAuthService.hashPassword).toHaveBeenCalledWith('password123');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password_hash: 'super-secure-hash',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should return paginated users for organization', async () => {
      const mockUsers = [mockUser];
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10, undefined, {
        scope: 'org',
        orgId,
        userId: 'test-user-id',
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { org_id: orgId },
        include: { role: true },
        take: 10,
        skip: 0,
        orderBy: { created_at: 'desc' },
      });
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { org_id: orgId },
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
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 10, 'test', {
        scope: 'org',
        orgId,
        userId: 'test-user-id',
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          org_id: orgId,
          email: {
            contains: 'test',
            mode: 'insensitive',
          },
        },
        include: { role: true },
        take: 10,
        skip: 0,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(3, 5, undefined, {
        scope: 'org',
        orgId,
        userId: 'test-user-id',
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10, // (3-1) * 5
        }),
      );
    });
  });

  describe('findById', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should find user by id and org scope', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findById(userId, orgId);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: userId, org_id: orgId },
        include: { role: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.findById(userId, orgId);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    const email = 'test@example.com';
    const orgId = '123e4567-e89b-12d3-a456-426614174001';

    it('should find user by email and org scope', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email, orgId);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email, org_id: orgId },
        include: { role: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should enforce org scope in query', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await service.findByEmail(email, orgId);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            org_id: orgId,
          }),
        }),
      );
    });
  });
});
