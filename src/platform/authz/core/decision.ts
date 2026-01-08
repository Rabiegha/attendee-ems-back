export enum DecisionCode {
  // Success
  OK = 'OK',

  // Context errors
  NO_TENANT_CONTEXT = 'NO_TENANT_CONTEXT',             // currentOrgId manquant
  NOT_TENANT_MEMBER = 'NOT_TENANT_MEMBER',             // User pas membre de l'org
  PLATFORM_TENANT_ACCESS_DENIED = 'PLATFORM_TENANT_ACCESS_DENIED', // Platform user sans accès à cette org

  // Permission errors
  MISSING_PERMISSION = 'MISSING_PERMISSION',           // Permission non accordée
  SCOPE_DENIED = 'SCOPE_DENIED',                       // Scope insuffisant (ex: own mais pas owner)

  // Module gating
  MODULE_DISABLED = 'MODULE_DISABLED',                 // Module désactivé pour l'org

  // Hierarchy errors
  HIERARCHY_VIOLATION = 'HIERARCHY_VIOLATION', // ← NOUVEAU
}

export interface Decision {
  allowed: boolean;
  code: DecisionCode;
  details?: {
    reason?: string;
    requiredPermission?: string;
    actualScope?: ScopeLimit;
    requiredScope?: ScopeLimit;
    [key: string]: any;
  };
}

export class DecisionHelper {
  static allow(): Decision {
    return { allowed: true, code: DecisionCode.OK };
  }

  static deny(code: DecisionCode, details?: Decision['details']): Decision {
    return { allowed: false, code, details };
  }
}