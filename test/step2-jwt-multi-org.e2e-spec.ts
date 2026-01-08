import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/db/prisma.service';

describe('STEP 2: JWT Multi-org + Switch Context (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminOrg1Token: string;
  let multiToken: string;
  let supportToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    
    prisma = app.get<PrismaService>(PrismaService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /login - Intelligence automatique du mode', () => {
    it('should return tenant-mode JWT for single-org user', async () => {
      const response = await request(app.getHttpServer())
        .post('/login')
        .send({
          email: 'admin-org1@test.com',
          password: 'password123',
        });

      console.log('Response status:', response.status);
      console.log('Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('mode', 'tenant');
      expect(response.body).toHaveProperty('requiresOrgSelection', false);

      // Sauvegarder le token pour les tests suivants
      adminOrg1Token = response.body.access_token;
    });

    it('should return tenant-mode JWT with currentOrgId for multi-org user', async () => {
      const response = await request(app.getHttpServer())
        .post('/login')
        .send({
          email: 'multi@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('mode', 'tenant');
      
      // Sauvegarder le token
      multiToken = response.body.access_token;
    });

    it('should return platform-mode JWT for support user', async () => {
      const response = await request(app.getHttpServer())
        .post('/login')
        .send({
          email: 'support@test.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('mode', 'platform');

      supportToken = response.body.access_token;
    });
  });

  describe('GET /me/orgs - Liste des organisations', () => {
    it('should return available orgs for multi-org user', async () => {
      const response = await request(app.getHttpServer())
        .get('/me/orgs')
        .set('Authorization', `Bearer ${multiToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('available');
      expect(Array.isArray(response.body.available)).toBe(true);
      expect(response.body.available.length).toBeGreaterThan(0);

      // Vérifier la structure d'une org
      const org = response.body.available[0];
      expect(org).toHaveProperty('orgId');
      expect(org).toHaveProperty('orgSlug');
      expect(org).toHaveProperty('orgName');
      expect(org).toHaveProperty('role');
      expect(org).toHaveProperty('roleLevel');
      expect(org).toHaveProperty('isPlatform');
    });
  });

  describe('GET /me/ability - Permissions de l\'organisation active', () => {
    it('should return permissions for current org', async () => {
      const response = await request(app.getHttpServer())
        .get('/me/ability')
        .set('Authorization', `Bearer ${adminOrg1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('orgId');
      expect(response.body).toHaveProperty('modules');
      expect(response.body).toHaveProperty('grants');
      
      expect(Array.isArray(response.body.modules)).toBe(true);
      expect(Array.isArray(response.body.grants)).toBe(true);

      // Vérifier la structure d'un grant
      if (response.body.grants.length > 0) {
        const grant = response.body.grants[0];
        expect(grant).toHaveProperty('key');
        expect(grant).toHaveProperty('scope');
        expect(['any', 'org', 'own']).toContain(grant.scope);
      }
    });

    it('should return platform permissions for platform user', async () => {
      const response = await request(app.getHttpServer())
        .get('/me/ability')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('orgId', null);
      expect(response.body).toHaveProperty('modules');
      expect(response.body.modules).toContain('platform');
    });
  });

  describe('POST /switch-org - Switch organisation', () => {
    it('should switch to another org for multi-org user', async () => {
      // D'abord récupérer la liste des orgs
      const orgsResponse = await request(app.getHttpServer())
        .get('/me/orgs')
        .set('Authorization', `Bearer ${multiToken}`)
        .expect(200);

      const availableOrgs = orgsResponse.body.available;
      expect(availableOrgs.length).toBeGreaterThanOrEqual(2);

      // Trouver une org différente de la current
      const targetOrg = availableOrgs.find(
        (org: any) => org.orgId !== orgsResponse.body.current,
      );

      if (!targetOrg) {
        // User n'a qu'une org, skip ce test
        return;
      }

      // Switcher vers cette org
      const switchResponse = await request(app.getHttpServer())
        .post('/switch-org')
        .set('Authorization', `Bearer ${multiToken}`)
        .send({ orgId: targetOrg.orgId })
        .expect(200);

      expect(switchResponse.body).toHaveProperty('access_token');
      expect(switchResponse.body).toHaveProperty('mode', 'tenant');

      // Vérifier qu'on peut récupérer les permissions de la nouvelle org
      const abilityResponse = await request(app.getHttpServer())
        .get('/me/ability')
        .set('Authorization', `Bearer ${switchResponse.body.access_token}`)
        .expect(200);

      expect(abilityResponse.body.orgId).toBe(targetOrg.orgId);
    });

    it('should reject switch to org without access', async () => {
      // Créer une org random qui n'existe pas
      const randomOrgId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post('/switch-org')
        .set('Authorization', `Bearer ${adminOrg1Token}`)
        .send({ orgId: randomOrgId })
        .expect(403);
    });
  });
});
