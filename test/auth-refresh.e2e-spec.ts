import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/db/prisma.service';
import { ConfigService } from '../src/config/config.service';
import * as cookieParser from 'cookie-parser';

describe('Auth Refresh (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    configService = app.get<ConfigService>(ConfigService);

    // Configure app like in main.ts
    app.use(cookieParser());
    app.enableCors({
      origin: configService.apiCorsOrigin,
      credentials: true,
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/login (POST)', () => {
    it('should login and set refresh token cookie', async () => {
      const loginDto = {
        email: 'admin@acme.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(loginDto)
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', loginDto.email);

      // Check if refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = cookieArray.find((cookie: string) => 
        cookie.startsWith(configService.authCookieName)
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/auth/refresh');
    });

    it('should fail with invalid credentials', async () => {
      const loginDto = {
        email: 'admin@acme.com',
        password: 'wrongpassword',
      };

      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Login to get a refresh token
      const loginDto = {
        email: 'admin@acme.com',
        password: 'password123',
      };

      const loginResponse = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(loginDto);

      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      refreshTokenCookie = cookieArray.find((cookie: string) => 
        cookie.startsWith(configService.authCookieName)
      );
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).not.toHaveProperty('user');

      // Check if new refresh token cookie is set (rotation)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      const newRefreshCookie = cookieArray.find((cookie: string) => 
        cookie.startsWith(configService.authCookieName)
      );
      expect(newRefreshCookie).toBeDefined();
    });

    it('should fail without refresh token cookie', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(401);
    });

    it('should fail with invalid refresh token', async () => {
      const invalidCookie = `${configService.authCookieName}=invalid.token.here`;
      
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', invalidCookie)
        .expect(401);
    });
  });

  describe('/auth/logout (POST)', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Login to get a refresh token
      const loginDto = {
        email: 'admin@acme.com',
        password: 'password123',
      };

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto);

      const cookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
      refreshTokenCookie = cookieArray.find((cookie: string) => 
        cookie.startsWith(configService.authCookieName)
      );
    });

    it('should logout and clear refresh token cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toEqual({ ok: true });

      // Check if refresh token cookie is cleared
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
        const clearedCookie = cookieArray.find((cookie: string) => 
          cookie.startsWith(configService.authCookieName)
        );
        if (clearedCookie) {
          expect(clearedCookie).toContain('Max-Age=0');
        }
      }
    });

    it('should work even without refresh token cookie', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(200);
    });
  });

  describe('Token Rotation', () => {
    it('should invalidate old refresh token after rotation', async () => {
      // Login to get initial refresh token
      const loginDto = {
        email: 'admin@acme.com',
        password: 'password123',
      };

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto);

      const initialCookies = loginResponse.headers['set-cookie'];
      const cookieArray = Array.isArray(initialCookies) ? initialCookies : [initialCookies];
      const initialRefreshCookie = cookieArray.find((cookie: string) => 
        cookie.startsWith(configService.authCookieName)
      );

      // First refresh - should work
      const firstRefreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', initialRefreshCookie)
        .expect(200);

      // Try to use the old refresh token again - should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', initialRefreshCookie)
        .expect(401);
    });
  });
});
