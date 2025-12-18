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
exports.seedAttendeesAndRegistrations = seedAttendeesAndRegistrations;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function seedAttendeesAndRegistrations() {
    return __awaiter(this, void 0, void 0, function () {
        var acmeOrg, events, attendeesData, createdAttendees, _i, attendeesData_1, attendeeData, existing, attendee, totalRegistrations, registrationStatuses, _a, events_1, event_1, targetCount, attendeesToRegister, _b, attendeesToRegister_1, attendee, existing, statusWeights, random, status_1, eventYear, snapshotCompany, snapshotJobTitle, eventAttendeeTypeId, randomType;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('ℹ️  Seeding attendees and registrations...');
                    return [4 /*yield*/, prisma.organization.findFirst({
                            where: { slug: 'acme-corp' },
                        })];
                case 1:
                    acmeOrg = _c.sent();
                    if (!acmeOrg) {
                        console.log(' Organization Acme Corp not found, skipping attendees/registrations seeding');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.event.findMany({
                            where: {
                                org_id: acmeOrg.id,
                                status: 'published',
                            },
                            include: {
                                settings: true,
                                eventAttendeeTypes: true, // Inclure les types de participants de l'événement
                            },
                        })];
                case 2:
                    events = _c.sent();
                    if (events.length === 0) {
                        console.log(' No published events found, skipping attendees/registrations seeding');
                        return [2 /*return*/];
                    }
                    attendeesData = [
                        {
                            email: 'marie.dupont@example.com',
                            first_name: 'Marie',
                            last_name: 'Dupont',
                            phone: '+33612345678',
                            company: 'TechCorp',
                            job_title: 'Développeuse Senior',
                            country: 'France',
                        },
                        {
                            email: 'pierre.martin@example.com',
                            first_name: 'Pierre',
                            last_name: 'Martin',
                            phone: '+33623456789',
                            company: 'InnoLab',
                            job_title: 'CTO',
                            country: 'France',
                        },
                        {
                            email: 'sophie.bernard@example.com',
                            first_name: 'Sophie',
                            last_name: 'Bernard',
                            phone: '+33634567890',
                            company: 'DataCo',
                            job_title: 'Data Scientist',
                            country: 'France',
                        },
                        {
                            email: 'lucas.petit@example.com',
                            first_name: 'Lucas',
                            last_name: 'Petit',
                            phone: '+33645678901',
                            company: 'CloudSys',
                            job_title: 'DevOps Engineer',
                            country: 'France',
                        },
                        {
                            email: 'emma.rousseau@example.com',
                            first_name: 'Emma',
                            last_name: 'Rousseau',
                            phone: '+33656789012',
                            company: 'AI Solutions',
                            job_title: 'ML Engineer',
                            country: 'France',
                        },
                        {
                            email: 'thomas.moreau@example.com',
                            first_name: 'Thomas',
                            last_name: 'Moreau',
                            phone: '+33667890123',
                            company: 'WebTech',
                            job_title: 'Full Stack Developer',
                            country: 'France',
                        },
                        {
                            email: 'julie.simon@example.com',
                            first_name: 'Julie',
                            last_name: 'Simon',
                            phone: '+33678901234',
                            company: 'StartupLab',
                            job_title: 'Product Manager',
                            country: 'France',
                        },
                        {
                            email: 'antoine.laurent@example.com',
                            first_name: 'Antoine',
                            last_name: 'Laurent',
                            phone: '+33689012345',
                            company: 'SecureNet',
                            job_title: 'Security Analyst',
                            country: 'France',
                        },
                        {
                            email: 'camille.lefebvre@example.com',
                            first_name: 'Camille',
                            last_name: 'Lefebvre',
                            phone: '+33690123456',
                            company: 'MobileDev',
                            job_title: 'Mobile Developer',
                            country: 'France',
                        },
                        {
                            email: 'maxime.garcia@example.com',
                            first_name: 'Maxime',
                            last_name: 'Garcia',
                            phone: '+33601234567',
                            company: 'GameStudio',
                            job_title: 'Game Developer',
                            country: 'France',
                        },
                    ];
                    createdAttendees = [];
                    _i = 0, attendeesData_1 = attendeesData;
                    _c.label = 3;
                case 3:
                    if (!(_i < attendeesData_1.length)) return [3 /*break*/, 7];
                    attendeeData = attendeesData_1[_i];
                    return [4 /*yield*/, prisma.attendee.findFirst({
                            where: {
                                org_id: acmeOrg.id,
                                email: attendeeData.email,
                            },
                        })];
                case 4:
                    existing = _c.sent();
                    if (existing) {
                        console.log("\u2705 Attendee already exists: ".concat(attendeeData.email));
                        createdAttendees.push(existing);
                        return [3 /*break*/, 6];
                    }
                    return [4 /*yield*/, prisma.attendee.create({
                            data: __assign(__assign({ org_id: acmeOrg.id }, attendeeData), { labels: [], is_active: true }),
                        })];
                case 5:
                    attendee = _c.sent();
                    console.log("\u2705 \u2713 Attendee: ".concat(attendee.first_name, " ").concat(attendee.last_name, " (").concat(attendee.email, ")"));
                    createdAttendees.push(attendee);
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    totalRegistrations = 0;
                    registrationStatuses = ['awaiting', 'approved', 'refused', 'cancelled'];
                    _a = 0, events_1 = events;
                    _c.label = 8;
                case 8:
                    if (!(_a < events_1.length)) return [3 /*break*/, 15];
                    event_1 = events_1[_a];
                    targetCount = event_1.capacity
                        ? Math.floor(event_1.capacity * (0.3 + Math.random() * 0.4))
                        : Math.floor(5 + Math.random() * 10);
                    attendeesToRegister = createdAttendees
                        .sort(function () { return Math.random() - 0.5; }) // Shuffle
                        .slice(0, Math.min(targetCount, createdAttendees.length));
                    _b = 0, attendeesToRegister_1 = attendeesToRegister;
                    _c.label = 9;
                case 9:
                    if (!(_b < attendeesToRegister_1.length)) return [3 /*break*/, 13];
                    attendee = attendeesToRegister_1[_b];
                    return [4 /*yield*/, prisma.registration.findFirst({
                            where: {
                                org_id: acmeOrg.id,
                                event_id: event_1.id,
                                attendee_id: attendee.id,
                            },
                        })];
                case 10:
                    existing = _c.sent();
                    if (existing) {
                        return [3 /*break*/, 12];
                    }
                    statusWeights = [0.15, 0.75, 0.05, 0.05];
                    random = Math.random();
                    status_1 = void 0;
                    if (random < statusWeights[0])
                        status_1 = 'awaiting';
                    else if (random < statusWeights[0] + statusWeights[1])
                        status_1 = 'approved';
                    else if (random < statusWeights[0] + statusWeights[1] + statusWeights[2])
                        status_1 = 'refused';
                    else
                        status_1 = 'cancelled';
                    eventYear = event_1.start_at ? new Date(event_1.start_at).getFullYear() : new Date().getFullYear();
                    snapshotCompany = Math.random() > 0.5
                        ? "".concat(attendee.company, " (").concat(eventYear, ")")
                        : "".concat(attendee.company);
                    snapshotJobTitle = Math.random() > 0.3
                        ? "".concat(attendee.job_title, " - ").concat(event_1.name.substring(0, 10), "...")
                        : attendee.job_title;
                    eventAttendeeTypeId = null;
                    if (event_1.eventAttendeeTypes && event_1.eventAttendeeTypes.length > 0) {
                        randomType = event_1.eventAttendeeTypes[Math.floor(Math.random() * event_1.eventAttendeeTypes.length)];
                        eventAttendeeTypeId = randomType.id;
                    }
                    return [4 /*yield*/, prisma.registration.create({
                            data: {
                                org_id: acmeOrg.id,
                                event_id: event_1.id,
                                attendee_id: attendee.id,
                                event_attendee_type_id: eventAttendeeTypeId,
                                status: status_1,
                                attendance_mode: 'onsite',
                                // Remplissage des données snapshot
                                snapshot_first_name: attendee.first_name,
                                snapshot_last_name: attendee.last_name,
                                snapshot_email: attendee.email,
                                snapshot_phone: attendee.phone,
                                snapshot_company: snapshotCompany,
                                snapshot_job_title: snapshotJobTitle,
                                answers: {
                                    firstName: attendee.first_name,
                                    lastName: attendee.last_name,
                                    email: attendee.email,
                                    company: snapshotCompany,
                                    jobTitle: snapshotJobTitle,
                                    expectations: 'Learning new things',
                                },
                                confirmed_at: status_1 === 'approved' ? new Date() : null,
                            },
                        })];
                case 11:
                    _c.sent();
                    totalRegistrations++;
                    _c.label = 12;
                case 12:
                    _b++;
                    return [3 /*break*/, 9];
                case 13:
                    console.log("\u2705 Created ".concat(attendeesToRegister.length, " registrations for event: ").concat(event_1.name));
                    _c.label = 14;
                case 14:
                    _a++;
                    return [3 /*break*/, 8];
                case 15:
                    console.log("\u2705 Total attendees created/updated: ".concat(createdAttendees.length));
                    console.log("\u2705 Total registrations created: ".concat(totalRegistrations));
                    return [2 /*return*/, { attendees: createdAttendees, registrationsCount: totalRegistrations }];
            }
        });
    });
}
