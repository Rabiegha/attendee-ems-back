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
exports.seedRoles = seedRoles;
exports.getRoleByCode = getRoleByCode;
exports.getRoleByOrgAndCode = getRoleByOrgAndCode;
exports.getAllRoles = getAllRoles;
var utils_1 = require("./utils");
// Simple console log helpers si logInfo n'existe pas dans utils
var logInfo = function (message) { return console.log(message); };
/**
 * Rôles système (templates) - servent de base pour créer les rôles des organisations
 * org_id = NULL pour indiquer que ce sont des templates
 *
 * Hiérarchie des rôles (level):
 * - 0: SUPER_ADMIN (accès global, réservé aux développeurs)
 * - 1: ADMIN (gestion complète de l'organisation)
 * - 2: MANAGER (gestion des événements et participants)
 * - 3: PARTNER (accès aux événements assignés)
 * - 4: VIEWER (lecture seule)
 * - 5: HOSTESS (check-in uniquement)
 *
 * Règle: Un utilisateur ne peut créer/modifier que des rôles de niveau égal ou supérieur au sien
 *
 * Chaque organisation peut ensuite:
 * 1. Utiliser ces templates pour créer ses propres rôles
 * 2. Personnaliser les permissions de chaque rôle
 * 3. Créer des rôles complètement personnalisés
 *
 * Exemple: Un "MANAGER" dans l'org X peut avoir des permissions différentes
 *          du "MANAGER" dans l'org Y
 */
var systemRolesTemplates = [
    {
        code: 'SUPER_ADMIN',
        name: 'Super Administrator',
        description: 'System role - Full access across all organizations. Reserved for developers.',
        level: 0,
        is_system_role: true,
    },
    {
        code: 'ADMIN',
        name: 'Administrator',
        description: 'Full management of organization',
        level: 1,
        is_system_role: true,
    },
    {
        code: 'MANAGER',
        name: 'Manager',
        description: 'Event and attendee management',
        level: 2,
        is_system_role: true,
    },
    {
        code: 'PARTNER',
        name: 'Partner',
        description: 'Access to assigned events only',
        level: 3,
        is_system_role: true,
    },
    {
        code: 'VIEWER',
        name: 'Viewer',
        description: 'Read-only access',
        level: 4,
        is_system_role: true,
    },
    {
        code: 'HOSTESS',
        name: 'Hostess',
        description: 'Check-in for assigned events',
        level: 5,
        is_system_role: true,
    },
];
/**
 * Crée les rôles système (templates globaux)
 * Ces rôles ont org_id = NULL et is_system_role = true
 */
function seedSystemRoleTemplates() {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, systemRolesTemplates_1, roleData, existingRole, role;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    _i = 0, systemRolesTemplates_1 = systemRolesTemplates;
                    _a.label = 1;
                case 1:
                    if (!(_i < systemRolesTemplates_1.length)) return [3 /*break*/, 8];
                    roleData = systemRolesTemplates_1[_i];
                    return [4 /*yield*/, utils_1.prisma.role.findFirst({
                            where: {
                                code: roleData.code,
                                org_id: null,
                            }
                        })];
                case 2:
                    existingRole = _a.sent();
                    role = void 0;
                    if (!existingRole) return [3 /*break*/, 4];
                    return [4 /*yield*/, utils_1.prisma.role.update({
                            where: { id: existingRole.id },
                            data: {
                                name: roleData.name,
                                description: roleData.description,
                                level: roleData.level,
                                is_system_role: roleData.is_system_role,
                            },
                        })];
                case 3:
                    // Mise à jour
                    role = _a.sent();
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, utils_1.prisma.role.create({
                        data: {
                            code: roleData.code,
                            name: roleData.name,
                            description: roleData.description,
                            level: roleData.level,
                            is_system_role: roleData.is_system_role,
                            org_id: null,
                        },
                    })];
                case 5:
                    // Création
                    role = _a.sent();
                    _a.label = 6;
                case 6:
                    results.push({
                        success: true,
                        message: "System role template '".concat(role.name, "' created/updated"),
                        data: role,
                    });
                    (0, utils_1.logSuccess)("\u2713 System role template: ".concat(role.name, " (").concat(role.code, ")"));
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * Clone les templates de rôles système pour une organisation spécifique
 * Chaque organisation obtient une copie personnalisable de tous les rôles (sauf SUPER_ADMIN)
 */
