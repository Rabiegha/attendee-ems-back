'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get org from previous seeder or create new one
    let orgId = global.DEMO_ORG_ID;
    if (!orgId) {
      const org = await queryInterface.sequelize.query(
        "SELECT id FROM organizations WHERE slug = 'acme-corp' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );
      orgId = org[0]?.id;
    }

    const orgAdminRoleId = uuidv4();
    const staffRoleId = uuidv4();

    await queryInterface.bulkInsert('roles', [
      {
        id: orgAdminRoleId,
        org_id: orgId,
        code: 'org_admin',
        name: 'Organization Administrator'
      },
      {
        id: staffRoleId,
        org_id: orgId,
        code: 'staff',
        name: 'Staff Member'
      }
    ]);

    // Store role IDs for other seeders
    global.ORG_ADMIN_ROLE_ID = orgAdminRoleId;
    global.STAFF_ROLE_ID = staffRoleId;
    global.DEMO_ORG_ID = orgId;
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', { 
      code: ['org_admin', 'staff'] 
    }, {});
  }
};
