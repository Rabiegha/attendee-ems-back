import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/exceptions/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('/v1/auth/login (POST) - should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'admin@acme.test',
          password: 'Admin#12345',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(typeof response.body.access_token).toBe('string');
      
      // Store token for subsequent tests
      accessToken = response.body.access_token;
    });

    it('/v1/auth/login (POST) - should fail with invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'admin@acme.test',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('/v1/auth/login (POST) - should fail with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Admin#12345',
        })
        .expect(400);
    });
  });

  describe('Protected Routes', () => {
    it('/v1/users (GET) - should return users with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('/v1/users (GET) - should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/users')
        .expect(401);
    });

    it('/v1/users (GET) - should fail with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/v1/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('/v1/organizations/me (GET) - should return organization with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/organizations/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('slug');
      expect(response.body.name).toBe('Acme Corp');
    });

    it('/v1/organizations/me (GET) - should fail without token', async () => {
      await request(app.getHttpServer())
        .get('/v1/organizations/me')
        .expect(401);
    });
  });

  describe('User Creation', () => {
    it('/v1/users (POST) - should create user with valid data and permissions', async () => {
      // First get a role ID
      const rolesResponse = await request(app.getHttpServer())
        .get('/v1/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const staffRole = rolesResponse.body.find((role: any) => role.code === 'staff');
      expect(staffRole).toBeDefined();

      const response = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'test@acme.test',
          password: 'TestPassword123',
          role_id: staffRole.id,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe('test@acme.test');
    });

    it('/v1/users (POST) - should fail without token', async () => {
      await request(app.getHttpServer())
        .post('/v1/users')
        .send({
          email: 'test2@acme.test',
          password: 'TestPassword123',
          role_id: 'some-role-id',
        })
        .expect(401);
    });
  });
});
