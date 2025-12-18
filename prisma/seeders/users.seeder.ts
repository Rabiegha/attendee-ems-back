import * as bcrypt from 'bcrypt';
import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface UserSeedData {
  email: string;
  password: string;
  roleCode: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  country?: string;
  metadata?: any;
  isActive?: boolean;
}

const usersData: UserSeedData[] = [
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
  {
    email: 'admin@attendee.fr',
    password: 'admin123',
    roleCode: 'ADMIN',
    first_name: 'Admin',
    last_name: 'Choyou',
    phone: '+33 6 12 34 56 78',
    company: 'Choyou',
    job_title: 'Administrator',
    country: 'France',
    metadata: {
      preferences: { theme: 'light', language: 'fr' }
    },
    isActive: true,
  },
];

export async function seedUsers(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    // Récupérer toutes les organisations
    const systemOrg = await prisma.organization.findUnique({
      where: { slug: 'system' }
    });
    const acmeOrg = await prisma.organization.findUnique({
      where: { slug: 'acme-corp' }
    });
    const choyouOrg = await prisma.organization.findUnique({
      where: { slug: 'choyou' }
    });
    
    if (!systemOrg || !acmeOrg || !choyouOrg) {
      throw new Error('Required organizations not found');
    }
    
    for (const userData of usersData) {
      // Déterminer l'organisation selon l'email
      let orgId: string;
      let orgName: string;
      if (userData.email.includes('@system.com')) {
        orgId = systemOrg.id;
        orgName = 'System';
      } else if (userData.email.includes('@attendee.fr')) {
        orgId = choyouOrg.id;
        orgName = 'Choyou';
      } else {
        orgId = acmeOrg.id;
        orgName = 'Acme Corp';
      }

      // Récupérer le rôle approprié pour cette organisation
      // SUPER_ADMIN est global (org_id = NULL), les autres sont spécifiques à l'org
      let role;
      if (userData.roleCode === 'SUPER_ADMIN') {
        role = await prisma.role.findFirst({
          where: {
            code: 'SUPER_ADMIN',
            org_id: null,
          }
        });
      } else {
        role = await prisma.role.findFirst({
          where: {
            code: userData.roleCode,
            org_id: orgId,
          }
        });
      }
      
      if (!role) {
        results.push({
          success: false,
          message: `Role '${userData.roleCode}' not found for organization ${orgId} for user '${userData.email}'`,
        });
        continue;
      }
      
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: userData.email,
          org_id: orgId,
        }
      });

      let user;
      if (existingUser) {
        user = await prisma.user.update({
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
            is_active: userData.isActive ?? true,
          },
        });
      } else {
        user = await prisma.user.create({
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
            is_active: userData.isActive ?? true,
          },
        });
      }

      results.push({
        success: true,
        message: `User '${user.email}' created/updated`,
        data: {
          ...user,
          password_hash: '[HIDDEN]', // Ne pas exposer le hash dans les logs
        },
      });
      
      logSuccess(`✓ User: ${user.email} in organization: ${orgName}`);
    }
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to seed users',
    };
    
    logError('Failed to seed users', error);
    results.push(errorResult);
    return results;
  }
}

// Fonction pour obtenir un utilisateur par email
export async function getUserByEmail(organizationId: string, email: string) {
  return await prisma.user.findFirst({
    where: {
      org_id: organizationId,
      email: email,
    },
  });
}
