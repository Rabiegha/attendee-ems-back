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
exports.seedAttendeeTypes = seedAttendeeTypes;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function seedAttendeeTypes() {
    return __awaiter(this, void 0, void 0, function () {
        var acmeOrg, attendeeTypesData, createdAttendeeTypes, _i, attendeeTypesData_1, typeData, existing, attendeeType;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('ℹ️  Seeding attendee types...');
                    return [4 /*yield*/, prisma.organization.findFirst({
                            where: { slug: 'acme-corp' },
                        })];
                case 1:
                    acmeOrg = _a.sent();
                    if (!acmeOrg) {
                        console.log(' Organization Acme Corp not found, skipping attendee types seeding');
                        return [2 /*return*/];
                    }
                    attendeeTypesData = [
                        {
                            org_id: acmeOrg.id,
                            code: 'VIP',
                            name: 'VIP',
                            color_hex: '#FFD700',
                            text_color_hex: '#000000',
                            icon: 'star',
                            is_active: true,
                        },
                        {
                            org_id: acmeOrg.id,
                            code: 'SPEAKER',
                            name: 'Conférencier',
                            color_hex: '#9C27B0',
                            text_color_hex: '#FFFFFF',
                            icon: 'microphone',
                            is_active: true,
                        },
                        {
                            org_id: acmeOrg.id,
                            code: 'SPONSOR',
                            name: 'Sponsor',
                            color_hex: '#FF9800',
                            text_color_hex: '#FFFFFF',
                            icon: 'briefcase',
                            is_active: true,
                        },
                        {
                            org_id: acmeOrg.id,
                            code: 'PRESS',
                            name: 'Presse',
                            color_hex: '#2196F3',
                            text_color_hex: '#FFFFFF',
                            icon: 'camera',
                            is_active: true,
                        },
                        {
                            org_id: acmeOrg.id,
                            code: 'PARTICIPANT',
                            name: 'Participant',
                            color_hex: '#4CAF50',
                            text_color_hex: '#FFFFFF',
                            icon: 'user',
                            is_active: true,
                        },
                        {
                            org_id: acmeOrg.id,
                            code: 'STAFF',
                            name: 'Staff',
                            color_hex: '#607D8B',
                            text_color_hex: '#FFFFFF',
                            icon: 'users',
                            is_active: true,
                        },
                    ];
                    createdAttendeeTypes = [];
                    _i = 0, attendeeTypesData_1 = attendeeTypesData;
                    _a.label = 2;
                case 2:
                    if (!(_i < attendeeTypesData_1.length)) return [3 /*break*/, 6];
                    typeData = attendeeTypesData_1[_i];
                    return [4 /*yield*/, prisma.attendeeType.findFirst({
                            where: {
                                org_id: typeData.org_id,
                                code: typeData.code,
                            },
                        })];
                case 3:
                    existing = _a.sent();
                    if (existing) {
                        console.log("\u2705 Attendee type already exists: ".concat(typeData.name));
                        createdAttendeeTypes.push(existing);
                        return [3 /*break*/, 5];
                    }
                    return [4 /*yield*/, prisma.attendeeType.create({
                            data: typeData,
                        })];
                case 4:
                    attendeeType = _a.sent();
                    console.log("\u2705 \u2713 Attendee Type: ".concat(attendeeType.name, " (").concat(attendeeType.code, ")"));
                    createdAttendeeTypes.push(attendeeType);
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6:
                    console.log("\u2705 Total attendee types created/updated: ".concat(createdAttendeeTypes.length));
                    return [2 /*return*/, createdAttendeeTypes];
            }
        });
    });
}
