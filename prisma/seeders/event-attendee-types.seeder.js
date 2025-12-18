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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEventAttendeeTypes = seedEventAttendeeTypes;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function seedEventAttendeeTypes() {
    return __awaiter(this, void 0, void 0, function () {
        var acmeOrg, events, attendeeTypes, createdEventAttendeeTypes, _i, events_1, event_1, shuffledTypes, selectedTypes, _a, selectedTypes_1, attendeeType, existing, capacity, eventAttendeeType;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('ℹ️  Seeding event attendee types...');
                    return [4 /*yield*/, prisma.organization.findFirst({
                            where: { slug: 'acme-corp' },
                        })];
                case 1:
                    acmeOrg = _b.sent();
                    if (!acmeOrg) {
                        console.log(' Organization Acme Corp not found, skipping event attendee types seeding');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.event.findMany({
                            where: { org_id: acmeOrg.id },
                            include: { organization: true },
                        })];
                case 2:
                    events = _b.sent();
                    if (events.length === 0) {
                        console.log(' No events found for Acme Corp, skipping event attendee types seeding');
                        return [2 /*return*/];
                    }
                    console.log("\uD83D\uDCCC Found ".concat(events.length, " events for Acme Corp"));
                    return [4 /*yield*/, prisma.attendeeType.findMany({
                            where: {
                                org_id: acmeOrg.id,
                                is_active: true,
                            },
                            orderBy: {
                                name: 'asc',
                            },
                        })];
                case 3:
                    attendeeTypes = _b.sent();
                    if (attendeeTypes.length === 0) {
                        console.log(' No attendee types found for this organization, skipping event attendee types seeding');
                        return [2 /*return*/];
                    }
                    createdEventAttendeeTypes = [];
                    _i = 0, events_1 = events;
                    _b.label = 4;
                case 4:
                    if (!(_i < events_1.length)) return [3 /*break*/, 10];
                    event_1 = events_1[_i];
                    console.log("Processing event: ".concat(event_1.name, " (").concat(event_1.code, ")"));
                    shuffledTypes = __spreadArray([], attendeeTypes, true).sort(function () { return 0.5 - Math.random(); });
                    selectedTypes = shuffledTypes.slice(0, Math.max(2, Math.floor(Math.random() * attendeeTypes.length) + 1));
                    _a = 0, selectedTypes_1 = selectedTypes;
                    _b.label = 5;
                case 5:
                    if (!(_a < selectedTypes_1.length)) return [3 /*break*/, 9];
                    attendeeType = selectedTypes_1[_a];
                    return [4 /*yield*/, prisma.eventAttendeeType.findFirst({
                            where: {
                                event_id: event_1.id,
                                attendee_type_id: attendeeType.id,
                            },
                        })];
                case 6:
                    existing = _b.sent();
                    if (existing) {
                        // console.log(`✅ Event attendee type already exists: ${attendeeType.name}`);
                        createdEventAttendeeTypes.push(existing);
                        return [3 /*break*/, 8];
                    }
                    capacity = null;
                    switch (attendeeType.code) {
                        case 'VIP':
                            capacity = 50;
                            break;
                        case 'SPEAKER':
                            capacity = 20;
                            break;
                        case 'SPONSOR':
                            capacity = 30;
                            break;
                        case 'PRESS':
                            capacity = 25;
                            break;
                        case 'STAFF':
                            capacity = 40;
                            break;
                        case 'PARTICIPANT':
                            capacity = 500;
                            break;
                        default:
                            capacity = null;
                    }
                    return [4 /*yield*/, prisma.eventAttendeeType.create({
                            data: {
                                event_id: event_1.id,
                                org_id: event_1.org_id,
                                attendee_type_id: attendeeType.id,
                                capacity: capacity,
                            },
                        })];
                case 7:
                    eventAttendeeType = _b.sent();
                    // console.log(`✅ ✓ Event Attendee Type: ${attendeeType.name} (capacity: ${capacity || 'unlimited'})`);
                    createdEventAttendeeTypes.push(eventAttendeeType);
                    _b.label = 8;
                case 8:
                    _a++;
                    return [3 /*break*/, 5];
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10:
                    console.log("\u2705 Total event attendee types created/updated: ".concat(createdEventAttendeeTypes.length));
                    return [2 /*return*/, createdEventAttendeeTypes];
            }
        });
    });
}
