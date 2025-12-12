# 📧 Système d'Emails Centralisé - Documentation

## 🎯 Vue d'ensemble

Système d'envoi d'emails centralisé et scalable utilisant **nodemailer** et **SMTP OVH**, avec architecture modulaire pour faciliter l'ajout de nouveaux types d'emails.

---

## 📁 Architecture

```
src/modules/email/
├── email.module.ts          # Module NestJS exportable
├── email.service.ts         # Service centralisé d'envoi
└── templates/
    ├── invitation.template.ts          # Template email d'invitation
    └── password-reset.template.ts      # Template mot de passe oublié
    └── (futurs templates...)
```

---

## ⚙️ Configuration

### Variables d'environnement requises (.env)

```env
# Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@domain.com
SMTP_FROM_NAME=EMS Platform

# Frontend URL (pour les liens dans les emails)
FRONTEND_URL=https://your-domain.com
```

---

## 🚀 Fonctionnalités implémentées

### 1. **Module Email centralisé**

**Service**: `EmailService`
- ✅ Configuration SMTP depuis variables d'environnement
- ✅ Gestion de l'activation/désactivation via `EMAIL_ENABLED`
- ✅ Logs détaillés pour le débogage
- ✅ Méthode générique `sendEmail()` pour emails personnalisés
- ✅ Méthodes spécialisées pour chaque type d'email

### 2. **Réinitialisation de mot de passe** (✅ Implémenté)

**Endpoints API:**

```typescript
POST /password/request-reset
Body: { email: string, org_id: string }
Response: { message: string }
```

```typescript
POST /password/validate-token
Body: { token: string }
Response: { valid: boolean, email: string }
```

```typescript
POST /password/reset
Body: { token: string, newPassword: string }
Response: { message: string }
```

**Processus:**
1. Utilisateur demande la réinitialisation (`/request-reset`)
2. Backend génère un token sécurisé (SHA-256) valable **1 heure**
3. Email envoyé avec lien `{FRONTEND_URL}/reset-password/{token}`
4. Utilisateur clique, frontend valide le token (`/validate-token`)
5. Utilisateur définit nouveau mot de passe (`/reset`)
6. Tous les refresh tokens sont révoqués (force la reconnexion)

**Sécurité:**
- ✅ Tokens hashés en SHA-256 dans la DB
- ✅ Expiration automatique après 1h
- ✅ Protection contre l'énumération d'emails (toujours retourne 200)
- ✅ Révocation des tokens après utilisation
- ✅ Révocation de tous les refresh tokens existants

### 3. **Email d'invitation** (✅ Migrable)

Le système d'invitation existant peut être migré vers `EmailService`:

```typescript
// Ancienne approche (invitation.service.ts)
private async sendInvitationEmail(...) { }

// Nouvelle approche (via EmailService)
await this.emailService.sendInvitationEmail({
  email: invitation.email,
  invitationUrl: '...',
  organizationName: '...',
  roleName: '...'
});
```

---

## 📝 Templates d'emails

### Template de base (HTML responsive)

Tous les templates incluent:
- ✅ Design moderne avec dégradés de couleurs
- ✅ Responsive (mobile-friendly)
- ✅ Call-to-action (bouton) prominent
- ✅ Lien alternatif (fallback si bouton ne marche pas)
- ✅ Warnings visuels (expiration, sécurité)
- ✅ Footer avec branding EMS

### Couleurs par type d'email

| Type               | Gradient                      | Usage                     |
|--------------------|-------------------------------|---------------------------|
| Invitation         | `#667eea` → `#764ba2` (violet)| Inviter un utilisateur    |
| Password Reset     | `#f093fb` → `#f5576c` (rose)  | Réinitialiser mot de passe|
| Event Reminder     | `#4facfe` → `#00f2fe` (bleu)  | (À implémenter)           |
| Welcome            | `#43e97b` → `#38f9d7` (vert)  | (À implémenter)           |

---

## 🔄 Utilisation dans d'autres modules

### Importer le module

```typescript
// Dans votre-module.module.ts
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  // ...
})
export class VotreModule {}
```

### Injecter le service

