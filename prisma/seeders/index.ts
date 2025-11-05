import { disconnectPrisma, logSuccess, logError, logInfo, prisma } from './utils';
import { seedOrganizations, getOrganizationBySlug } from './organizations.seeder';
import { seedRoles, getRoleByCode } from './roles.seeder';
import { seedPermissions, assignAllRolePermissions } from './permissions.seeder';
import { seedUsers } from './users.seeder';
import { seedEvents } from './events.seeder';
import { seedBadgeTemplates } from './badge-templates.seeder';
import { seedAttendeesAndRegistrations } from './attendees.seeder';
import { seedAttendeeTypes } from './attendee-types.seeder';
import { seedEventAttendeeTypes } from './event-attendee-types.seeder';
import { seedRegistrationsForEvent } from './registrations.seeder';

/**
 * Main seeding function that runs all seeders in the correct order
 * Can be used both as a standalone script and imported by other modules
 */
async function runAllSeeders() {
  console.log('🌱 Starting Event Management System seed...');
  
  try {
    // 1. Seed Organizations
    logInfo('Seeding organizations...');
    const orgResults = await seedOrganizations();
    const failedOrgs = orgResults.filter(r => !r.success);
    if (failedOrgs.length > 0) {
      throw new Error(`Failed to seed organizations: ${failedOrgs.map(r => r.message).join(', ')}`);
    }
    
    // Verify required organizations exist
    const systemOrg = await getOrganizationBySlug('system');
    const acmeOrg = await getOrganizationBySlug('acme-corp');
    if (!systemOrg || !acmeOrg) {
      throw new Error('Required organizations not found after seeding');
    }
    
    // 2. Seed Roles
    logInfo('Seeding roles...');
    const roleResults = await seedRoles();
    const failedRoles = roleResults.filter(r => !r.success);
    if (failedRoles.length > 0) {
      throw new Error(`Failed to seed roles: ${failedRoles.map(r => r.message).join(', ')}`);
    }
    
    // 3. Seed Permissions
    logInfo('Seeding permissions...');
    const permResults = await seedPermissions();
    const failedPerms = permResults.filter(r => !r.success);
    if (failedPerms.length > 0) {
      throw new Error(`Failed to seed permissions: ${failedPerms.map(r => r.message).join(', ')}`);
    }
    
    // 4. Assign permissions to roles according to mapping
    logInfo('Assigning permissions to roles...');
    const permAssignResults = await assignAllRolePermissions();
    const failedPermAssignments = permAssignResults.filter(r => !r.success);
    if (failedPermAssignments.length > 0) {
      logError('Some permission assignments failed', failedPermAssignments.map(r => r.message));
    }
    
    logSuccess('Assigned permissions to roles according to role mapping');
    
    // 5. Seed Users
    logInfo('Seeding users...');
    const userResults = await seedUsers();
    const failedUsers = userResults.filter(r => !r.success);
    if (failedUsers.length > 0) {
      logError('Some users failed to seed', failedUsers.map(r => r.message));
    }
    
    // 6. Seed Attendee Types
    logInfo('Seeding attendee types...');
    const attendeeTypes = await seedAttendeeTypes();
    
    // 7. Seed Events
    logInfo('Seeding events...');
    const events = await seedEvents();
    
    // 7.5. Seed Badge Templates
    logInfo('Seeding badge templates...');
    await seedBadgeTemplates(prisma);
    
    // 8. Seed Attendees and Registrations
    logInfo('Seeding attendees and registrations...');
    const { attendees, registrationsCount } = await seedAttendeesAndRegistrations();
    
    // 9. Seed Event Attendee Types (for specific event)
    logInfo('Seeding event attendee types for specific event...');
    const eventAttendeeTypes = await seedEventAttendeeTypes();
    
    // 10. Seed Registrations for specific event
    logInfo('Seeding registrations for specific event...');
    const specificEventRegistrations = await seedRegistrationsForEvent();
    
    // Get the super admin user for final log
    const superAdminRole = await getRoleByCode('SUPER_ADMIN');
    
    // Summary
    console.log('');
    logSuccess('🎉 Event Management System seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`- Organizations: ${orgResults.filter(r => r.success).length} created/updated`);
    console.log(`- Roles: ${roleResults.filter(r => r.success).length} created/updated`);
    console.log(`- Permissions: ${permResults.filter(r => r.success).length} created/updated`);
    console.log(`- Permission assignments: ${permAssignResults.filter(r => r.success).length} created/updated`);
    console.log(`- Users: ${userResults.filter(r => r.success).length} created/updated`);
    console.log(`- Attendee Types: ${attendeeTypes?.length || 0} created/updated`);
    console.log(`- Events: ${events?.length || 0} created/updated`);
    console.log(`- Attendees: ${attendees?.length || 0} created/updated`);
    console.log(`- Registrations: ${registrationsCount || 0} created`);
    console.log(`- Event Attendee Types: ${eventAttendeeTypes?.length || 0} created/updated`);
    console.log(`- Specific Event Registrations: ${specificEventRegistrations?.registrationsCount || 0} created`);
    console.log('');
    console.log('🔑 Demo credentials:');
    console.log('Super Admin - Email: john.doe@system.com | Password: admin123 | Role: SUPER_ADMIN');
    console.log('Admin - Email: jane.smith@acme.com | Password: admin123 | Role: ADMIN');
    console.log('Manager - Email: bob.johnson@acme.com | Password: manager123 | Role: MANAGER');
    console.log('Viewer - Email: alice.wilson@acme.com | Password: viewer123 | Role: VIEWER');
    console.log('Partner - Email: charlie.brown@acme.com | Password: sales123 | Role: PARTNER');
    console.log('');
    
    // Final result log as requested
    console.log('Seed done:', { 
      email: 'john.doe@system.com', 
      org: systemOrg.name, 
      role: superAdminRole?.name || 'SUPER_ADMIN' 
    });
    
    return {
      success: true,
      summary: {
        organizations: orgResults.filter(r => r.success).length,
        roles: roleResults.filter(r => r.success).length,
        permissions: permResults.filter(r => r.success).length,
        permissionAssignments: permAssignResults.filter(r => r.success).length,
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
