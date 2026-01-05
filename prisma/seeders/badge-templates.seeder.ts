import { PrismaClient } from '@prisma/client';

export async function seedBadgeTemplates(prisma: PrismaClient) {
  console.log('📋 Seeding badge templates...');

  // Get the first organization for seeding
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    console.log('⚠️  No organization found, skipping badge templates seeding');
    return;
  }

  // Get the first user for created_by (STEP 1: Multi-tenant)
  const user = await prisma.user.findFirst({
    where: {
      orgMemberships: {
        some: {
          org_id: organization.id
        }
      }
    }
  });

  const templates = [
    {
      org_id: organization.id,
      code: 'default-portrait',
      name: 'Badge Portrait Standard',
      description: 'Template portrait classique avec photo, nom et entreprise',
      html: `<div style="width: 400px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: Arial, sans-serif;">
        <div style="position: absolute; top: 40px; text-align: center;">
          <h1 style="font-size: 28px; margin: 0; font-weight: bold;">ÉVÉNEMENT</h1>
        </div>
        <div style="background: white; border-radius: 50%; width: 120px; height: 120px; margin: 20px 0; display: flex; align-items: center; justify-content: center;">
          <div style="color: #667eea; font-size: 48px;">👤</div>
        </div>
        <div style="text-align: center; margin: 20px;">
          <h2 style="font-size: 24px; margin: 10px 0; font-weight: bold;">{{firstName}} {{lastName}}</h2>
          <p style="font-size: 16px; margin: 5px 0; opacity: 0.9;">{{company}}</p>
          <p style="font-size: 14px; margin: 5px 0; opacity: 0.8;">{{jobTitle}}</p>
        </div>
        <div style="position: absolute; bottom: 40px; text-align: center;">
          <div style="background: white; padding: 10px; border-radius: 8px;">
            <div style="color: #667eea; font-size: 12px;">QR Code</div>
          </div>
        </div>
      </div>`,
      css: `
        .badge-container {
          width: 400px;
          height: 600px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: Arial, sans-serif;
        }
      `,
      width: 400,
      height: 600,
      template_data: {
        version: '1.0',
        elements: [
          {
            id: 'header',
            type: 'text',
            content: 'ÉVÉNEMENT',
            x: 200,
            y: 40,
            fontSize: 28,
            fontWeight: 'bold',
            textAlign: 'center'
          },
          {
            id: 'avatar',
            type: 'image',
            x: 200,
            y: 180,
            width: 120,
            height: 120,
            borderRadius: '50%'
          },
          {
            id: 'name',
            type: 'text',
            content: '{{firstName}} {{lastName}}',
            x: 200,
            y: 320,
            fontSize: 24,
            fontWeight: 'bold',
            textAlign: 'center'
          },
          {
            id: 'company',
            type: 'text',
            content: '{{company}}',
            x: 200,
            y: 350,
            fontSize: 16,
            textAlign: 'center'
          },
          {
            id: 'job-title',
            type: 'text',
            content: '{{jobTitle}}',
            x: 200,
            y: 375,
            fontSize: 14,
            textAlign: 'center'
          },
          {
            id: 'qr-code',
            type: 'qr',
            x: 200,
            y: 520,
            width: 80,
            height: 80
          }
        ]
      },
      variables: ['firstName', 'lastName', 'company', 'jobTitle', 'eventName'],
      is_default: true,
      is_active: true,
      created_by: user?.id
    },
    {
      org_id: organization.id,
      code: 'landscape-modern',
      name: 'Badge Paysage Moderne',
      description: 'Template paysage avec design moderne et épuré',
      html: `<div style="width: 600px; height: 400px; background: #f8fafc; position: relative; display: flex; align-items: center; padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 2px solid #e2e8f0;">
        <div style="flex: 1;">
          <div style="color: #1a365d; font-size: 32px; font-weight: bold; margin-bottom: 10px;">{{firstName}} {{lastName}}</div>
          <div style="color: #4a5568; font-size: 18px; margin-bottom: 5px;">{{company}}</div>
          <div style="color: #718096; font-size: 16px; margin-bottom: 20px;">{{jobTitle}}</div>
          <div style="color: #2d3748; font-size: 14px; font-weight: 600;">{{eventName}}</div>
        </div>
        <div style="flex-shrink: 0; text-align: center;">
          <div style="background: #667eea; color: white; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48px; margin-bottom: 20px;">👤</div>
          <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="color: #4a5568; font-size: 12px;">QR Code</div>
          </div>
        </div>
      </div>`,
      css: `
        .badge-landscape {
          width: 600px;
          height: 400px;
          background: #f8fafc;
          position: relative;
          display: flex;
          align-items: center;
          padding: 40px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          border: 2px solid #e2e8f0;
        }
      `,
      width: 600,
      height: 400,
      template_data: {
        version: '1.0',
        elements: [
          {
            id: 'name',
            type: 'text',
            content: '{{firstName}} {{lastName}}',
            x: 40,
            y: 120,
            fontSize: 32,
            fontWeight: 'bold',
            color: '#1a365d'
          },
          {
            id: 'company',
            type: 'text',
            content: '{{company}}',
            x: 40,
            y: 160,
            fontSize: 18,
            color: '#4a5568'
          },
          {
            id: 'job-title',
            type: 'text',
            content: '{{jobTitle}}',
            x: 40,
            y: 185,
            fontSize: 16,
            color: '#718096'
          },
          {
            id: 'event-name',
            type: 'text',
            content: '{{eventName}}',
            x: 40,
            y: 225,
            fontSize: 14,
            fontWeight: '600',
            color: '#2d3748'
          },
          {
            id: 'avatar',
            type: 'image',
            x: 460,
            y: 80,
            width: 100,
            height: 100,
            borderRadius: '50%'
          },
          {
            id: 'qr-code',
            type: 'qr',
            x: 485,
            y: 220,
            width: 50,
            height: 50
          }
        ]
      },
      variables: ['firstName', 'lastName', 'company', 'jobTitle', 'eventName'],
      is_default: false,
      is_active: true,
      created_by: user?.id
    },
    {
      org_id: organization.id,
      code: 'minimal-badge',
      name: 'Badge Minimaliste',
      description: 'Design épuré et minimaliste pour événements professionnels',
      html: `<div style="width: 350px; height: 500px; background: white; position: relative; border: 1px solid #000; color: #000; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="border-bottom: 3px solid #000; padding: 20px; text-align: center;">
          <h1 style="font-size: 18px; margin: 0; font-weight: 300; letter-spacing: 2px;">{{eventName}}</h1>
        </div>
        <div style="padding: 40px 20px; text-align: center;">
          <div style="width: 80px; height: 80px; border: 2px solid #000; border-radius: 50%; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 36px;">👤</div>
          </div>
          <h2 style="font-size: 24px; margin: 0 0 10px 0; font-weight: 400;">{{firstName}} {{lastName}}</h2>
          <p style="font-size: 14px; margin: 0 0 5px 0; color: #666;">{{company}}</p>
          <p style="font-size: 12px; margin: 0; color: #999;">{{jobTitle}}</p>
        </div>
        <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);">
          <div style="width: 60px; height: 60px; border: 1px solid #000; display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 10px;">QR</div>
          </div>
        </div>
      </div>`,
      css: `
        .badge-minimal {
          width: 350px;
          height: 500px;
          background: white;
          position: relative;
          border: 1px solid #000;
          color: #000;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }
      `,
      width: 350,
      height: 500,
      template_data: {
        version: '1.0',
        elements: [
          {
            id: 'event-header',
            type: 'text',
            content: '{{eventName}}',
            x: 175,
            y: 40,
            fontSize: 18,
            fontWeight: '300',
            letterSpacing: '2px',
            textAlign: 'center'
          },
          {
            id: 'avatar',
            type: 'shape',
            x: 175,
            y: 140,
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '2px solid #000'
          },
          {
            id: 'name',
            type: 'text',
            content: '{{firstName}} {{lastName}}',
            x: 175,
            y: 250,
            fontSize: 24,
            fontWeight: '400',
            textAlign: 'center'
          },
          {
            id: 'company',
            type: 'text',
            content: '{{company}}',
            x: 175,
            y: 280,
            fontSize: 14,
            color: '#666',
            textAlign: 'center'
          },
          {
            id: 'job-title',
            type: 'text',
            content: '{{jobTitle}}',
            x: 175,
            y: 300,
            fontSize: 12,
            color: '#999',
            textAlign: 'center'
          },
          {
            id: 'qr-code',
            type: 'qr',
            x: 175,
            y: 420,
            width: 60,
            height: 60
          }
        ]
      },
      variables: ['firstName', 'lastName', 'company', 'jobTitle', 'eventName'],
      is_default: false,
      is_active: true,
      created_by: user?.id
    }
  ];

  for (const template of templates) {
    await prisma.badgeTemplate.upsert({
      where: { 
        org_id_code: { 
          org_id: template.org_id, 
          code: template.code 
        } 
      },
      update: template,
      create: template,
    });
  }

  console.log(`✅ Created ${templates.length} badge templates`);
}