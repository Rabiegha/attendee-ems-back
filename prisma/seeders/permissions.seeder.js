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
exports.rolePermissionMapping = void 0;
exports.seedPermissions = seedPermissions;
exports.getPermissionByCodeAndScope = getPermissionByCodeAndScope;
exports.getPermissionsByCode = getPermissionsByCode;
exports.getAllPermissions = getAllPermissions;
exports.assignAllRolePermissions = assignAllRolePermissions;
exports.assignPermissionsToRole = assignPermissionsToRole;
var utils_1 = require("./utils");
/**
 * Liste complète des permissions du système EMS
 * Organisées par catégorie pour faciliter la maintenance
 */
var permissionsData = [
    // ==================== ORGANIZATIONS ====================
    // Phase 4: Organizations avec scopes explicites
    {
        code: 'organizations.read',
        scope: 'any',
        name: 'Read all organizations (cross-tenant)',
        description: 'View all organizations (SUPER_ADMIN)'
    },
    {
        code: 'organizations.read',
        scope: 'org',
        name: 'Read own organization',
        description: 'View own organization information'
    },
    {
        code: 'organizations.create',
        scope: 'any',
        name: 'Create organization',
        description: 'Create new organizations (SUPER_ADMIN only)'
    },
    {
        code: 'organizations.update',
        scope: 'any',
        name: 'Update organizations (cross-tenant)',
        description: 'Update any organization settings (SUPER_ADMIN)'
    },
    {
        code: 'organizations.update',
        scope: 'org',
        name: 'Update organization',
        description: 'Update own organization settings'
    },
    // ==================== USERS ====================
    // Phase 4: Users avec scopes explicites
    {
        code: 'users.read',
        scope: 'any',
        name: 'Read all users (cross-tenant)',
        description: 'View users across all organizations (SUPER_ADMIN)'
    },
    {
        code: 'users.read',
        scope: 'org',
        name: 'Read users',
        description: 'View users in own organization'
    },
    {
        code: 'users.read',
        scope: 'own',
        name: 'Read own profile',
        description: 'View only own user profile'
    },
    {
        code: 'users.create',
        scope: 'any',
        name: 'Create users (cross-tenant)',
        description: 'Create users in any organization (SUPER_ADMIN)'
    },
    {
        code: 'users.create',
        scope: 'org',
        name: 'Create users',
        description: 'Create new users in organization'
    },
    {
        code: 'users.update',
        scope: 'any',
        name: 'Update users (cross-tenant)',
        description: 'Update users in any organization (SUPER_ADMIN)'
    },
    {
        code: 'users.update',
        scope: 'org',
        name: 'Update users',
        description: 'Update user information in organization'
    },
    {
        code: 'users.delete',
        scope: 'any',
        name: 'Delete users (cross-tenant)',
        description: 'Delete users from any organization (SUPER_ADMIN)'
    },
    {
        code: 'users.delete',
        scope: 'org',
        name: 'Delete users',
        description: 'Delete users from organization'
    },
    // ==================== EVENTS ====================
    // Phase 1: Events avec scopes explicites (code SANS scope, scope séparé)
    {
        code: 'events.read',
        scope: 'any',
        name: 'Read all events (cross-tenant)',
        description: 'View all events across all organizations (SUPER_ADMIN)'
    },
    {
        code: 'events.read',
        scope: 'org',
        name: 'Read organization events',
        description: 'View all events in own organization (ADMIN, MANAGER, VIEWER)'
    },
    {
        code: 'events.read',
        scope: 'assigned',
        name: 'Read assigned events',
        description: 'View only events assigned via EventAccess (PARTNER, HOSTESS)'
    },
    {
        code: 'events.create',
        scope: 'any',
        name: 'Create events (cross-tenant)',
        description: 'Create events in any organization (SUPER_ADMIN)'
    },
    {
        code: 'events.create',
        scope: 'org',
        name: 'Create events',
        description: 'Create new events in organization'
    },
    {
        code: 'events.update',
        scope: 'any',
        name: 'Update events (cross-tenant)',
        description: 'Update events in any organization (SUPER_ADMIN)'
    },
    {
        code: 'events.update',
        scope: 'org',
        name: 'Update events',
        description: 'Update event information in organization'
    },
    {
        code: 'events.delete',
        scope: 'any',
        name: 'Delete events (cross-tenant)',
        description: 'Delete events in any organization (SUPER_ADMIN)'
    },
    {
        code: 'events.delete',
        scope: 'org',
        name: 'Delete events',
        description: 'Delete events in organization'
    },
    {
        code: 'events.publish',
        scope: 'any',
        name: 'Publish events (cross-tenant)',
        description: 'Publish events in any organization (SUPER_ADMIN)'
    },
    {
        code: 'events.publish',
        scope: 'org',
        name: 'Publish events',
        description: 'Publish events and make them public'
    },
    // ==================== ATTENDEES ====================
    // Phase 2: Attendees avec scopes explicites (code SANS scope, scope séparé)
    {
        code: 'attendees.read',
        scope: 'any',
        name: 'Read all attendees (cross-tenant)',
        description: 'View all attendees across all organizations (SUPER_ADMIN)'
    },
    {
        code: 'attendees.read',
        scope: 'org',
        name: 'Read organization attendees',
        description: 'View all attendees in own organization'
    },
    {
        code: 'attendees.create',
        scope: 'any',
        name: 'Create attendees (cross-tenant)',
        description: 'Create attendees in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.create',
        scope: 'org',
        name: 'Create attendees',
        description: 'Add new attendees in organization'
    },
    {
        code: 'attendees.update',
        scope: 'any',
        name: 'Update attendees (cross-tenant)',
        description: 'Update attendees in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.update',
        scope: 'org',
        name: 'Update attendees',
        description: 'Update attendee information in organization'
    },
    {
        code: 'attendees.delete',
        scope: 'any',
        name: 'Delete attendees (cross-tenant)',
        description: 'Delete attendees in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.delete',
        scope: 'org',
        name: 'Delete attendees',
        description: 'Delete attendees in organization'
    },
    {
        code: 'attendees.restore',
        scope: 'any',
        name: 'Restore attendees (cross-tenant)',
        description: 'Restore soft-deleted attendees in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.restore',
        scope: 'org',
        name: 'Restore attendees',
        description: 'Restore soft-deleted attendees in organization'
    },
    {
        code: 'attendees.permanent-delete',
        scope: 'any',
        name: 'Permanently delete attendees (cross-tenant)',
        description: 'Permanently delete attendees and all relations in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.permanent-delete',
        scope: 'org',
        name: 'Permanently delete attendees',
        description: 'Permanently delete attendees and all relations in organization'
    },
    {
        code: 'attendees.checkin',
        scope: 'any',
        name: 'Check-in attendees (cross-tenant)',
        description: 'Check-in attendees in any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.checkin',
        scope: 'org',
        name: 'Check-in attendees',
        description: 'Perform check-in for attendees at events'
    },
    {
        code: 'attendees.export',
        scope: 'any',
        name: 'Export attendees (cross-tenant)',
        description: 'Export attendees from any organization (SUPER_ADMIN)'
    },
    {
        code: 'attendees.export',
        scope: 'org',
        name: 'Export attendees',
        description: 'Export attendee data from organization'
    },
    // ==================== REGISTRATIONS ====================
    // Phase 3: Registrations avec scopes explicites (code SANS scope, scope séparé)
    {
        code: 'registrations.read',
        scope: 'any',
        name: 'Read all registrations (cross-tenant)',
        description: 'View registrations across all organizations (SUPER_ADMIN)'
    },
    {
        code: 'registrations.read',
        scope: 'org',
        name: 'Read organization registrations',
        description: 'View registrations in own organization'
    },
    {
        code: 'registrations.create',
        scope: 'any',
        name: 'Create registrations (cross-tenant)',
        description: 'Create registrations in any organization (SUPER_ADMIN)'
    },
    {
        code: 'registrations.create',
        scope: 'org',
        name: 'Create registrations',
        description: 'Create new event registrations in organization'
    },
    {
        code: 'registrations.update',
        scope: 'any',
        name: 'Update registrations (cross-tenant)',
        description: 'Update registrations in any organization (SUPER_ADMIN)'
    },
    {
        code: 'registrations.update',
        scope: 'org',
        name: 'Update registrations',
        description: 'Update registration status and information in organization'
    },
    {
        code: 'registrations.delete',
        scope: 'any',
        name: 'Delete registrations (cross-tenant)',
        description: 'Delete registrations in any organization (SUPER_ADMIN)'
    },
    {
        code: 'registrations.delete',
        scope: 'org',
        name: 'Delete registrations',
        description: 'Delete event registrations in organization'
    },
    {
        code: 'registrations.import',
        scope: 'any',
        name: 'Import registrations (cross-tenant)',
        description: 'Bulk import registrations in any organization (SUPER_ADMIN)'
    },
    {
        code: 'registrations.import',
        scope: 'org',
        name: 'Import registrations',
        description: 'Bulk import registrations from files in organization'
    },
    // ==================== BADGE TEMPLATES ====================
    // Templates de badges pour génération PDF
    {
        code: 'badge-templates.read',
        scope: 'any',
        name: 'Read all badge templates (cross-tenant)',
        description: 'View badge templates across all organizations (SUPER_ADMIN)'
    },
    {
        code: 'badge-templates.read',
        scope: 'org',
        name: 'Read badge templates',
        description: 'View badge templates in own organization (ADMIN only)'
    },
    {
        code: 'badge-templates.create',
        scope: 'any',
        name: 'Create badge templates (cross-tenant)',
        description: 'Create badge templates in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badge-templates.create',
        scope: 'org',
        name: 'Create badge templates',
        description: 'Create new badge templates in organization (ADMIN only)'
    },
    {
        code: 'badge-templates.update',
        scope: 'any',
        name: 'Update badge templates (cross-tenant)',
        description: 'Update badge templates in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badge-templates.update',
        scope: 'org',
        name: 'Update badge templates',
        description: 'Update badge templates in organization (ADMIN only)'
    },
    {
        code: 'badge-templates.delete',
        scope: 'any',
        name: 'Delete badge templates (cross-tenant)',
        description: 'Delete badge templates in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badge-templates.delete',
        scope: 'org',
        name: 'Delete badge templates',
        description: 'Delete badge templates in organization (ADMIN only)'
    },
    // ==================== BADGES ====================
    {
        code: 'badges.read',
        scope: 'any',
        name: 'Read badges (cross-tenant)',
        description: 'View badges in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badges.read',
        scope: 'org',
        name: 'Read badges',
        description: 'View badges in organization'
    },
    {
        code: 'badges.create',
        scope: 'any',
        name: 'Create badges (cross-tenant)',
        description: 'Generate badges in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badges.create',
        scope: 'org',
        name: 'Create badges',
        description: 'Generate badges in organization'
    },
    {
        code: 'badges.update',
        scope: 'any',
        name: 'Update badges (cross-tenant)',
        description: 'Regenerate badges in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badges.update',
        scope: 'org',
        name: 'Update badges',
        description: 'Regenerate badges in organization'
    },
    {
        code: 'badges.delete',
        scope: 'any',
        name: 'Delete badges (cross-tenant)',
        description: 'Delete badges in any organization (SUPER_ADMIN)'
    },
    {
        code: 'badges.delete',
        scope: 'org',
        name: 'Delete badges',
        description: 'Delete badges in organization'
    },
    // ==================== ROLES & PERMISSIONS ====================
    {
        code: 'roles.read',
        scope: 'org',
        name: 'Read roles',
        description: 'View role information'
    },
    {
        code: 'roles.manage',
        scope: 'org',
        name: 'Manage roles & permissions',
        description: 'Access role management page and modify role permissions (ADMIN+ only)'
    },
    {
        code: 'roles.assign',
        scope: 'org',
        name: 'Assign roles',
        description: 'Assign roles to users (ADMIN cannot change own role)'
    },
    // ==================== INVITATIONS ====================
    {
        code: 'invitations.create',
        scope: 'none',
        name: 'Send invitations',
        description: 'Invite new users to organization'
    },
    {
        code: 'invitations.read',
        scope: 'none',
        name: 'Read invitations',
        description: 'View pending invitations'
    },
    {
        code: 'invitations.cancel',
        scope: 'none',
        name: 'Cancel invitations',
        description: 'Cancel pending invitations'
    },
    // ==================== ANALYTICS & REPORTS ====================
    {
        code: 'analytics.view',
        scope: 'none',
        name: 'View analytics',
        description: 'Access analytics and reports'
    },
    {
        code: 'reports.export',
        scope: 'none',
        name: 'Export reports',
        description: 'Export reports and data'
    },
];
function seedPermissions() {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, permissionsData_1, permData, permission, error_1, errorResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    _i = 0, permissionsData_1 = permissionsData;
                    _a.label = 2;
                case 2:
                    if (!(_i < permissionsData_1.length)) return [3 /*break*/, 5];
                    permData = permissionsData_1[_i];
                    return [4 /*yield*/, utils_1.prisma.permission.upsert({
                            where: {
                                code_scope: {
                                    code: permData.code,
                                    scope: permData.scope,
                                }
                            },
                            update: {
                                name: permData.name,
                                description: permData.description,
                            },
                            create: {
                                code: permData.code,
                                scope: permData.scope,
                                name: permData.name,
                                description: permData.description,
                            },
                        })];
                case 3:
                    permission = _a.sent();
                    results.push({
                        success: true,
                        message: "Permission '".concat(permission.name, "' created/updated"),
                        data: permission,
                    });
                    (0, utils_1.logSuccess)("Upserted permission: ".concat(permission.name));
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, results];
                case 6:
                    error_1 = _a.sent();
                    errorResult = {
                        success: false,
                        message: 'Failed to seed permissions',
                    };
                    (0, utils_1.logError)('Failed to seed permissions', error_1);
                    results.push(errorResult);
                    return [2 /*return*/, results];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Fonction pour obtenir une permission par code et scope
