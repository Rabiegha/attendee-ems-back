/**
 * Exemples d'utilisation des seeders modulaires
 * 
 * Ces exemples montrent comment utiliser les seeders individuellement
 * ou en combinaison pour des cas d'usage spécifiques.
 */

import { disconnectPrisma, logSuccess, logError } from './utils';
import { seedOrganizations, getOrganizationBySlug } from './organizations.seeder';
import { seedRoles, getRoleByCode } from './roles.seeder';
import { seedPermissions } from './permissions.seeder';
import { seedUsers } from './users.seeder';

/**
 * Exemple 1: Seeder seulement les organisations
 */
export async function seedOnlyOrganizations() {
  try {
    console.log('🏢 Seeding only organizations...');
    const results = await seedOrganizations();
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logSuccess(`Created ${successful.length} organizations`);
    if (failed.length > 0) {
      logError(`Failed to create ${failed.length} organizations`);
    }
    
    return results;
  } catch (error) {
    logError('Failed to seed organizations', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

/**
 * Exemple 2: Seeder pour une organisation spécifique
 */
export async function seedForSpecificOrganization(orgSlug: string) {
  try {
    console.log(`🎯 Seeding for organization: ${orgSlug}`);
    
    // Vérifier que l'organisation existe
    const organization = await getOrganizationBySlug(orgSlug);
    if (!organization) {
      throw new Error(`Organization with slug '${orgSlug}' not found`);
    }
    
    // Seeder les rôles, permissions et utilisateurs pour cette organisation
    const roleResults = await seedRoles(organization.id);
    const permResults = await seedPermissions(organization.id);
    const userResults = await seedUsers(organization.id);
    
    logSuccess(`Seeded data for organization: ${organization.name}`);
    
    return {
      organization,
      roles: roleResults,
      permissions: permResults,
      users: userResults,
    };
  } catch (error) {
    logError(`Failed to seed for organization: ${orgSlug}`, error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

/**
 * Exemple 3: Seeder seulement les utilisateurs de test
 */
export async function seedTestUsers(orgSlug: string = 'acme-corp') {
  try {
    console.log('👥 Seeding test users...');
    
    const organization = await getOrganizationBySlug(orgSlug);
    if (!organization) {
      throw new Error(`Organization with slug '${orgSlug}' not found`);
    }
    
    const results = await seedUsers(organization.id);
    
    const successful = results.filter(r => r.success);
    logSuccess(`Created ${successful.length} test users`);
    
    return results;
  } catch (error) {
    logError('Failed to seed test users', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

/**
 * Exemple 4: Seeder minimal (organisations + admin seulement)
 */
export async function seedMinimal() {
  try {
    console.log('⚡ Running minimal seed...');
    
    // 1. Organisations
    const orgResults = await seedOrganizations();
    const org = await getOrganizationBySlug('acme-corp');
    
    if (!org) {
      throw new Error('Failed to create demo organization');
    }
    
    // 2. Rôles (seulement admin)
    const roleResults = await seedRoles(org.id);
    const adminRole = await getRoleByCode(org.id, 'org_admin');
    
    if (!adminRole) {
      throw new Error('Failed to create admin role');
    }
    
    // 3. Permissions basiques
    const permResults = await seedPermissions(org.id);
    
    // 4. Utilisateur admin seulement
    const userResults = await seedUsers(org.id);
    
    logSuccess('Minimal seed completed');
    
    return {
      organizations: orgResults,
      roles: roleResults,
      permissions: permResults,
      users: userResults,
    };
  } catch (error) {
    logError('Minimal seed failed', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Exemples d'utilisation :
// 
// import { seedOnlyOrganizations, seedForSpecificOrganization } from './prisma/seeders/examples';
// 
// // Seeder seulement les organisations
// await seedOnlyOrganizations();
// 
// // Seeder pour une organisation spécifique
// await seedForSpecificOrganization('my-company');
// 
// // Seeder minimal
// await seedMinimal();
