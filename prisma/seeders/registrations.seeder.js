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
exports.seedRegistrationsForEvent = seedRegistrationsForEvent;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function seedRegistrationsForEvent() {
    return __awaiter(this, void 0, void 0, function () {
        var event, attendeesData, attendees, _i, attendeesData_1, attendeeData, attendee, registrationStatuses, attendanceModes, totalRegistrations, eventAttendeeTypesArray, i, attendee, existing, eventAttendeeType, statusWeights, random, status_1, attendanceMode, snapshotCompany, snapshotJobTitle, registration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('ℹ️  Seeding registrations for specific event...');
                    return [4 /*yield*/, prisma.event.findFirst({
                            where: { code: 'TODAY-2025-11-02' },
                            include: {
                                organization: true,
                                eventAttendeeTypes: {
                                    include: {
                                        attendeeType: true,
                                    },
                                },
                            },
                        })];
                case 1:
                    event = _a.sent();
                    if (!event) {
                        console.log('❌ Event "TODAY-2025-11-02" not found, skipping registrations seeding');
                        return [2 /*return*/];
                    }
                    console.log("\uD83D\uDCCC Event found: ".concat(event.name, " (").concat(event.code, ")"));
                    if (event.eventAttendeeTypes.length === 0) {
                        console.log(' No event attendee types found for this event. Please run event-attendee-types seeder first.');
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
                        {
                            email: 'sarah.dubois@example.com',
                            first_name: 'Sarah',
                            last_name: 'Dubois',
                            phone: '+33612345679',
                            company: 'DesignStudio',
                            job_title: 'UX Designer',
                            country: 'France',
                        },
                        {
                            email: 'nicolas.blanc@example.com',
                            first_name: 'Nicolas',
                            last_name: 'Blanc',
                            phone: '+33623456780',
                            company: 'MediaCorp',
                            job_title: 'Journaliste',
                            country: 'France',
                        },
                        {
                            email: 'laura.roux@example.com',
                            first_name: 'Laura',
                            last_name: 'Roux',
                            phone: '+33634567891',
                            company: 'EventPro',
                            job_title: 'Event Manager',
                            country: 'France',
                        },
                        {
                            email: 'david.mercier@example.com',
                            first_name: 'David',
                            last_name: 'Mercier',
                            phone: '+33645678902',
                            company: 'TechSponsor',
                            job_title: 'Marketing Director',
                            country: 'France',
                        },
                        {
                            email: 'chloe.girard@example.com',
                            first_name: 'Chloé',
                            last_name: 'Girard',
                            phone: '+33656789013',
                            company: 'InnovCorp',
                            job_title: 'Innovation Lead',
                            country: 'France',
                        },
                        {
                            email: 'alexandre.faure@example.com',
                            first_name: 'Alexandre',
                            last_name: 'Faure',
                            phone: '+33667890124',
                            company: 'StartupHub',
                            job_title: 'CEO',
                            country: 'France',
                        },
                        {
                            email: 'melissa.andre@example.com',
                            first_name: 'Mélissa',
                            last_name: 'André',
                            phone: '+33678901235',
                            company: 'TechNews',
                            job_title: 'Rédactrice en chef',
                            country: 'France',
                        },
                        {
                            email: 'julien.lambert@example.com',
                            first_name: 'Julien',
                            last_name: 'Lambert',
                            phone: '+33689012346',
                            company: 'SecureIT',
                            job_title: 'CISO',
                            country: 'France',
                        },
                        {
                            email: 'clara.fontaine@example.com',
                            first_name: 'Clara',
                            last_name: 'Fontaine',
                            phone: '+33690123457',
                            company: 'AILab',
                            job_title: 'Research Scientist',
                            country: 'France',
                        },
                        {
                            email: 'mathieu.chevalier@example.com',
                            first_name: 'Mathieu',
                            last_name: 'Chevalier',
                            phone: '+33601234568',
                            company: 'CloudTech',
                            job_title: 'Solutions Architect',
                            country: 'France',
                        },
                        // Ajout de 40 nouveaux attendees pour la pagination
                        {
                            email: 'alice.moreau@example.com',
                            first_name: 'Alice',
                            last_name: 'Moreau',
                            phone: '+33612345680',
                            company: 'TechStart',
                            job_title: 'Frontend Developer',
                            country: 'France',
                        },
                        {
                            email: 'benjamin.bernard@example.com',
                            first_name: 'Benjamin',
                            last_name: 'Bernard',
                            phone: '+33623456781',
                            company: 'DevCorp',
                            job_title: 'Backend Developer',
                            country: 'France',
                        },
                        {
                            email: 'charlotte.durand@example.com',
                            first_name: 'Charlotte',
                            last_name: 'Durand',
                            phone: '+33634567892',
                            company: 'FinTech',
                            job_title: 'Business Analyst',
                            country: 'France',
                        },
                        {
                            email: 'damien.leroy@example.com',
                            first_name: 'Damien',
                            last_name: 'Leroy',
                            phone: '+33645678903',
                            company: 'MediaTech',
                            job_title: 'Content Manager',
                            country: 'France',
                        },
                        {
                            email: 'elodie.simon@example.com',
                            first_name: 'Élodie',
                            last_name: 'Simon',
                            phone: '+33656789014',
                            company: 'EduTech',
                            job_title: 'Teacher',
                            country: 'France',
                        },
                        {
                            email: 'francois.petit@example.com',
                            first_name: 'François',
                            last_name: 'Petit',
                            phone: '+33667890125',
                            company: 'HealthCare',
                            job_title: 'Medical Engineer',
                            country: 'France',
                        },
                        {
                            email: 'gabrielle.rousseau@example.com',
                            first_name: 'Gabrielle',
                            last_name: 'Rousseau',
                            phone: '+33678901236',
                            company: 'AgriTech',
                            job_title: 'Agronomist',
                            country: 'France',
                        },
                        {
                            email: 'hugo.martin@example.com',
                            first_name: 'Hugo',
                            last_name: 'Martin',
                            phone: '+33689012347',
                            company: 'AutoTech',
                            job_title: 'Automotive Engineer',
                            country: 'France',
                        },
                        {
                            email: 'isabelle.dubois@example.com',
                            first_name: 'Isabelle',
                            last_name: 'Dubois',
                            phone: '+33690123458',
                            company: 'RetailTech',
                            job_title: 'Retail Manager',
                            country: 'France',
                        },
                        {
                            email: 'jerome.blanc@example.com',
                            first_name: 'Jérôme',
                            last_name: 'Blanc',
                            phone: '+33601234569',
                            company: 'LogisTech',
                            job_title: 'Supply Chain Manager',
                            country: 'France',
                        },
                        {
                            email: 'karla.roux@example.com',
                            first_name: 'Karla',
                            last_name: 'Roux',
                            phone: '+33612345681',
                            company: 'TravelTech',
                            job_title: 'Travel Consultant',
                            country: 'France',
                        },
                        {
                            email: 'louis.mercier@example.com',
                            first_name: 'Louis',
                            last_name: 'Mercier',
                            phone: '+33623456782',
                            company: 'SocialTech',
                            job_title: 'Community Manager',
                            country: 'France',
                        },
                        {
                            email: 'manon.girard@example.com',
                            first_name: 'Manon',
                            last_name: 'Girard',
                            phone: '+33634567893',
                            company: 'EventTech',
                            job_title: 'Event Coordinator',
                            country: 'France',
                        },
                        {
                            email: 'nathan.faure@example.com',
                            first_name: 'Nathan',
                            last_name: 'Faure',
                            phone: '+33645678904',
                            company: 'SportTech',
                            job_title: 'Sports Analyst',
                            country: 'France',
                        },
                        {
                            email: 'oceane.andre@example.com',
                            first_name: 'Océane',
                            last_name: 'André',
                            phone: '+33656789015',
                            company: 'FashionTech',
                            job_title: 'Fashion Designer',
                            country: 'France',
                        },
                        {
                            email: 'paul.lambert@example.com',
                            first_name: 'Paul',
                            last_name: 'Lambert',
                            phone: '+33667890126',
                            company: 'FoodTech',
                            job_title: 'Chef',
                            country: 'France',
                        },
                        {
                            email: 'quentin.fontaine@example.com',
                            first_name: 'Quentin',
                            last_name: 'Fontaine',
                            phone: '+33678901237',
                            company: 'EnergyTech',
                            job_title: 'Energy Consultant',
                            country: 'France',
                        },
                        {
                            email: 'romane.chevalier@example.com',
                            first_name: 'Romane',
                            last_name: 'Chevalier',
                            phone: '+33689012348',
                            company: 'PropTech',
                            job_title: 'Real Estate Agent',
                            country: 'France',
                        },
                        {
                            email: 'sebastien.garcia@example.com',
                            first_name: 'Sébastien',
                            last_name: 'Garcia',
                            phone: '+33690123459',
                            company: 'LegalTech',
                            job_title: 'Legal Advisor',
                            country: 'France',
                        },
                        {
                            email: 'thibault.lefebvre@example.com',
                            first_name: 'Thibault',
                            last_name: 'Lefebvre',
                            phone: '+33601234570',
                            company: 'InsurTech',
                            job_title: 'Insurance Broker',
                            country: 'France',
                        },
                        {
                            email: 'valentine.moreau@example.com',
                            first_name: 'Valentine',
                            last_name: 'Moreau',
                            phone: '+33612345682',
                            company: 'BioTech',
                            job_title: 'Biologist',
                            country: 'France',
                        },
                        {
                            email: 'william.bernard@example.com',
                            first_name: 'William',
                            last_name: 'Bernard',
                            phone: '+33623456783',
                            company: 'AeroTech',
                            job_title: 'Aerospace Engineer',
                            country: 'France',
                        },
                        {
                            email: 'xavier.durand@example.com',
                            first_name: 'Xavier',
                            last_name: 'Durand',
                            phone: '+33634567894',
                            company: 'ChemTech',
                            job_title: 'Chemical Engineer',
                            country: 'France',
                        },
                        {
                            email: 'yasmine.leroy@example.com',
                            first_name: 'Yasmine',
                            last_name: 'Leroy',
                            phone: '+33645678905',
                            company: 'PhotoTech',
                            job_title: 'Photographer',
                            country: 'France',
                        },
                        {
                            email: 'zacharie.simon@example.com',
                            first_name: 'Zacharie',
                            last_name: 'Simon',
                            phone: '+33656789016',
                            company: 'MusicTech',
                            job_title: 'Music Producer',
                            country: 'France',
                        },
                        {
                            email: 'amelie.petit@example.com',
                            first_name: 'Amélie',
                            last_name: 'Petit',
                            phone: '+33667890127',
                            company: 'ArtTech',
                            job_title: 'Graphic Designer',
                            country: 'France',
                        },
                        {
                            email: 'baptiste.rousseau@example.com',
                            first_name: 'Baptiste',
                            last_name: 'Rousseau',
                            phone: '+33678901238',
                            company: 'FilmTech',
                            job_title: 'Film Director',
                            country: 'France',
                        },
                        {
                            email: 'celine.martin@example.com',
                            first_name: 'Céline',
                            last_name: 'Martin',
                            phone: '+33689012349',
                            company: 'TheatreTech',
                            job_title: 'Theater Actor',
                            country: 'France',
                        },
                        {
                            email: 'diego.dubois@example.com',
                            first_name: 'Diego',
                            last_name: 'Dubois',
                            phone: '+33690123460',
                            company: 'DanceTech',
                            job_title: 'Choreographer',
                            country: 'France',
                        },
                        {
                            email: 'emilie.blanc@example.com',
                            first_name: 'Émilie',
                            last_name: 'Blanc',
                            phone: '+33601234571',
                            company: 'ArchTech',
                            job_title: 'Architect',
                            country: 'France',
                        },
                        {
                            email: 'fabien.roux@example.com',
                            first_name: 'Fabien',
                            last_name: 'Roux',
                            phone: '+33612345683',
                            company: 'UrbanTech',
                            job_title: 'Urban Planner',
                            country: 'France',
                        },
                        {
                            email: 'gwenaelle.mercier@example.com',
                            first_name: 'Gwenaëlle',
                            last_name: 'Mercier',
                            phone: '+33623456784',
                            company: 'EcoTech',
                            job_title: 'Environmental Scientist',
                            country: 'France',
                        },
                        {
                            email: 'henri.girard@example.com',
                            first_name: 'Henri',
                            last_name: 'Girard',
                            phone: '+33634567895',
                            company: 'MarineTech',
                            job_title: 'Marine Biologist',
                            country: 'France',
                        },
                        {
                            email: 'iris.faure@example.com',
                            first_name: 'Iris',
                            last_name: 'Faure',
                            phone: '+33645678906',
                            company: 'SpaceTech',
                            job_title: 'Astrophysicist',
                            country: 'France',
                        },
                        {
                            email: 'julien.andre@example.com',
                            first_name: 'Julien',
                            last_name: 'André',
                            phone: '+33656789017',
                            company: 'GeologyTech',
                            job_title: 'Geologist',
                            country: 'France',
                        },
                        {
                            email: 'karine.lambert@example.com',
                            first_name: 'Karine',
                            last_name: 'Lambert',
                            phone: '+33667890128',
                            company: 'MeteoTech',
                            job_title: 'Meteorologist',
                            country: 'France',
                        },
                        {
                            email: 'leon.fontaine@example.com',
                            first_name: 'Léon',
                            last_name: 'Fontaine',
                            phone: '+33678901239',
                            company: 'PharmaTech',
                            job_title: 'Pharmacist',
                            country: 'France',
                        },
                        {
                            email: 'marine.chevalier@example.com',
                            first_name: 'Marine',
                            last_name: 'Chevalier',
                            phone: '+33689012350',
                            company: 'VetTech',
                            job_title: 'Veterinarian',
                            country: 'France',
                        },
                        {
                            email: 'olivier.garcia@example.com',
                            first_name: 'Olivier',
                            last_name: 'Garcia',
                            phone: '+33690123461',
                            company: 'DentalTech',
                            job_title: 'Dentist',
                            country: 'France',
                        },
                        {
                            email: 'pauline.lefebvre@example.com',
                            first_name: 'Pauline',
                            last_name: 'Lefebvre',
                            phone: '+33601234572',
                            company: 'PsychoTech',
                            job_title: 'Psychologist',
                            country: 'France',
                        },
                    ];
                    attendees = [];
                    _i = 0, attendeesData_1 = attendeesData;
                    _a.label = 2;
                case 2:
                    if (!(_i < attendeesData_1.length)) return [3 /*break*/, 7];
                    attendeeData = attendeesData_1[_i];
                    return [4 /*yield*/, prisma.attendee.findFirst({
                            where: {
                                org_id: event.org_id,
                                email: attendeeData.email,
                            },
                        })];
                case 3:
                    attendee = _a.sent();
                    if (!!attendee) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.attendee.create({
                            data: __assign(__assign({ org_id: event.org_id }, attendeeData), { labels: [], is_active: true }),
                        })];
                case 4:
                    attendee = _a.sent();
                    console.log("\u2705 \u2713 Created Attendee: ".concat(attendee.first_name, " ").concat(attendee.last_name));
                    _a.label = 5;
                case 5:
                    attendees.push(attendee);
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    registrationStatuses = ['awaiting', 'approved', 'refused', 'cancelled'];
                    attendanceModes = ['onsite', 'online', 'hybrid'];
                    totalRegistrations = 0;
                    eventAttendeeTypesArray = event.eventAttendeeTypes;
                    i = 0;
                    _a.label = 8;
                case 8:
                    if (!(i < attendees.length)) return [3 /*break*/, 12];
                    attendee = attendees[i];
                    return [4 /*yield*/, prisma.registration.findFirst({
                            where: {
                                org_id: event.org_id,
                                event_id: event.id,
                                attendee_id: attendee.id,
                            },
                        })];
                case 9:
                    existing = _a.sent();
                    if (existing) {
                        console.log("\u23ED\uFE0F  Registration already exists for: ".concat(attendee.email));
                        return [3 /*break*/, 11];
                    }
                    eventAttendeeType = eventAttendeeTypesArray[i % eventAttendeeTypesArray.length];
                    statusWeights = [0.10, 0.80, 0.05, 0.05];
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
                    attendanceMode = attendanceModes[Math.floor(Math.random() * attendanceModes.length)];
                    snapshotCompany = "".concat(attendee.company, " (Event ").concat(event.code.split('-')[1] || 'Specific', ")");
                    snapshotJobTitle = "".concat(attendee.job_title, " @ ").concat(event.name.substring(0, 10));
                    return [4 /*yield*/, prisma.registration.create({
                            data: {
                                org_id: event.org_id,
                                event_id: event.id,
                                attendee_id: attendee.id,
                                status: status_1,
                                attendance_mode: attendanceMode,
                                event_attendee_type_id: eventAttendeeType.id,
                                // Snapshot data
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
                                },
                                confirmed_at: status_1 === 'approved' ? new Date() : null,
                                // URLs de badge génériques pour test
                                badge_pdf_url: "https://storage.example.com/badges/".concat(attendee.id, "/badge.pdf"),
                                badge_image_url: "https://storage.example.com/badges/".concat(attendee.id, "/badge.png"),
                            },
                        })];
                case 10:
                    registration = _a.sent();
                    console.log("\u2705 \u2713 Registration: ".concat(attendee.first_name, " ").concat(attendee.last_name, " - Type: ").concat(eventAttendeeType.attendeeType.name, " - Status: ").concat(status_1));
                    totalRegistrations++;
                    _a.label = 11;
                case 11:
                    i++;
                    return [3 /*break*/, 8];
                case 12:
                    console.log("\u2705 Total registrations created for event ".concat(event.name, ": ").concat(totalRegistrations));
                    return [2 /*return*/, { event: event, registrationsCount: totalRegistrations }];
            }
        });
    });
}