function getPermissionByCodeAndScope(code, scope) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.permission.findUnique({
                        where: {
                            code_scope: {
                                code: code,
                                scope: scope,
                            },
                        },
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Fonction pour obtenir toutes les permissions d'un code (tous scopes)
function getPermissionsByCode(code) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.permission.findMany({
                        where: {
                            code: code,
                        },
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Fonction pour obtenir toutes les permissions
function getAllPermissions() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.permission.findMany()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/**
 * Mapping des permissions par rôle
 *
 * RÈGLES:
 * - SUPER_ADMIN: Développeurs uniquement, accès cross-tenant, TOUTES les permissions
 * - ADMIN: Toutes les permissions dans son organisation, SAUF ne peut pas modifier son propre rôle
 * - MANAGER: Gestion événements et participants, PAS de gestion des rôles/permissions
 * - VIEWER: Lecture seule
 * - PARTNER: Événements assignés uniquement
 * - HOSTESS: Check-in événements assignés uniquement
 */
exports.rolePermissionMapping = {
    // ==================== SUPER_ADMIN ====================
    // Accès total système, toutes organisations
    'SUPER_ADMIN': [
        // Organizations - SUPER_ADMIN a accès cross-tenant COMPLET
        'organizations.read:any',
        'organizations.create:any',
        'organizations.update:any',
        // Users - SUPER_ADMIN a accès cross-tenant COMPLET
        'users.read:any',
        'users.create:any',
        'users.update:any',
        'users.delete:any',
        // Events - SUPER_ADMIN a accès cross-tenant COMPLET (toutes actions, toutes orgs)
        'events.read:any',
        'events.create:any',
        'events.update:any',
        'events.delete:any',
        'events.publish:any',
        // Attendees - SUPER_ADMIN a accès cross-tenant COMPLET
        'attendees.read:any',
        'attendees.create:any',
        'attendees.update:any',
        'attendees.delete:any',
        'attendees.restore:any',
        'attendees.permanent-delete:any',
        'attendees.checkin:any',
        'attendees.export:any',
        // Registrations - SUPER_ADMIN a accès cross-tenant COMPLET
        'registrations.read:any',
        'registrations.create:any',
        'registrations.update:any',
        'registrations.import:any',
        // Roles
        'roles.read',
        'roles.manage', // Accès à la page de gestion des permissions
        'roles.assign', // Peut modifier TOUS les rôles (y compris ADMIN)
        // Invitations
        'invitations.create',
        'invitations.read',
        'invitations.cancel',
        // Analytics
        'analytics.view',
        'reports.export',
    ],
    // ==================== ADMIN ====================
    // Toutes permissions dans l'organisation, SAUF modification propre rôle
    'ADMIN': [
        // Organizations - ADMIN voit et gère son org
        'organizations.read:org',
        'organizations.update:org',
        // Users - ADMIN gère les users de son org
        'users.read:org',
        'users.create:org',
        'users.update:org',
        'users.delete:org',
        // Events - ADMIN voit toute son org
        'events.read:org',
        'events.create:org',
        'events.update:org',
        'events.delete:org',
        'events.publish:org',
        // Attendees - ADMIN voit toute son org
        'attendees.read:org',
        'attendees.create:org',
        'attendees.update:org',
        'attendees.delete:org',
        'attendees.restore:org',
        'attendees.permanent-delete:org',
        'attendees.checkin:org',
        'attendees.export:org',
        // Registrations - ADMIN voit toute son org
        'registrations.read:org',
        'registrations.create:org',
        'registrations.update:org',
        'registrations.import:org',
        // Badge Templates - ADMIN only
        'badge-templates.read:org',
        'badge-templates.create:org',
        'badge-templates.update:org',
        'badge-templates.delete:org',
        // Badges - ADMIN only
        'badges.read:org',
        'badges.create:org',
        'badges.update:org',
        'badges.delete:org',
        // Roles
        'roles.read',
        'roles.manage', // Accès à la page de gestion des permissions
        'roles.assign', // Peut assigner rôles SAUF son propre rôle (guard côté backend)
        // Invitations (lié à users.create - création d'user passe par invitation)
        'invitations.create', // Obligatoire pour users.create (logique métier)
        'invitations.read',
        'invitations.cancel',
        // Analytics
        'analytics.view',
        'reports.export',
    ],
    // ==================== MANAGER ====================
    // Opérationnel : peut créer/modifier mais PAS supprimer
    'MANAGER': [
        // Organizations - MANAGER voit son org
        'organizations.read:org',
        // Users - MANAGER peut créer et modifier users
        'users.read:org',
        'users.create:org',
        'users.update:org',
        // Events - MANAGER voit toute son org, peut créer/modifier
        'events.read:org',
        'events.create:org',
        'events.update:org',
        'events.publish:org',
        // Attendees - MANAGER peut lire, créer et check-in
        'attendees.read:org',
        'attendees.create:org',
        'attendees.checkin:org',
        'attendees.export:org',
        // Registrations - MANAGER peut lire, créer et importer
        'registrations.read:org',
        'registrations.create:org',
        'registrations.import:org',
        // Badges - MANAGER peut gérer les badges
        'badges.read:org',
        'badges.create:org',
        'badges.update:org',
        'badges.delete:org',
        // Roles - Peut voir et assigner des rôles (≤ MANAGER seulement, guard backend)
        'roles.read',
        'roles.assign',
        // Invitations (lié à users.create - création d'user passe par invitation)
        'invitations.create', // Obligatoire pour users.create (logique métier)
        'invitations.read',
        // Analytics
        'analytics.view',
        'reports.export',
    ],
    // ==================== VIEWER ====================
    // Lecture seule complète : voit tout, ne fait rien
    'VIEWER': [
        // Organizations - VIEWER voit son org
        'organizations.read:org',
        // Users - VIEWER voit uniquement son propre profil
        'users.read:own',
        // Events - VIEWER voit toute son org
        'events.read:org',
        // Attendees - VIEWER voit toute son org
        'attendees.read:org',
        // Roles - Voir les rôles
        'roles.read',
        // Invitations - Voir les invitations
        'invitations.read',
        // Analytics
        'analytics.view',
        'reports.export',
    ],
    // ==================== PARTNER ====================
    // Événements assignés uniquement + Analytics de ses events
    'PARTNER': [
        // Users - PARTNER voit uniquement son propre profil
        'users.read:own',
        // Events - PARTNER voit uniquement les events assignés
        'events.read:assigned',
        // Attendees - PARTNER voit toute l'org
        'attendees.read:org',
        // Registrations - PARTNER peut lire les registrations de l'org
        'registrations.read:org',
        // Analytics de ses événements
        'analytics.view',
    ],
    // ==================== HOSTESS ====================
    // Check-in pour événements assignés uniquement
    'HOSTESS': [
        // Users - HOSTESS voit uniquement son propre profil
        'users.read:own',
        // Events - HOSTESS voit uniquement les events assignés
        'events.read:assigned',
        // Attendees - HOSTESS peut lire et check-in
        'attendees.read:org',
        'attendees.checkin:org',
        // Registrations - HOSTESS peut lire uniquement
        'registrations.read:org',
    ],
};
// Fonction pour assigner toutes les permissions selon le mapping des rôles
// IMPORTANT: Cette fonction assigne les permissions à TOUS les rôles (templates + org-specific)
function assignAllRolePermissions() {
    return __awaiter(this, void 0, void 0, function () {
        var results, allRoles, _i, allRoles_1, role, permissionCodes, roleResults, roleType, error_2, errorResult;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    results = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, utils_1.prisma.role.findMany({
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                org_id: true,
                                is_system_role: true,
                            }
                        })];
                case 2:
                    allRoles = _b.sent();
                    (0, utils_1.logSuccess)("\n\uD83D\uDCCB Found ".concat(allRoles.length, " total roles to assign permissions to"));
                    (0, utils_1.logSuccess)("  - System templates: ".concat(allRoles.filter(function (r) { return r.is_system_role; }).length));
                    (0, utils_1.logSuccess)("  - Org-specific roles: ".concat(allRoles.filter(function (r) { return !r.is_system_role; }).length));
                    _i = 0, allRoles_1 = allRoles;
                    _b.label = 3;
                case 3:
                    if (!(_i < allRoles_1.length)) return [3 /*break*/, 6];
                    role = allRoles_1[_i];
                    permissionCodes = exports.rolePermissionMapping[role.code];
                    if (!permissionCodes) {
                        results.push({
                            success: false,
                            message: "No permission mapping found for role code '".concat(role.code, "'"),
                        });
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, assignPermissionsToRole(role.id, permissionCodes)];
                case 4:
                    roleResults = _b.sent();
                    results.push.apply(results, roleResults);
                    roleType = role.is_system_role ? '(system template)' : "(org: ".concat((_a = role.org_id) === null || _a === void 0 ? void 0 : _a.substring(0, 8), "...)");
                    (0, utils_1.logSuccess)("\u2713 Assigned ".concat(permissionCodes.length, " permissions to '").concat(role.name, "' ").concat(roleType));
                    _b.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    (0, utils_1.logSuccess)("\n\u2705 Total permission assignments: ".concat(results.filter(function (r) { return r.success; }).length));
                    return [2 /*return*/, results];
                case 7:
                    error_2 = _b.sent();
                    errorResult = {
                        success: false,
                        message: 'Failed to assign role permissions',
                    };
                    (0, utils_1.logError)('Failed to assign role permissions', error_2);
                    results.push(errorResult);
                    return [2 /*return*/, results];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// Fonction pour assigner des permissions à un rôle
// Gère le format legacy "code:scope" et le nouveau format avec scope séparé
function assignPermissionsToRole(roleId, permissionCodes) {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, permissionCodes_1, permissionCode, code, scope, parts, scopePart, permission, rolePermission, error_3, errorResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    _i = 0, permissionCodes_1 = permissionCodes;
                    _a.label = 2;
                case 2:
                    if (!(_i < permissionCodes_1.length)) return [3 /*break*/, 6];
                    permissionCode = permissionCodes_1[_i];
                    code = void 0;
                    scope = 'none';
                    if (permissionCode.includes(':')) {
                        parts = permissionCode.split(':');
                        code = parts[0];
                        scopePart = parts[1];
                        // Mapper les scopes
                        if (scopePart === 'any')
                            scope = 'any';
                        else if (scopePart === 'org')
                            scope = 'org';
                        else if (scopePart === 'assigned')
                            scope = 'assigned';
                        else if (scopePart === 'own')
                            scope = 'own';
                        else
                            scope = 'none';
                    }
                    else {
                        code = permissionCode;
                        scope = 'none';
                    }
                    return [4 /*yield*/, getPermissionByCodeAndScope(code, scope)];
                case 3:
                    permission = _a.sent();
                    if (!permission) {
                        results.push({
                            success: false,
                            message: "Permission '".concat(permissionCode, "' (code: ").concat(code, ", scope: ").concat(scope, ") not found"),
                        });
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, utils_1.prisma.rolePermission.upsert({
                            where: {
                                role_id_permission_id: {
                                    role_id: roleId,
                                    permission_id: permission.id,
                                }
                            },
                            update: {},
                            create: {
                                role_id: roleId,
                                permission_id: permission.id,
                            },
                        })];
                case 4:
                    rolePermission = _a.sent();
                    results.push({
                        success: true,
                        message: "Permission '".concat(permission.name, "' assigned to role"),
                    });
                    (0, utils_1.logSuccess)("Upserted permission assignment '".concat(permission.name, "' to role"));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/, results];
                case 7:
                    error_3 = _a.sent();
                    errorResult = {
                        success: false,
                        message: 'Failed to assign permissions to role',
                    };
                    (0, utils_1.logError)('Failed to assign permissions to role', error_3);
                    results.push(errorResult);
                    return [2 /*return*/, results];
                case 8: return [2 /*return*/];
            }
        });
    });
}
