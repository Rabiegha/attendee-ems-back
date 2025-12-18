"use strict";
// This file now delegates to the modular seeder system
// All seeding logic has been moved to prisma/seeders/ for better organization
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = __importDefault(require("./seeders/index"));
// Execute the seeder when this file is run
(0, index_1.default)()
    .catch(function (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
});
