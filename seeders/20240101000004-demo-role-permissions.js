'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get data from previous seeders
    let orgId = global.DEMO_ORG_ID;
    let orgAdminRoleId = global.ORG_ADMIN_ROLE_ID;
    let staffRoleId = global.STAFF_ROLE_ID;

    if (!orgId || !orgAdminRoleId || !staffRoleId) {
      // Fallback: query from database
      const org = await queryInterface.sequelize.query(
        "SELECT id FROM organizations WHERE slug = 'acme-corp' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );
      orgId = org[0]?.id;

      const roles = await queryInterface.sequelize.query(
        "SELECT id, code FROM roles WHERE org_id = :orgId",
        { 
          replacements: { orgId },
          type: Sequelize.QueryTypes.SELECT 
        }
      );
      
      orgAdminRoleId = roles.find(r => r.code === 'org_admin')?.id;
      staffRoleId = roles.find(r => r.code === 'staff')?.id;
    }

    // Get all permissions for this org
    const permissions = await queryInterface.sequelize.query(
      "SELECT id, code FROM permissions WHERE org_id = :orgId",
      { 
        replacements: { orgId },
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    const rolePermissions = [];

    // Org admin gets all permissions
    permissions.forEach(permission => {
      rolePermissions.push({
        id: uuidv4(),
        org_id: orgId,
        role_id: orgAdminRoleId,
        permission_id: permission.id
      });
    });

    // Staff gets only read permissions
    const readPermissions = permissions.filter(p => p.code.includes('.read'));
    readPermissions.forEach(permission => {
      rolePermissions.push({
        id: uuidv4(),
        org_id: orgId,
        role_id: staffRoleId,
        permission_id: permission.id
      });
    });

    await queryInterface.bulkInsert('role_permissions', rolePermissions);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('role_permissions', {}, {});
  }
};