```typescript
// Dans votre-service.service.ts
import { EmailService } from '../email/email.service';

@Injectable()
export class VotreService {
  constructor(private emailService: EmailService) {}

  async faireQuelqueChose() {
    await this.emailService.sendEmail({
      to: 'user@example.com',
      subject: 'Titre de l\'email',
      html: '<h1>Contenu HTML</h1>',
    });
  }
}
```

---

## 🎨 Créer un nouveau template

```typescript
// src/modules/email/templates/mon-nouveau-type.template.ts
export const MonNouveauTypeEmailTemplate = (params: {
  param1: string;
  param2: string;
}): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${params.param1}</title>
    </head>
    <body>
      <!-- Votre template HTML -->
    </body>
    </html>
  `;
};
```

```typescript
// Ajouter dans email.service.ts
async sendMonNouveauType(params: { ... }): Promise<boolean> {
  const html = MonNouveauTypeEmailTemplate(params);
  return this.sendEmail({
    to: params.email,
    subject: 'Titre',
    html,
  });
}
```

---

## 🧪 Tests

### Test de connexion SMTP

```bash
# Via l'API (à implémenter)
GET /email/verify-connection
```

### Test en développement

```typescript
// email.service.ts
if (!this.emailEnabled) {
  this.logger.warn('Email service is DISABLED');
  // Logs uniquement, pas d'envoi
}
```

---

## 📋 Checklist futurs types d'emails

- [ ] **Rappel d'événement** (X jours avant)
- [ ] **Confirmation d'inscription** (événement)
- [ ] **Badge prêt** (notification avec lien de téléchargement)
- [ ] **Changement de statut** (inscription approuvée/refusée)
- [ ] **Résumé post-événement** (statistiques, remerciements)
- [ ] **Newsletter** (actualités organisation)
- [ ] **Invitation événement** (pour participants externes)

---

## 🔐 Sécurité

### Bonnes pratiques implémentées

1. ✅ **Tokens cryptographiques** : `crypto.randomBytes(32)` + SHA-256
2. ✅ **Expiration courte** : 1h pour password reset, 48h pour invitations
3. ✅ **Protection timing attacks** : toujours retourner 200 OK
4. ✅ **Révocation automatique** : tokens à usage unique
5. ✅ **HTTPS obligatoire** : liens sécurisés uniquement
6. ✅ **Rate limiting** : (à implémenter si besoin)

### Recommandations

- ⚠️ Ajouter rate limiting sur `/password/request-reset` (max 3 tentatives/h)
- ⚠️ Logger les tentatives de réinitialisation suspectes
- ⚠️ Envisager 2FA pour les comptes sensibles

---

## 📊 Métriques & Monitoring

### Logs disponibles

```typescript
✅ Email sent successfully to user@example.com
❌ Failed to send email to user@example.com: [error]
📧 [DISABLED] Would send email to user@example.com
[Password Reset] Email sent to user@example.com
```

### Monitoring Sentry (déjà configuré)

Les erreurs d'envoi d'email sont automatiquement capturées par Sentry.

---

## 🚧 Migration du système actuel

### Étape 1: Migrer invitation.service.ts

```typescript
// invitation.service.ts - Ajouter injection
constructor(
  private prisma: PrismaService,
  private emailService: EmailService, // ← Nouveau
) {}

// Remplacer sendInvitationEmail()
private async sendInvitationEmail(...) {
  return this.emailService.sendInvitationEmail({
    email,
    invitationUrl,
    organizationName,
    roleName,
  });
}

// Supprimer this.transporter (plus nécessaire)
```

### Étape 2: Nettoyer le code

- Supprimer `nodemailer` setup dans `invitation.service.ts`
- Garder uniquement la logique métier (génération token, DB)
- Déléguer l'envoi au `EmailService`

---

## 📚 Ressources

- [Nodemailer Documentation](https://nodemailer.com/)
- [OVH SMTP Configuration](https://docs.ovh.com/fr/emails/)
- [NestJS Modules](https://docs.nestjs.com/modules)
- [Email Templates Best Practices](https://www.emailonacid.com/blog/)

---

**Auteur**: EMS Team  
**Dernière mise à jour**: 11 Décembre 2025  
**Version**: 1.0.0
