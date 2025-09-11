const path = require('path');

// Load environment variables
// Use .env.development for local development, .env.docker for Docker
const envFile = process.env.DOTENV_PATH || 
  (process.env.NODE_ENV === 'development' ? 
    path.resolve(__dirname, '../../.env.development') : 
    path.resolve(__dirname, '../../.env.docker'));

require('dotenv').config({ path: envFile });

const config = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    migrationStorageTableName: 'sequelize_meta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'sequelize_data',
    dialectOptions: {
      ssl: false
    }
  },
  test: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ems_test',
    dialect: 'postgres',
    migrationStorageTableName: 'sequelize_meta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'sequelize_data',
    logging: false,
    dialectOptions: {
      ssl: false
    }
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    migrationStorageTableName: 'sequelize_meta',
    seederStorage: 'sequelize',
    seederStorageTableName: 'sequelize_data',
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  },
};

module.exports = config;
