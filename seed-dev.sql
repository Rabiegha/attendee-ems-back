-- ========================================
-- SEED DÉVELOPPEMENT - Données de test complètes
-- Pour tests locaux avec fake data
-- ========================================

-- Nettoyer toutes les données existantes
TRUNCATE TABLE 
    attendees,
    registrations,
    event_attendee_types,
    events,
    attendee_types,
    badge_templates,
    users,
    permissions,
    roles,
    organizations
CASCADE;

-- ========================================
-- 1. ROLES SYSTÈME
-- ========================================

INSERT INTO roles (id, org_id, code, name, description, level, is_system_role, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', NULL, 'SUPER_ADMIN', 'Super Administrator', 'System role - Full access across all organizations', 0, true, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002', NULL, 'ADMIN', 'Administrator', 'Organization administrator', 1, true, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000003', NULL, 'MANAGER', 'Manager', 'Event manager', 2, true, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000004', NULL, 'STAFF', 'Staff', 'Staff member', 3, true, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000005', NULL, 'VIEWER', 'Viewer', 'Read-only access', 4, true, NOW(), NOW());

-- ========================================
-- 2. ORGANIZATIONS
-- ========================================

INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES 
    ('10000000-0000-0000-0000-000000000001', 'Choyou', 'choyou', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000002', 'ACME Events', 'acme-events', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000003', 'TechConf', 'techconf', NOW(), NOW());

-- ========================================
-- 3. USERS
-- ========================================

-- Hash bcrypt pour "admin123" : $2b$10$CRXj5xWJpqjz3b/VHjXJKOGMGPl0B4C8DqN8YqFZp5nJ.vFz4yQ3i
-- Hash bcrypt pour "manager123" : $2b$10$8Z9q4rN3pL.1xW5vK2nH3uR4tS6mY7oP8qL9nM.xZ3vY1wK5nZ4K6
-- Hash bcrypt pour "staff123" : $2b$10$7Y8p3qM2oK.0wV4uJ1mG2tQ3sR5lX6nO7pK8mL.yY2uX0vJ4mY3J5

INSERT INTO users (id, org_id, email, password_hash, first_name, last_name, role_id, is_active, created_at, updated_at)
VALUES 
    -- Choyou organization
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin@choyou.fr', '$2b$10$CRXj5xWJpqjz3b/VHjXJKOGMGPl0B4C8DqN8YqFZp5nJ.vFz4yQ3i', 'Admin', 'Choyou', '00000000-0000-0000-0000-000000000001', true, NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'manager@choyou.fr', '$2b$10$8Z9q4rN3pL.1xW5vK2nH3uR4tS6mY7oP8qL9nM.xZ3vY1wK5nZ4K6', 'Manager', 'Choyou', '00000000-0000-0000-0000-000000000003', true, NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'staff@choyou.fr', '$2b$10$7Y8p3qM2oK.0wV4uJ1mG2tQ3sR5lX6nO7pK8mL.yY2uX0vJ4mY3J5', 'Staff', 'Choyou', '00000000-0000-0000-0000-000000000004', true, NOW(), NOW()),
    
    -- ACME Events organization
    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'admin@acme.com', '$2b$10$CRXj5xWJpqjz3b/VHjXJKOGMGPl0B4C8DqN8YqFZp5nJ.vFz4yQ3i', 'Jane', 'Smith', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'manager@acme.com', '$2b$10$8Z9q4rN3pL.1xW5vK2nH3uR4tS6mY7oP8qL9nM.xZ3vY1wK5nZ4K6', 'Bob', 'Johnson', '00000000-0000-0000-0000-000000000003', true, NOW(), NOW()),
    
    -- TechConf organization
    ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'admin@techconf.com', '$2b$10$CRXj5xWJpqjz3b/VHjXJKOGMGPl0B4C8DqN8YqFZp5nJ.vFz4yQ3i', 'Alice', 'Williams', '00000000-0000-0000-0000-000000000002', true, NOW(), NOW());

-- ========================================
-- 4. ATTENDEE TYPES
-- ========================================

INSERT INTO attendee_types (id, org_id, code, name, description, is_active, created_at, updated_at)
VALUES 
    -- Choyou
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'VIP', 'VIP', 'VIP attendees with full access', true, NOW(), NOW()),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'SPEAKER', 'Speaker', 'Event speakers', true, NOW(), NOW()),
    ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'STANDARD', 'Standard', 'Standard attendees', true, NOW(), NOW()),
    ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'STUDENT', 'Student', 'Student discount', true, NOW(), NOW()),
    
    -- ACME Events
    ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'VIP', 'VIP', 'VIP access', true, NOW(), NOW()),
    ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'GENERAL', 'General Admission', 'General ticket', true, NOW(), NOW()),
    
    -- TechConf
    ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'EARLY_BIRD', 'Early Bird', 'Early bird discount', true, NOW(), NOW()),
    ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'REGULAR', 'Regular', 'Regular price', true, NOW(), NOW());

-- ========================================
-- 5. EVENTS
-- ========================================

