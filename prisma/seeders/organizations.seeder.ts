import { v4 as uuidv4 } from 'uuid';
import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface OrganizationSeedData {
  name: string;
  slug: string;
  timezone: string;
}

const organizationsData: OrganizationSeedData[] = [
  {
    name: 'System',
    slug: 'system',
    timezone: 'UTC',
  },
  {
    name: 'Acme Corp',
    slug: 'acme-corp',
    timezone: 'UTC',
  },
  {
    name: 'Choyou',
    slug: 'choyou',
    timezone: 'Europe/Paris',
  },
];

export async function seedOrganizations(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const orgData of organizationsData) {
      const orgId = uuidv4();
      
      const organization = await prisma.organization.upsert({
        where: { slug: orgData.slug },
        update: {},
        create: {
          id: orgId,
          name: orgData.name,
          slug: orgData.slug,
          timezone: orgData.timezone,
        },
      });

      results.push({
        success: true,
        message: `Organization '${organization.name}' created/updated`,
        data: organization,
      });
      
      logSuccess(`Created organization: ${organization.name}`);
    }
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to seed organizations',
    };
    
    logError('Failed to seed organizations', error);
    results.push(errorResult);
    return results;
  }
}

// Fonction pour obtenir une organisation par slug (utile pour les autres seeders)
export async function getOrganizationBySlug(slug: string) {
  return await prisma.organization.findUnique({
    where: { slug },
  });
}
