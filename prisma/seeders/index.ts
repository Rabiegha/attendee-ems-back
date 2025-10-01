import { disconnectPrisma, logSuccess, logError, logInfo } from './utils';
import { seedOrganizations, getOrganizationBySlug } from './organizations.seeder';
import { seedRoles, getRoleByCode } from './roles.seeder';
import { seedPermissions, assignPermissionsToRole } from './permissions.seeder';
import { seedUsers } from './users.seeder';

/**
 * Main seeding function that runs all seeders in the correct order
 * Can be used both as a standalone script and imported by other modules
 */
async function runAllSeeders() {
  console.log('🌱 Starting modular seed...');
  
  try {
    // 1. Seed Organizations
    logInfo('Seeding organizations...');
    const orgResults = await seedOrganizations();
    const failedOrgs = orgResults.filter(r => !r.success);
    if (failedOrgs.length > 0) {
      throw new Error(`Failed to seed organizations: ${failedOrgs.map(r => r.message).join(', ')}`);
    }
    
    // Get the demo organization for subsequent seeders
    const demoOrg = await getOrganizationBySlug('acme-corp');
    if (!demoOrg) {
      throw new Error('Demo organization not found after seeding');
    }
    
    // 2. Seed Roles
    logInfo('Seeding roles...');
    const roleResults = await seedRoles(demoOrg.id);
    const failedRoles = roleResults.filter(r => !r.success);
    if (failedRoles.length > 0) {
      throw new Error(`Failed to seed roles: ${failedRoles.map(r => r.message).join(', ')}`);
    }
    
    // 3. Seed Permissions
    logInfo('Seeding permissions...');
    const permResults = await seedPermissions(demoOrg.id);
    const failedPerms = permResults.filter(r => !r.success);
    if (failedPerms.length > 0) {
      throw new Error(`Failed to seed permissions: ${failedPerms.map(r => r.message).join(', ')}`);
    }
    
    // 4. Assign permissions to roles
    logInfo('Assigning permissions to roles...');
    
    // Get roles
    const adminRole = await getRoleByCode(demoOrg.id, 'org_admin');
    const userRole = await getRoleByCode(demoOrg.id, 'user');
    
    if (!adminRole || !userRole) {
      throw new Error('Required roles not found after seeding');
    }
    
    // Assign all permissions to admin role
    const allPermissionCodes = [
      'users.create', 'users.read', 'users.update', 'users.delete',
      'organizations.read', 'organizations.update',
      'roles.read', 'permissions.read'
    ];
    
    const adminPermResults = await assignPermissionsToRole(
      demoOrg.id,
      adminRole.id, 
      allPermissionCodes
    );
    
    // Assign basic permissions to user role
    const userPermissionCodes = [
      'users.read', 'users.update',
      'organizations.read',
      'roles.read', 'permissions.read'
    ];
    
    const userPermResults = await assignPermissionsToRole(
      demoOrg.id,
      userRole.id, 
      userPermissionCodes
    );
    
    const failedPermAssignments = [...adminPermResults, ...userPermResults].filter(r => !r.success);
    if (failedPermAssignments.length > 0) {
      logError('Some permission assignments failed', failedPermAssignments.map(r => r.message));
    }
    
    logSuccess('Assigned permissions to roles');
    
    // 5. Seed Users
    logInfo('Seeding users...');
    const userResults = await seedUsers(demoOrg.id);
    const failedUsers = userResults.filter(r => !r.success);
    if (failedUsers.length > 0) {
      logError('Some users failed to seed', failedUsers.map(r => r.message));
    }
    
    // Summary
    console.log('');
    logSuccess('🎉 Modular seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`- Organizations: ${orgResults.filter(r => r.success).length} created/updated`);
    console.log(`- Roles: ${roleResults.filter(r => r.success).length} created/updated`);
    console.log(`- Permissions: ${permResults.filter(r => r.success).length} created/updated`);
    console.log(`- Users: ${userResults.filter(r => r.success).length} created/updated`);
    console.log('');
    console.log('🔑 Demo credentials:');
    console.log('Admin - Email: admin@acme-corp.com | Password: admin123');
    console.log('User  - Email: user@acme-corp.com  | Password: user123');
    
    return {
      success: true,
      summary: {
        organizations: orgResults.filter(r => r.success).length,
        roles: roleResults.filter(r => r.success).length,
        permissions: permResults.filter(r => r.success).length,
        users: userResults.filter(r => r.success).length
      }
    };
    
  } catch (error) {
    logError('Seed process failed', error);
    throw error;
  }
}

// Export the function as default for use in other modules
export default runAllSeeders;

// Also export as named export for flexibility
export { runAllSeeders };

// Run the seeder when this file is executed directly
if (require.main === module) {
  runAllSeeders()
    .catch((e) => {
      logError('❌ Seed failed with unhandled error', e);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
