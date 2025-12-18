"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllSeeders = runAllSeeders;
var utils_1 = require("./utils");
var organizations_seeder_1 = require("./organizations.seeder");
var roles_seeder_1 = require("./roles.seeder");
var permissions_seeder_1 = require("./permissions.seeder");
var users_seeder_1 = require("./users.seeder");
var events_seeder_1 = require("./events.seeder");
var badge_templates_seeder_1 = require("./badge-templates.seeder");
var attendees_seeder_1 = require("./attendees.seeder");
var attendee_types_seeder_1 = require("./attendee-types.seeder");
var event_attendee_types_seeder_1 = require("./event-attendee-types.seeder");
var registrations_seeder_1 = require("./registrations.seeder");
/**
 * Main seeding function that runs all seeders in the correct order
 * Can be used both as a standalone script and imported by other modules
 */
function runAllSeeders() {
    return __awaiter(this, void 0, void 0, function () {
        var orgResults, failedOrgs, systemOrg, acmeOrg, roleResults, failedRoles, permResults, failedPerms, permAssignResults, failedPermAssignments, userResults, failedUsers, attendeeTypes, events, eventAttendeeTypes, _a, attendees, registrationsCount, specificEventRegistrations, superAdminRole, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🌱 Starting Event Management System seed...');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 16, , 17]);
                    // 1. Seed Organizations
                    (0, utils_1.logInfo)('Seeding organizations...');
                    return [4 /*yield*/, (0, organizations_seeder_1.seedOrganizations)()];
                case 2:
                    orgResults = _b.sent();
                    failedOrgs = orgResults.filter(function (r) { return !r.success; });
                    if (failedOrgs.length > 0) {
                        throw new Error("Failed to seed organizations: ".concat(failedOrgs.map(function (r) { return r.message; }).join(', ')));
                    }
                    return [4 /*yield*/, (0, organizations_seeder_1.getOrganizationBySlug)('system')];
                case 3:
                    systemOrg = _b.sent();
                    return [4 /*yield*/, (0, organizations_seeder_1.getOrganizationBySlug)('acme-corp')];
                case 4:
                    acmeOrg = _b.sent();
                    if (!systemOrg || !acmeOrg) {
                        throw new Error('Required organizations not found after seeding');
                    }
                    // 2. Seed Roles
                    (0, utils_1.logInfo)('Seeding roles...');
                    return [4 /*yield*/, (0, roles_seeder_1.seedRoles)()];
                case 5:
                    roleResults = _b.sent();
                    failedRoles = roleResults.filter(function (r) { return !r.success; });
                    if (failedRoles.length > 0) {
                        throw new Error("Failed to seed roles: ".concat(failedRoles.map(function (r) { return r.message; }).join(', ')));
                    }
                    // 3. Seed Permissions
                    (0, utils_1.logInfo)('Seeding permissions...');
                    return [4 /*yield*/, (0, permissions_seeder_1.seedPermissions)()];
                case 6:
                    permResults = _b.sent();
                    failedPerms = permResults.filter(function (r) { return !r.success; });
                    if (failedPerms.length > 0) {
                        throw new Error("Failed to seed permissions: ".concat(failedPerms.map(function (r) { return r.message; }).join(', ')));
                    }
                    // 4. Assign permissions to roles according to mapping
                    (0, utils_1.logInfo)('Assigning permissions to roles...');
                    return [4 /*yield*/, (0, permissions_seeder_1.assignAllRolePermissions)()];
                case 7:
                    permAssignResults = _b.sent();
                    failedPermAssignments = permAssignResults.filter(function (r) { return !r.success; });
                    if (failedPermAssignments.length > 0) {
                        (0, utils_1.logError)('Some permission assignments failed', failedPermAssignments.map(function (r) { return r.message; }));
                    }
                    (0, utils_1.logSuccess)('Assigned permissions to roles according to role mapping');
                    // 5. Seed Users
                    (0, utils_1.logInfo)('Seeding users...');
                    return [4 /*yield*/, (0, users_seeder_1.seedUsers)()];
                case 8:
                    userResults = _b.sent();
                    failedUsers = userResults.filter(function (r) { return !r.success; });
                    if (failedUsers.length > 0) {
                        (0, utils_1.logError)('Some users failed to seed', failedUsers.map(function (r) { return r.message; }));
                    }
                    // 6. Seed Attendee Types
                    (0, utils_1.logInfo)('Seeding attendee types...');
                    return [4 /*yield*/, (0, attendee_types_seeder_1.seedAttendeeTypes)()];
                case 9:
                    attendeeTypes = _b.sent();
                    // 7. Seed Events
                    (0, utils_1.logInfo)('Seeding events...');
                    return [4 /*yield*/, (0, events_seeder_1.seedEvents)()];
                case 10:
                    events = _b.sent();
                    // 7.5. Seed Badge Templates
                    (0, utils_1.logInfo)('Seeding badge templates...');
                    return [4 /*yield*/, (0, badge_templates_seeder_1.seedBadgeTemplates)(utils_1.prisma)];
                case 11:
                    _b.sent();
                    // 8. Seed Event Attendee Types (Moved before registrations)
                    (0, utils_1.logInfo)('Seeding event attendee types...');
                    return [4 /*yield*/, (0, event_attendee_types_seeder_1.seedEventAttendeeTypes)()];
                case 12:
                    eventAttendeeTypes = _b.sent();
                    // 9. Seed Attendees and Registrations
                    (0, utils_1.logInfo)('Seeding attendees and registrations...');
                    return [4 /*yield*/, (0, attendees_seeder_1.seedAttendeesAndRegistrations)()];
                case 13:
                    _a = _b.sent(), attendees = _a.attendees, registrationsCount = _a.registrationsCount;
                    // 10. Seed Registrations for specific event
                    (0, utils_1.logInfo)('Seeding registrations for specific event...');
                    return [4 /*yield*/, (0, registrations_seeder_1.seedRegistrationsForEvent)()];
                case 14:
                    specificEventRegistrations = _b.sent();
                    return [4 /*yield*/, (0, roles_seeder_1.getRoleByCode)('SUPER_ADMIN')];
                case 15:
                    superAdminRole = _b.sent();
                    // Summary
                    console.log('');
                    (0, utils_1.logSuccess)('🎉 Event Management System seed completed successfully!');
                    console.log('');
                    console.log('📊 Summary:');
                    console.log("- Organizations: ".concat(orgResults.filter(function (r) { return r.success; }).length, " created/updated"));
                    console.log("- Roles: ".concat(roleResults.filter(function (r) { return r.success; }).length, " created/updated"));
                    console.log("- Permissions: ".concat(permResults.filter(function (r) { return r.success; }).length, " created/updated"));
                    console.log("- Permission assignments: ".concat(permAssignResults.filter(function (r) { return r.success; }).length, " created/updated"));
                    console.log("- Users: ".concat(userResults.filter(function (r) { return r.success; }).length, " created/updated"));
                    console.log("- Attendee Types: ".concat((attendeeTypes === null || attendeeTypes === void 0 ? void 0 : attendeeTypes.length) || 0, " created/updated"));
                    console.log("- Events: ".concat((events === null || events === void 0 ? void 0 : events.length) || 0, " created/updated"));
                    console.log("- Attendees: ".concat((attendees === null || attendees === void 0 ? void 0 : attendees.length) || 0, " created/updated"));
                    console.log("- Registrations: ".concat(registrationsCount || 0, " created"));
                    console.log("- Event Attendee Types: ".concat((eventAttendeeTypes === null || eventAttendeeTypes === void 0 ? void 0 : eventAttendeeTypes.length) || 0, " created/updated"));
                    console.log("- Specific Event Registrations: ".concat((specificEventRegistrations === null || specificEventRegistrations === void 0 ? void 0 : specificEventRegistrations.registrationsCount) || 0, " created"));
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
                        role: (superAdminRole === null || superAdminRole === void 0 ? void 0 : superAdminRole.name) || 'SUPER_ADMIN'
                    });
                    return [2 /*return*/, {
                            success: true,
                            summary: {
                                organizations: orgResults.filter(function (r) { return r.success; }).length,
                                roles: roleResults.filter(function (r) { return r.success; }).length,
                                permissions: permResults.filter(function (r) { return r.success; }).length,
                                permissionAssignments: permAssignResults.filter(function (r) { return r.success; }).length,
                                users: userResults.filter(function (r) { return r.success; }).length
                            }
                        }];
                case 16:
                    error_1 = _b.sent();
                    (0, utils_1.logError)('Seed process failed', error_1);
                    throw error_1;
                case 17: return [2 /*return*/];
            }
        });
    });
}
// Export the function as default for use in other modules
exports.default = runAllSeeders;
// Run the seeder when this file is executed directly
if (require.main === module) {
    runAllSeeders()
        .catch(function (e) {
        (0, utils_1.logError)('❌ Seed failed with unhandled error', e);
        process.exit(1);
    })
        .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, utils_1.disconnectPrisma)()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
}
