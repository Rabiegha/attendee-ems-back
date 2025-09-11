'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const orgId = uuidv4();
    
    await queryInterface.bulkInsert('organizations', [
      {
        id: orgId,
        name: 'Acme Corp',
        slug: 'acme-corp',
        timezone: 'UTC',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Store orgId for other seeders
    global.DEMO_ORG_ID = orgId;
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('organizations', { slug: 'acme-corp' }, {});
  }
};