function seedOrganizationRoles(orgId) {
    return __awaiter(this, void 0, void 0, function () {
        var results, roleTemplatesToClone, _i, roleTemplatesToClone_1, roleTemplate, existingRole, orgRole;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    roleTemplatesToClone = systemRolesTemplates.filter(function (r) { return r.code !== 'SUPER_ADMIN'; });
                    _i = 0, roleTemplatesToClone_1 = roleTemplatesToClone;
                    _a.label = 1;
                case 1:
                    if (!(_i < roleTemplatesToClone_1.length)) return [3 /*break*/, 8];
                    roleTemplate = roleTemplatesToClone_1[_i];
                    return [4 /*yield*/, utils_1.prisma.role.findFirst({
                            where: {
                                code: roleTemplate.code,
                                org_id: orgId,
                            }
                        })];
                case 2:
                    existingRole = _a.sent();
                    orgRole = void 0;
                    if (!existingRole) return [3 /*break*/, 4];
                    return [4 /*yield*/, utils_1.prisma.role.update({
                            where: { id: existingRole.id },
                            data: {
                                name: roleTemplate.name,
                                description: roleTemplate.description,
                                level: roleTemplate.level,
                                is_system_role: false,
                            },
                        })];
                case 3:
                    // Mise à jour
                    orgRole = _a.sent();
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, utils_1.prisma.role.create({
                        data: {
                            code: roleTemplate.code,
                            name: roleTemplate.name,
                            description: roleTemplate.description,
                            level: roleTemplate.level,
                            is_system_role: false,
                            org_id: orgId,
                        },
                    })];
                case 5:
                    // Création
                    orgRole = _a.sent();
                    _a.label = 6;
                case 6:
                    results.push({
                        success: true,
                        message: "Organization role '".concat(orgRole.name, "' created/updated for org ").concat(orgId),
                        data: orgRole,
                    });
                    (0, utils_1.logSuccess)("  \u21B3 Org role: ".concat(orgRole.name, " (").concat(orgRole.code, ")"));
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/, results];
            }
        });
    });
}
function seedRoles() {
    return __awaiter(this, void 0, void 0, function () {
        var results, systemRolesResults, organizations, _i, organizations_1, org, orgRolesResults, error_1, errorResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    // Étape 1: Créer les templates système
                    logInfo('\n📋 Creating system role templates...');
                    return [4 /*yield*/, seedSystemRoleTemplates()];
                case 2:
                    systemRolesResults = _a.sent();
                    results.push.apply(results, systemRolesResults);
                    return [4 /*yield*/, utils_1.prisma.organization.findMany({
                            select: { id: true, name: true },
                        })];
                case 3:
                    organizations = _a.sent();
                    logInfo("\n\uD83C\uDFE2 Creating organization-specific roles for ".concat(organizations.length, " organizations..."));
                    _i = 0, organizations_1 = organizations;
                    _a.label = 4;
                case 4:
                    if (!(_i < organizations_1.length)) return [3 /*break*/, 7];
                    org = organizations_1[_i];
                    logInfo("\n  Organization: ".concat(org.name));
                    return [4 /*yield*/, seedOrganizationRoles(org.id)];
                case 5:
                    orgRolesResults = _a.sent();
                    results.push.apply(results, orgRolesResults);
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    (0, utils_1.logSuccess)("\n\u2705 Total roles created: ".concat(results.length));
                    return [2 /*return*/, results];
                case 8:
                    error_1 = _a.sent();
                    errorResult = {
                        success: false,
                        message: 'Failed to seed roles',
                    };
                    (0, utils_1.logError)('Failed to seed roles', error_1);
                    results.push(errorResult);
                    return [2 /*return*/, results];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// Fonction pour obtenir un rôle par code (system template uniquement - org_id = NULL)
function getRoleByCode(code) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.role.findFirst({
                        where: {
                            code: code,
                            org_id: null,
                        },
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Fonction pour obtenir un rôle d'une organisation spécifique
function getRoleByOrgAndCode(orgId, code) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.role.findFirst({
                        where: {
                            code: code,
                            org_id: orgId,
                        },
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Fonction pour obtenir tous les rôles
function getAllRoles() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.role.findMany()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
