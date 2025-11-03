/**
 * Script pour créer un template de badge par défaut
 * À exécuter pour résoudre l'erreur "No badge template found"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createDefaultBadgeTemplate() {
  console.log('🚀 Creating default badge template...');

  try {
    // 1. Récupérer la première organisation pour avoir l'org_id
    const organization = await prisma.organization.findFirst();
    
    if (!organization) {
      console.error('❌ No organization found. Please create an organization first.');
      return;
    }

    console.log(`📋 Using organization: ${organization.name} (${organization.id})`);

    // 2. Vérifier s'il existe déjà un template par défaut
    const existingTemplate = await prisma.badgeTemplate.findFirst({
      where: {
        org_id: organization.id,
        is_default: true,
      },
    });

    if (existingTemplate) {
      console.log(`✅ Default badge template already exists: ${existingTemplate.name}`);
      return existingTemplate;
    }

    // 3. HTML simple pour un badge basique
    const simpleHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 360px;
            height: 560px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            color: white;
            box-sizing: border-box;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .event-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .badge-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: center;
        }
        .attendee-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 15px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .attendee-email {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        .attendee-type {
            font-size: 16px;
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 30px;
        }
        .qr-section {
            text-align: center;
            background: white;
            padding: 15px;
            border-radius: 10px;
            margin: 20px auto 0;
            width: 120px;
        }
        .qr-code {
            width: 100px;
            height: 100px;
            margin: 0 auto;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #666;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="event-title">{{event_name}}</div>
    </div>
    
    <div class="badge-content">
        <div class="attendee-name">{{full_name}}</div>
        <div class="attendee-email">{{email}}</div>
        <div class="attendee-type">{{attendee_type}}</div>
    </div>
    
    <div class="qr-section">
        <div class="qr-code">
            QR CODE
        </div>
    </div>
    
    <div class="footer">
        Event Management System
    </div>
</body>
</html>`;

    // 4. CSS correspondant (optionnel, déjà inclus dans le HTML)
    const simpleCss = `
/* CSS is included in the HTML above for simplicity */
body {
    margin: 0;
    padding: 20px;
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    width: 360px;
    height: 560px;
    color: white;
}`;

    // 5. Variables utilisées dans le template
    const variables = [
      'event_name',
      'full_name', 
      'first_name',
      'last_name',
      'email',
      'phone',
      'attendee_type',
      'organization_name'
    ];

    // 6. Créer le template
    const newTemplate = await prisma.badgeTemplate.create({
      data: {
        org_id: organization.id,
        code: 'default-badge-template',
        name: 'Template de Badge par Défaut',
        description: 'Template de badge simple avec dégradé bleu et informations de base',
        html: simpleHtml,
        css: simpleCss,
        width: 400,
        height: 600,
        variables: variables,
        is_default: true,
        is_active: true,
        template_data: {
          // Données GrapesJS basiques pour compatibilité
          version: '1.0',
          type: 'simple-badge',
          created_by: 'system'
        }
      }
    });

    console.log(`✅ Default badge template created successfully!`);
    console.log(`   - ID: ${newTemplate.id}`);
    console.log(`   - Name: ${newTemplate.name}`);
    console.log(`   - Code: ${newTemplate.code}`);
    console.log(`   - Organization: ${organization.name}`);

    return newTemplate;

  } catch (error) {
    console.error('❌ Error creating default badge template:', error);
    throw error;
  }
}

async function main() {
  try {
    await createDefaultBadgeTemplate();
    console.log('🎉 Script completed successfully!');
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

export { createDefaultBadgeTemplate };