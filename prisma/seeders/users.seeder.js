"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.seedUsers = seedUsers;
exports.getUserByEmail = getUserByEmail;
var bcrypt = __importStar(require("bcrypt"));
var utils_1 = require("./utils");
var usersData = [
    {
        email: 'john.doe@system.com',
        password: 'admin123',
        roleCode: 'SUPER_ADMIN',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+33 1 23 45 67 89',
        company: 'System Corp',
        job_title: 'System Administrator',
        country: 'France',
        metadata: {
            preferences: { theme: 'dark', language: 'fr' },
            skills: ['administration', 'security', 'monitoring']
        },
        isActive: true,
    },
    {
        email: 'jane.smith@acme.com',
        password: 'admin123',
        roleCode: 'ADMIN',
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '+33 1 98 76 54 32',
        company: 'ACME Corporation',
        job_title: 'CEO',
        country: 'France',
        metadata: {
            preferences: { theme: 'light', language: 'en' },
            achievements: ['startup_founder', 'tech_leader'],
            social: { linkedin: 'jane-smith-ceo', twitter: '@janesmith' }
        },
        isActive: true,
    },
    {
        email: 'bob.johnson@acme.com',
        password: 'manager123',
        roleCode: 'MANAGER',
        first_name: 'Bob',
        last_name: 'Johnson',
        phone: '+33 1 11 22 33 44',
        company: 'ACME Corporation',
        job_title: 'Marketing Manager',
        country: 'France',
        metadata: {
            preferences: { theme: 'light', language: 'fr' },
            specialties: ['digital_marketing', 'content_strategy', 'analytics'],
            certifications: ['Google Analytics', 'Facebook Blueprint']
        },
        isActive: true,
    },
    {
        email: 'alice.wilson@acme.com',
        password: 'viewer123',
        roleCode: 'VIEWER',
        first_name: 'Alice',
        last_name: 'Wilson',
        phone: '+33 1 55 66 77 88',
        company: 'ACME Corporation',
        job_title: 'Event Coordinator',
        country: 'France',
        metadata: {
            preferences: { theme: 'auto', language: 'fr' },
            experience_years: 5,
            event_types: ['corporate', 'conferences', 'workshops'],
            languages: ['French', 'English', 'Spanish']
        },
        isActive: true,
    },
    {
        email: 'charlie.brown@acme.com',
        password: 'sales123',
        roleCode: 'PARTNER',
        first_name: 'Charlie',
        last_name: 'Brown',
        phone: '+33 1 44 55 66 77',
        company: 'ACME Corporation',
        job_title: 'Sales Representative',
        country: 'France',
        metadata: {
            preferences: { theme: 'light', language: 'en' },
            territory: 'Europe',
            sales_targets: { annual: 500000, quarterly: 125000 },
            performance: { last_quarter: 'exceeded', rating: 4.8 }
        },
        isActive: true,
    },
];
function seedUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var results, systemOrg, acmeOrg, _i, usersData_1, userData, orgId, role, hashedPassword, existingUser, user, error_1, errorResult;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    results = [];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 17, , 18]);
                    return [4 /*yield*/, utils_1.prisma.organization.findUnique({
                            where: { slug: 'system' }
                        })];
                case 2:
                    systemOrg = _c.sent();
                    return [4 /*yield*/, utils_1.prisma.organization.findUnique({
                            where: { slug: 'acme-corp' }
                        })];
                case 3:
                    acmeOrg = _c.sent();
                    if (!systemOrg || !acmeOrg) {
                        throw new Error('Required organizations not found');
                    }
                    _i = 0, usersData_1 = usersData;
                    _c.label = 4;
                case 4:
                    if (!(_i < usersData_1.length)) return [3 /*break*/, 16];
                    userData = usersData_1[_i];
                    orgId = void 0;
                    if (userData.email.includes('@system.com')) {
                        orgId = systemOrg.id;
                    }
                    else {
                        orgId = acmeOrg.id;
                    }
                    role = void 0;
                    if (!(userData.roleCode === 'SUPER_ADMIN')) return [3 /*break*/, 6];
                    return [4 /*yield*/, utils_1.prisma.role.findFirst({
                            where: {
                                code: 'SUPER_ADMIN',
                                org_id: null,
                            }
                        })];
                case 5:
                    role = _c.sent();
                    return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, utils_1.prisma.role.findFirst({
                        where: {
                            code: userData.roleCode,
                            org_id: orgId,
                        }
                    })];
                case 7:
                    role = _c.sent();
                    _c.label = 8;
                case 8:
                    if (!role) {
                        results.push({
                            success: false,
                            message: "Role '".concat(userData.roleCode, "' not found for organization ").concat(orgId, " for user '").concat(userData.email, "'"),
                        });
                        return [3 /*break*/, 15];
                    }
                    return [4 /*yield*/, bcrypt.hash(userData.password, 10)];
                case 9:
                    hashedPassword = _c.sent();
                    return [4 /*yield*/, utils_1.prisma.user.findFirst({
                            where: {
                                email: userData.email,
                                org_id: orgId,
                            }
                        })];
                case 10:
                    existingUser = _c.sent();
                    user = void 0;
                    if (!existingUser) return [3 /*break*/, 12];
                    return [4 /*yield*/, utils_1.prisma.user.update({
                            where: { id: existingUser.id },
                            data: {
                                password_hash: hashedPassword,
                                role_id: role.id,
                                first_name: userData.first_name,
                                last_name: userData.last_name,
                                phone: userData.phone,
                                company: userData.company,
                                job_title: userData.job_title,
                                country: userData.country,
                                metadata: userData.metadata,
                                is_active: (_a = userData.isActive) !== null && _a !== void 0 ? _a : true,
                            },
                        })];
                case 11:
                    user = _c.sent();
                    return [3 /*break*/, 14];
                case 12: return [4 /*yield*/, utils_1.prisma.user.create({
                        data: {
                            org_id: orgId,
                            email: userData.email,
                            password_hash: hashedPassword,
                            role_id: role.id,
                            first_name: userData.first_name,
                            last_name: userData.last_name,
                            phone: userData.phone,
                            company: userData.company,
                            job_title: userData.job_title,
                            country: userData.country,
                            metadata: userData.metadata,
                            is_active: (_b = userData.isActive) !== null && _b !== void 0 ? _b : true,
                        },
                    })];
                case 13:
                    user = _c.sent();
                    _c.label = 14;
                case 14:
                    results.push({
                        success: true,
                        message: "User '".concat(user.email, "' created/updated"),
                        data: __assign(__assign({}, user), { password_hash: '[HIDDEN]' }),
                    });
                    (0, utils_1.logSuccess)("\u2713 User: ".concat(user.email, " in organization: ").concat(orgId === systemOrg.id ? 'System' : 'Acme Corp'));
                    _c.label = 15;
                case 15:
                    _i++;
                    return [3 /*break*/, 4];
                case 16: return [2 /*return*/, results];
                case 17:
                    error_1 = _c.sent();
                    errorResult = {
                        success: false,
                        message: 'Failed to seed users',
                    };
                    (0, utils_1.logError)('Failed to seed users', error_1);
                    results.push(errorResult);
                    return [2 /*return*/, results];
                case 18: return [2 /*return*/];
            }
        });
    });
}
// Fonction pour obtenir un utilisateur par email
function getUserByEmail(organizationId, email) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utils_1.prisma.user.findFirst({
                        where: {
                            org_id: organizationId,
                            email: email,
                        },
                    })];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