INSERT INTO events (id, org_id, name, slug, description, location, start_date, end_date, capacity, is_published, created_at, updated_at)
VALUES 
    -- Choyou events
    ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Tech Summit 2026', 'tech-summit-2026', 'Annual technology conference', 'Paris, France', '2026-03-15 09:00:00', '2026-03-17 18:00:00', 500, true, NOW(), NOW()),
    ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Innovation Forum', 'innovation-forum', 'Innovation and startups', 'Lyon, France', '2026-05-20 10:00:00', '2026-05-20 17:00:00', 200, true, NOW(), NOW()),
    
    -- ACME Events
    ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Business Expo 2026', 'business-expo-2026', 'B2B networking event', 'London, UK', '2026-04-10 08:00:00', '2026-04-12 19:00:00', 1000, true, NOW(), NOW()),
    
    -- TechConf
    ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'DevOps Days', 'devops-days', 'DevOps conference', 'Berlin, Germany', '2026-06-05 09:00:00', '2026-06-07 18:00:00', 300, true, NOW(), NOW());

-- ========================================
-- 6. EVENT ATTENDEE TYPES (liaison événements-types)
-- ========================================

INSERT INTO event_attendee_types (id, event_id, attendee_type_id, price, capacity, created_at, updated_at)
VALUES 
    -- Tech Summit 2026
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 500.00, 50, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 0.00, 20, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 200.00, 300, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 100.00, 130, NOW(), NOW()),
    
    -- Innovation Forum
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 300.00, 30, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 150.00, 170, NOW(), NOW()),
    
    -- Business Expo 2026
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', 800.00, 100, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', 300.00, 900, NOW(), NOW()),
    
    -- DevOps Days
    ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000007', 250.00, 100, NOW(), NOW()),
    ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000008', 350.00, 200, NOW(), NOW());

-- ========================================
-- 7. BADGE TEMPLATES
-- ========================================

INSERT INTO badge_templates (id, org_id, name, slug, html_content, is_default, created_at, updated_at)
VALUES 
    ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Default Choyou', 'default-choyou', '<div>{{firstName}} {{lastName}}<br>{{eventName}}</div>', true, NOW(), NOW()),
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Default ACME', 'default-acme', '<div>{{firstName}} {{lastName}}<br>{{company}}</div>', true, NOW(), NOW());

-- ========================================
-- 8. ATTENDEES (participants fictifs)
-- ========================================

INSERT INTO attendees (id, org_id, first_name, last_name, email, phone, company, job_title, notes, created_at, updated_at)
VALUES 
    -- Choyou attendees
    ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Pierre', 'Dupont', 'pierre.dupont@example.com', '+33612345678', 'TechCorp', 'CTO', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Marie', 'Martin', 'marie.martin@example.com', '+33687654321', 'InnoSoft', 'CEO', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Luc', 'Bernard', 'luc.bernard@example.com', '+33698765432', 'DataFlow', 'Lead Developer', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Sophie', 'Dubois', 'sophie.dubois@example.com', '+33676543210', 'CloudNet', 'Product Manager', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Thomas', 'Moreau', 'thomas.moreau@example.com', '+33687654320', 'DevHub', 'Engineer', null, NOW(), NOW()),
    
    -- ACME attendees
    ('70000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'John', 'Doe', 'john.doe@acme-example.com', '+441234567890', 'ACME Corp', 'Director', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'Emma', 'Watson', 'emma.watson@acme-example.com', '+441234567891', 'BizTech', 'VP Sales', null, NOW(), NOW()),
    
    -- TechConf attendees
    ('70000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'Hans', 'Mueller', 'hans.mueller@techconf-example.com', '+491234567890', 'CloudOps', 'DevOps Lead', null, NOW(), NOW()),
    ('70000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'Anna', 'Schmidt', 'anna.schmidt@techconf-example.com', '+491234567891', 'AutoDeploy', 'SRE', null, NOW(), NOW());

-- ========================================
-- 9. REGISTRATIONS (inscriptions)
-- ========================================

INSERT INTO registrations (id, event_id, event_attendee_type_id, attendee_id, registration_code, status, paid, amount_paid, registered_at, created_at, updated_at)
VALUES 
    -- Tech Summit 2026
    ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'TS2026-VIP-001', 'confirmed', true, 500.00, NOW() - INTERVAL '10 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 'TS2026-STD-002', 'confirmed', true, 200.00, NOW() - INTERVAL '8 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000003', 'TS2026-STU-003', 'awaiting', false, 0.00, NOW() - INTERVAL '5 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004', 'TS2026-SPK-004', 'confirmed', true, 0.00, NOW() - INTERVAL '3 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000005', 'TS2026-STD-005', 'cancelled', false, 0.00, NOW() - INTERVAL '2 days', NOW(), NOW()),
    
    -- Innovation Forum
    ('80000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 'IF2026-VIP-001', 'confirmed', true, 300.00, NOW() - INTERVAL '7 days', NOW(), NOW()),
    
    -- Business Expo 2026
    ('80000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000006', 'BE2026-VIP-001', 'confirmed', true, 800.00, NOW() - INTERVAL '15 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000007', 'BE2026-GEN-002', 'confirmed', true, 300.00, NOW() - INTERVAL '12 days', NOW(), NOW()),
    
    -- DevOps Days
    ('80000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000008', 'DD2026-EB-001', 'confirmed', true, 250.00, NOW() - INTERVAL '20 days', NOW(), NOW()),
    ('80000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000009', 'DD2026-REG-002', 'awaiting', false, 0.00, NOW() - INTERVAL '2 days', NOW(), NOW());

-- ========================================
-- Terminé !
-- ========================================

SELECT 
    'Seed développement terminé!' as message,
    (SELECT COUNT(*) FROM organizations) as organizations,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM events) as events,
    (SELECT COUNT(*) FROM attendees) as attendees,
    (SELECT COUNT(*) FROM registrations) as registrations;
