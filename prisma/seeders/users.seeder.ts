import * as bcrypt from 'bcrypt';
import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface UserSeedData {
  email: string;
  password: string;
  roleCode: string;
  isActive?: boolean;
}

const usersData: UserSeedData[] = [
  {
    email: 'admin@acme-corp.com',
    password: 'admin123',
    roleCode: 'org_admin',
    isActive: true,
  },
  {
    email: 'user@acme-corp.com',
    password: 'user123',
    roleCode: 'user',
    isActive: true,
  },
  // Vous pouvez ajouter d'autres utilisateurs ici
];

export async function seedUsers(organizationId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    // Récupérer tous les rôles de l'organisation pour les mapper
    const roles = await prisma.role.findMany({
      where: { org_id: organizationId },
    });
    
    const roleMap = new Map(roles.map(role => [role.code, role.id]));
    
    for (const userData of usersData) {
      const roleId = roleMap.get(userData.roleCode);
      
      if (!roleId) {
        results.push({
          success: false,
          message: `Role '${userData.roleCode}' not found for user '${userData.email}'`,
        });
        continue;
      }
      
      let user = await prisma.user.findFirst({
        where: {
          org_id: organizationId,
          email: userData.email
        }
      });
      
      if (!user) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        user = await prisma.user.create({
          data: {
            org_id: organizationId,
            email: userData.email,
            password_hash: hashedPassword,
            role_id: roleId,
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
      
      logSuccess(`Created user: ${user.email}`);
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
    include: {
      role: true,
    },
  });
}

// Fonction pour obtenir tous les utilisateurs d'une organisation
export async function getUsersByOrganization(organizationId: string) {
  return await prisma.user.findMany({
    where: {
      org_id: organizationId,
    },
    include: {
      role: true,
    },
  });
}
