'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get org from previous seeder
    let orgId = global.DEMO_ORG_ID;
    if (!orgId) {
      const org = await queryInterface.sequelize.query(
        "SELECT id FROM organizations WHERE slug = 'acme-corp' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );
      orgId = org[0]?.id;
    }

    const permissions = [
      { code: 'users.read', name: 'Read Users' },
      { code: 'users.create', name: 'Create Users' },
      { code: 'users.update', name: 'Update Users' },
      { code: 'users.delete', name: 'Delete Users' },
      { code: 'organizations.read', name: 'Read Organizations' },
      { code: 'organizations.update', name: 'Update Organizations' },
      { code: 'roles.read', name: 'Read Roles' },
      { code: 'permissions.read', name: 'Read Permissions' }
    ];

    const permissionRecords = permissions.map(permission => ({
      id: uuidv4(),
      org_id: orgId,
      code: permission.code,
      name: permission.name
    }));

    await queryInterface.bulkInsert('permissions', permissionRecords);

    // Store permission IDs for role-permissions seeder
    global.DEMO_PERMISSIONS = permissionRecords;
    global.DEMO_ORG_ID = orgId;
  },

  async down(queryInterface, Sequelize) {
    const permissionCodes = [
      'users.read', 'users.create', 'users.update', 'users.delete',
      'organizations.read', 'organizations.update', 'roles.read', 'permissions.read'
    ];
    
    await queryInterface.bulkDelete('permissions', { 
      code: permissionCodes 
    }, {});
  }
};
