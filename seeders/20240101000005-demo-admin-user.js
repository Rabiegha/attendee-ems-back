'use strict';

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get data from previous seeders
    let orgId = global.DEMO_ORG_ID;
    let orgAdminRoleId = global.ORG_ADMIN_ROLE_ID;

    if (!orgId || !orgAdminRoleId) {
      // Fallback: query from database
      const org = await queryInterface.sequelize.query(
        "SELECT id FROM organizations WHERE slug = 'acme-corp' LIMIT 1",
        { type: Sequelize.QueryTypes.SELECT }
      );
      orgId = org[0]?.id;

      const role = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE org_id = :orgId AND code = 'org_admin' LIMIT 1",
        { 
          replacements: { orgId },
          type: Sequelize.QueryTypes.SELECT 
        }
      );
      orgAdminRoleId = role[0]?.id;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('Admin#12345', 10);

    await queryInterface.bulkInsert('users', [
      {
        id: uuidv4(),
        org_id: orgId,
        email: 'admin@acme.test',
        password_hash: hashedPassword,
        role_id: orgAdminRoleId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { 
      email: 'admin@acme.test' 
    }, {});
  }
};
