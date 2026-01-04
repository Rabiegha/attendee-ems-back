/**
 * Tests pour valider le modèle multi-tenant (STEP 1)
 * 
 * Ces tests vérifient que les invariants DB sont bien respectés
 */

import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const prisma = new PrismaClient();

describe('STEP 1 - Multi-tenant Model', () => {
  let testOrgId1: string;
  let testOrgId2: string;
  let testUserId: string;
  let testRoleAdminOrg1: string;
  let testRoleManagerOrg1: string;
  let testRoleAdminOrg2: string;
  let testRoleSupport: string;
  let testRoleRoot: string;

  beforeAll(async () => {
    // Créer des organisations de test
    const org1 = await prisma.organization.create({
      data: { name: 'Test Org 1', slug: 'test-org-1' },
    });
    testOrgId1 = org1.id;

    const org2 = await prisma.organization.create({
      data: { name: 'Test Org 2', slug: 'test-org-2' },
    });
    testOrgId2 = org2.id;

    // Créer des rôles tenant pour org1
    const roleAdmin1 = await prisma.role.create({
      data: {
        org_id: testOrgId1,
        code: 'ADMIN',
        name: 'Admin',
        level: 1,
        is_platform: false,
      },
    });
    testRoleAdminOrg1 = roleAdmin1.id;

    const roleManager1 = await prisma.role.create({
      data: {
        org_id: testOrgId1,
        code: 'MANAGER',
        name: 'Manager',
        level: 2,
        is_platform: false,
      },
    });
    testRoleManagerOrg1 = roleManager1.id;

    // Créer un rôle tenant pour org2
    const roleAdmin2 = await prisma.role.create({
      data: {
        org_id: testOrgId2,
        code: 'ADMIN',
        name: 'Admin',
        level: 1,
        is_platform: false,
      },
    });
    testRoleAdminOrg2 = roleAdmin2.id;

    // Créer des rôles platform
    const roleSupport = await prisma.role.create({
      data: {
        org_id: null,
        code: 'SUPPORT',
        name: 'Support',
        level: 10,
        is_platform: true,
        is_root: false,
      },
    });
    testRoleSupport = roleSupport.id;

    const roleRoot = await prisma.role.create({
      data: {
        org_id: null,
        code: 'ROOT',
        name: 'Root',
        level: 0,
        is_platform: true,
        is_root: true,
      },
    });
    testRoleRoot = roleRoot.id;
  });

  afterAll(async () => {
    // Nettoyage
    await prisma.tenantUserRole.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUserOrgAccess.deleteMany({});
    await prisma.orgUser.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-' } },
    });
    await prisma.role.deleteMany({
      where: { code: { in: ['ADMIN', 'MANAGER', 'SUPPORT', 'ROOT'] } },
    });
    await prisma.organization.deleteMany({
      where: { slug: { startsWith: 'test-org-' } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Créer un user de test pour chaque test
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password_hash: 'hashed',
      },
    });
    testUserId = user.id;
  });

  describe('User Global', () => {
    it('devrait créer un user avec email unique global', async () => {
      const user = await prisma.user.create({
        data: {
          email: `unique-${Date.now()}@example.com`,
          password_hash: 'hashed',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toContain('unique-');
    });

    it('devrait échouer si email déjà existant', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      await prisma.user.create({
        data: { email, password_hash: 'hashed' },
      });

      await expect(
        prisma.user.create({
          data: { email, password_hash: 'hashed' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('OrgUser (Membership)', () => {
    it('devrait créer un membership user-org', async () => {
      const membership = await prisma.orgUser.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
        },
      });

      expect(membership.user_id).toBe(testUserId);
      expect(membership.org_id).toBe(testOrgId1);
    });

    it('devrait échouer si membership déjà existant (UNIQUE)', async () => {
      await prisma.orgUser.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
        },
      });

      await expect(
        prisma.orgUser.create({
          data: {
            user_id: testUserId,
            org_id: testOrgId1,
          },
        }),
      ).rejects.toThrow();
    });

    it('devrait permettre un user dans plusieurs orgs', async () => {
      await prisma.orgUser.create({
        data: { user_id: testUserId, org_id: testOrgId1 },
      });

      await prisma.orgUser.create({
        data: { user_id: testUserId, org_id: testOrgId2 },
      });

      const memberships = await prisma.orgUser.findMany({
        where: { user_id: testUserId },
      });

      expect(memberships).toHaveLength(2);
    });
  });

  describe('TenantUserRole (Rôles Tenant)', () => {
    beforeEach(async () => {
      // Créer le membership avant d'assigner un rôle
      await prisma.orgUser.create({
        data: { user_id: testUserId, org_id: testOrgId1 },
      });
    });

    it('devrait assigner un rôle tenant à un user', async () => {
      const assignment = await prisma.tenantUserRole.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
          role_id: testRoleAdminOrg1,
        },
      });

      expect(assignment.user_id).toBe(testUserId);
      expect(assignment.org_id).toBe(testOrgId1);
      expect(assignment.role_id).toBe(testRoleAdminOrg1);
    });

    it('devrait échouer si user pas membre de l\'org (FK composite)', async () => {
      // Pas de membership dans org2
      await expect(
        prisma.tenantUserRole.create({
          data: {
            user_id: testUserId,
            org_id: testOrgId2,
            role_id: testRoleAdminOrg2,
          },
        }),
      ).rejects.toThrow();
    });

    it('devrait échouer si rôle n\'appartient pas à l\'org (FK composite)', async () => {
      // Essayer d'assigner un rôle de org2 à user dans org1
      await expect(
        prisma.tenantUserRole.create({
          data: {
            user_id: testUserId,
            org_id: testOrgId1,
            role_id: testRoleAdminOrg2, // Rôle de org2
          },
        }),
      ).rejects.toThrow();
    });

    it('devrait permettre 1 seul rôle tenant actif par org (UNIQUE)', async () => {
      // Premier rôle
      await prisma.tenantUserRole.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
          role_id: testRoleAdminOrg1,
        },
      });

      // Essayer d'assigner un 2e rôle différent dans la même org
      await expect(
        prisma.tenantUserRole.create({
          data: {
            user_id: testUserId,
            org_id: testOrgId1,
            role_id: testRoleManagerOrg1,
          },
        }),
      ).rejects.toThrow();
    });

    it('devrait permettre de changer de rôle (upsert)', async () => {
      // Assigner Admin
      await prisma.tenantUserRole.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
          role_id: testRoleAdminOrg1,
        },
      });

      // Changer pour Manager
      await prisma.tenantUserRole.update({
        where: {
          user_id_org_id: {
            user_id: testUserId,
            org_id: testOrgId1,
          },
        },
        data: {
          role_id: testRoleManagerOrg1,
        },
      });

      const assignment = await prisma.tenantUserRole.findUnique({
        where: {
          user_id_org_id: {
            user_id: testUserId,
            org_id: testOrgId1,
          },
        },
      });

      expect(assignment?.role_id).toBe(testRoleManagerOrg1);
    });

    it('devrait permettre un user avec rôles dans plusieurs orgs', async () => {
      // Membership dans org2
      await prisma.orgUser.create({
        data: { user_id: testUserId, org_id: testOrgId2 },
      });

      // Rôle dans org1
      await prisma.tenantUserRole.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
          role_id: testRoleAdminOrg1,
        },
      });

      // Rôle dans org2
      await prisma.tenantUserRole.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId2,
          role_id: testRoleAdminOrg2,
        },
      });

      const roles = await prisma.tenantUserRole.findMany({
        where: { user_id: testUserId },
      });

      expect(roles).toHaveLength(2);
    });

    it('devrait échouer si on essaie d\'assigner un rôle platform (trigger)', async () => {
      // Le trigger devrait empêcher d'assigner un rôle platform dans tenant_user_roles
      await expect(
        prisma.tenantUserRole.create({
          data: {
            user_id: testUserId,
            org_id: testOrgId1,
            role_id: testRoleSupport, // Rôle platform
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('PlatformUserRole (Rôles Platform)', () => {
    it('devrait assigner un rôle platform à un user', async () => {
      const assignment = await prisma.platformUserRole.create({
        data: {
          user_id: testUserId,
          role_id: testRoleSupport,
          scope: 'assigned',
        },
      });

      expect(assignment.user_id).toBe(testUserId);
      expect(assignment.role_id).toBe(testRoleSupport);
      expect(assignment.scope).toBe('assigned');
    });

    it('devrait permettre 1 seul rôle platform par user (UNIQUE)', async () => {
      await prisma.platformUserRole.create({
        data: {
          user_id: testUserId,
          role_id: testRoleSupport,
        },
      });

      // Essayer d'assigner un 2e rôle platform
      await expect(
        prisma.platformUserRole.create({
          data: {
            user_id: testUserId,
            role_id: testRoleRoot,
          },
        }),
      ).rejects.toThrow();
    });

    it('devrait permettre de changer de rôle platform (upsert)', async () => {
      await prisma.platformUserRole.create({
        data: {
          user_id: testUserId,
          role_id: testRoleSupport,
        },
      });

      await prisma.platformUserRole.update({
        where: { user_id: testUserId },
        data: { role_id: testRoleRoot },
      });

      const assignment = await prisma.platformUserRole.findUnique({
        where: { user_id: testUserId },
      });

      expect(assignment?.role_id).toBe(testRoleRoot);
    });

    it('devrait échouer si on essaie d\'assigner un rôle tenant (trigger)', async () => {
      // Le trigger devrait empêcher d'assigner un rôle tenant dans platform_user_roles
      await expect(
        prisma.platformUserRole.create({
          data: {
            user_id: testUserId,
            role_id: testRoleAdminOrg1, // Rôle tenant
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('PlatformUserOrgAccess (Accès Platform Assigned)', () => {
    it('devrait donner accès à une org spécifique', async () => {
      const access = await prisma.platformUserOrgAccess.create({
        data: {
          user_id: testUserId,
          org_id: testOrgId1,
          reason: 'Support ticket',
        },
      });

      expect(access.user_id).toBe(testUserId);
      expect(access.org_id).toBe(testOrgId1);
    });

    it('devrait permettre l\'accès à plusieurs orgs', async () => {
      await prisma.platformUserOrgAccess.createMany({
        data: [
          { user_id: testUserId, org_id: testOrgId1 },
          { user_id: testUserId, org_id: testOrgId2 },
        ],
      });

      const accesses = await prisma.platformUserOrgAccess.findMany({
        where: { user_id: testUserId },
      });

      expect(accesses).toHaveLength(2);
    });

    it('devrait échouer si accès déjà existant (UNIQUE)', async () => {
      await prisma.platformUserOrgAccess.create({
        data: { user_id: testUserId, org_id: testOrgId1 },
      });

      await expect(
        prisma.platformUserOrgAccess.create({
          data: { user_id: testUserId, org_id: testOrgId1 },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Scénarios Complets', () => {
    it('Scénario 1: User multi-tenant avec rôles différents', async () => {
      // Alice est Admin dans org1 et Viewer dans org2
      const alice = await prisma.user.create({
        data: {
          email: `alice-${Date.now()}@example.com`,
          password_hash: 'hashed',
        },
      });

      // Memberships
      await prisma.orgUser.createMany({
        data: [
          { user_id: alice.id, org_id: testOrgId1 },
          { user_id: alice.id, org_id: testOrgId2 },
        ],
      });

      // Rôles
      await prisma.tenantUserRole.createMany({
        data: [
          { user_id: alice.id, org_id: testOrgId1, role_id: testRoleAdminOrg1 },
          { user_id: alice.id, org_id: testOrgId2, role_id: testRoleAdminOrg2 },
        ],
      });

      // Vérifier
      const roles = await prisma.tenantUserRole.findMany({
        where: { user_id: alice.id },
        include: { role: true },
      });

      expect(roles).toHaveLength(2);
      expect(roles.find((r) => r.org_id === testOrgId1)?.role.code).toBe('ADMIN');
      expect(roles.find((r) => r.org_id === testOrgId2)?.role.code).toBe('ADMIN');
    });

    it('Scénario 2: Support agent avec accès limité', async () => {
      const bob = await prisma.user.create({
        data: {
          email: `bob-${Date.now()}@example.com`,
          password_hash: 'hashed',
        },
      });

      // Rôle platform
      await prisma.platformUserRole.create({
        data: {
          user_id: bob.id,
          role_id: testRoleSupport,
          scope: 'assigned',
        },
      });

      // Accès à 2 orgs
      await prisma.platformUserOrgAccess.createMany({
        data: [
          { user_id: bob.id, org_id: testOrgId1 },
          { user_id: bob.id, org_id: testOrgId2 },
        ],
      });

      // Vérifier
      const platformRole = await prisma.platformUserRole.findUnique({
        where: { user_id: bob.id },
        include: { role: true },
      });

      const accesses = await prisma.platformUserOrgAccess.findMany({
        where: { user_id: bob.id },
      });

      expect(platformRole?.role.code).toBe('SUPPORT');
      expect(platformRole?.scope).toBe('assigned');
      expect(accesses).toHaveLength(2);
    });

    it('Scénario 3: Root administrator avec accès complet', async () => {
      const charlie = await prisma.user.create({
        data: {
          email: `charlie-${Date.now()}@example.com`,
          password_hash: 'hashed',
        },
      });

      // Rôle root
      await prisma.platformUserRole.create({
        data: {
          user_id: charlie.id,
          role_id: testRoleRoot,
          scope: 'all',
        },
      });

      // Vérifier
      const platformRole = await prisma.platformUserRole.findUnique({
        where: { user_id: charlie.id },
        include: { role: true },
      });

      expect(platformRole?.role.code).toBe('ROOT');
      expect(platformRole?.role.is_root).toBe(true);
      expect(platformRole?.scope).toBe('all');
    });
  });
});
