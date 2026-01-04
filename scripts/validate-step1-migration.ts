#!/usr/bin/env ts-node

/**
 * Script de validation de la migration STEP 1
 * 
 * Ce script vérifie que:
 * 1. Les tables ont été créées
 * 2. Les contraintes sont en place
 * 3. Les triggers sont actifs
 * 4. Les données ont été migrées correctement
 * 5. Les invariants sont respectés
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

// ================================================================
// Couleurs pour la console
// ================================================================
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  log('\n' + '='.repeat(60), colors.cyan);
  log(`  ${title}`, colors.cyan);
  log('='.repeat(60) + '\n', colors.cyan);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

// ================================================================
// Tests de validation
// ================================================================

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    );
  `;
  return result[0].exists;
}

async function checkConstraint(tableName: string, constraintName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.table_constraints
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      AND constraint_name = ${constraintName}
    );
  `;
  return result[0].exists;
}

async function checkTrigger(triggerName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<any[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.triggers
      WHERE trigger_name = ${triggerName}
    );
  `;
  return result[0].exists;
}

async function validateTables() {
  header('1. Validation des Tables');

  const tables = [
    'users',
    'organizations',
    'org_users',
    'roles',
    'tenant_user_roles',
    'platform_user_roles',
    'platform_user_org_access',
  ];

  for (const table of tables) {
    const exists = await checkTableExists(table);
    if (exists) {
      success(`Table '${table}' existe`);
      results.push({ name: `Table ${table}`, passed: true, message: 'Existe' });
    } else {
      error(`Table '${table}' n'existe pas`);
      results.push({ name: `Table ${table}`, passed: false, message: 'N\'existe pas' });
    }
  }
}

async function validateConstraints() {
  header('2. Validation des Contraintes');

  const constraints = [
    { table: 'users', name: 'users_email_key', description: 'Email unique global' },
    { table: 'org_users', name: 'org_users_user_id_org_id_key', description: 'Membership unique' },
    { table: 'tenant_user_roles', name: 'tenant_user_roles_user_id_org_id_key', description: '1 rôle tenant par org' },
    { table: 'platform_user_roles', name: 'platform_user_roles_user_id_key', description: '1 rôle platform max' },
    { table: 'roles', name: 'roles_id_org_id_key', description: 'Unique composite (id, org_id)' },
  ];

  for (const constraint of constraints) {
    const exists = await checkConstraint(constraint.table, constraint.name);
    if (exists) {
      success(`${constraint.description} (${constraint.table}.${constraint.name})`);
      results.push({
        name: `Constraint ${constraint.name}`,
        passed: true,
        message: constraint.description,
      });
    } else {
      error(`${constraint.description} (${constraint.table}.${constraint.name}) - MANQUANTE`);
      results.push({
        name: `Constraint ${constraint.name}`,
        passed: false,
        message: `${constraint.description} - MANQUANTE`,
      });
    }
  }
}

async function validateTriggers() {
  header('3. Validation des Triggers');

  const triggers = [
    { name: 'trigger_check_platform_role', description: 'Empêche rôles tenant dans platform_user_roles' },
    { name: 'trigger_check_tenant_role', description: 'Empêche rôles platform dans tenant_user_roles' },
  ];

  for (const trigger of triggers) {
    const exists = await checkTrigger(trigger.name);
    if (exists) {
      success(`${trigger.description} (${trigger.name})`);
      results.push({
        name: `Trigger ${trigger.name}`,
        passed: true,
        message: trigger.description,
      });
    } else {
      warning(`${trigger.description} (${trigger.name}) - MANQUANT (optionnel)`);
      results.push({
        name: `Trigger ${trigger.name}`,
        passed: true, // Pas bloquant
        message: `${trigger.description} - MANQUANT (optionnel)`,
      });
    }
  }
}

async function validateDataMigration() {
  header('4. Validation de la Migration des Données');

  // Vérifier que tous les users ont au moins un membership
  const usersCount = await prisma.user.count();
  const usersWithMembership = await prisma.orgUser.groupBy({
    by: ['user_id'],
  });

  if (usersCount === usersWithMembership.length) {
    success(`Tous les users (${usersCount}) ont au moins un membership`);
    results.push({
      name: 'Users avec membership',
      passed: true,
      message: `${usersCount}/${usersCount}`,
    });
  } else {
    error(`${usersCount - usersWithMembership.length} users sans membership`);
    results.push({
      name: 'Users avec membership',
      passed: false,
      message: `${usersWithMembership.length}/${usersCount}`,
      details: { orphans: usersCount - usersWithMembership.length },
    });
  }

  // Vérifier que tous les memberships ont un rôle tenant
  const memberships = await prisma.orgUser.count();
  const tenantRoles = await prisma.tenantUserRole.count();

  if (memberships === tenantRoles) {
    success(`Tous les memberships (${memberships}) ont un rôle tenant`);
    results.push({
      name: 'Memberships avec rôle',
      passed: true,
      message: `${tenantRoles}/${memberships}`,
    });
  } else {
    warning(`${memberships - tenantRoles} memberships sans rôle tenant`);
    results.push({
      name: 'Memberships avec rôle',
      passed: true, // Pas forcément bloquant
      message: `${tenantRoles}/${memberships}`,
      details: { without_role: memberships - tenantRoles },
    });
  }
}

async function validateRoles() {
  header('5. Validation des Rôles');

  // Vérifier les rôles platform
  const platformRoles = await prisma.role.findMany({
    where: { is_platform: true },
  });

  if (platformRoles.length >= 2) {
    success(`${platformRoles.length} rôles platform créés (ROOT, SUPPORT, ...)`);
    results.push({
      name: 'Rôles platform',
      passed: true,
      message: `${platformRoles.length} rôles`,
      details: platformRoles.map((r) => r.code),
    });
  } else {
    warning(`Seulement ${platformRoles.length} rôle(s) platform (attendu: au moins ROOT et SUPPORT)`);
    results.push({
      name: 'Rôles platform',
      passed: true, // Pas bloquant
      message: `${platformRoles.length} rôles`,
    });
  }

  // Vérifier les rôles tenant par org
  const orgs = await prisma.organization.findMany();
  
  for (const org of orgs) {
    const tenantRoles = await prisma.role.count({
      where: { org_id: org.id },
    });

    if (tenantRoles >= 4) {
      success(`Org '${org.name}': ${tenantRoles} rôles tenant (Admin, Manager, Staff, Viewer)`);
    } else {
      warning(`Org '${org.name}': seulement ${tenantRoles} rôle(s) tenant`);
    }
  }

  results.push({
    name: 'Rôles tenant par org',
    passed: true,
    message: `${orgs.length} organisation(s) vérifiées`,
  });
}

async function validateInvariants() {
  header('6. Validation des Invariants');

  // Test 1: Vérifier qu'aucun tenant_user_role ne référence un rôle platform
  const invalidTenantRoles = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count
    FROM tenant_user_roles tur
    JOIN roles r ON tur.role_id = r.id
    WHERE r.org_id IS NULL;
  `;

  if (invalidTenantRoles[0].count === '0') {
    success('Aucun rôle platform dans tenant_user_roles');
    results.push({
      name: 'Invariant tenant_user_roles',
      passed: true,
      message: 'Aucun rôle platform',
    });
  } else {
    error(`${invalidTenantRoles[0].count} rôle(s) platform invalides dans tenant_user_roles`);
    results.push({
      name: 'Invariant tenant_user_roles',
      passed: false,
      message: `${invalidTenantRoles[0].count} rôles invalides`,
    });
  }

  // Test 2: Vérifier qu'aucun platform_user_role ne référence un rôle tenant
  const invalidPlatformRoles = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count
    FROM platform_user_roles pur
    JOIN roles r ON pur.role_id = r.id
    WHERE r.org_id IS NOT NULL;
  `;

  if (invalidPlatformRoles[0].count === '0') {
    success('Aucun rôle tenant dans platform_user_roles');
    results.push({
      name: 'Invariant platform_user_roles',
      passed: true,
      message: 'Aucun rôle tenant',
    });
  } else {
    error(`${invalidPlatformRoles[0].count} rôle(s) tenant invalides dans platform_user_roles`);
    results.push({
      name: 'Invariant platform_user_roles',
      passed: false,
      message: `${invalidPlatformRoles[0].count} rôles invalides`,
    });
  }

  // Test 3: Vérifier que tous les tenant_user_roles ont un membership
  const rolesWithoutMembership = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count
    FROM tenant_user_roles tur
    WHERE NOT EXISTS (
      SELECT 1 FROM org_users ou
      WHERE ou.user_id = tur.user_id AND ou.org_id = tur.org_id
    );
  `;

  if (rolesWithoutMembership[0].count === '0') {
    success('Tous les tenant_user_roles ont un membership correspondant');
    results.push({
      name: 'Invariant membership requis',
      passed: true,
      message: 'Tous les rôles ont un membership',
    });
  } else {
    error(`${rolesWithoutMembership[0].count} rôle(s) sans membership`);
    results.push({
      name: 'Invariant membership requis',
      passed: false,
      message: `${rolesWithoutMembership[0].count} rôles sans membership`,
    });
  }
}

// ================================================================
// Rapport final
// ================================================================

function printSummary() {
  header('Résumé de la Validation');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  log(`Total des tests: ${total}`, colors.blue);
  log(`✅ Réussis: ${passed}`, colors.green);
  log(`❌ Échoués: ${failed}`, failed > 0 ? colors.red : colors.green);

  if (failed > 0) {
    log('\nTests échoués:', colors.red);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  - ${r.name}: ${r.message}`, colors.red);
        if (r.details) {
          log(`    Détails: ${JSON.stringify(r.details)}`, colors.yellow);
        }
      });
  }

  log('\n' + '='.repeat(60), colors.cyan);

  if (failed === 0) {
    log('\n🎉 VALIDATION RÉUSSIE ! La migration STEP 1 est correcte.\n', colors.green);
    return true;
  } else {
    log('\n⚠️  VALIDATION ÉCHOUÉE ! Veuillez corriger les erreurs ci-dessus.\n', colors.red);
    return false;
  }
}

// ================================================================
// Main
// ================================================================

async function main() {
  log('\n🔍 Validation de la migration STEP 1 - Multi-tenant', colors.cyan);
  log('='.repeat(60) + '\n', colors.cyan);

  try {
    await validateTables();
    await validateConstraints();
    await validateTriggers();
    await validateDataMigration();
    await validateRoles();
    await validateInvariants();

    const success = printSummary();
    process.exit(success ? 0 : 1);
  } catch (error) {
    error(`\n❌ Erreur lors de la validation: ${error}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
