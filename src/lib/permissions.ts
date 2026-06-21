export const PERMISSIONS = {
  PNL_VIEW: "pnl.view",
  PNL_UPLOAD: "pnl.upload",
  PNL_ANALYZE: "pnl.analyze",
  COMPANIES_VIEW: "companies.view",
  COMPANIES_MANAGE: "companies.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
  SYSTEM_SETTINGS: "system.settings",
  SYSTEM_AUDIT: "system.audit",
  EXPENSES_CATEGORIES: "expenses.categories",
  PREPAID_VIEW: "prepaid.view",
  PREPAID_MANAGE: "prepaid.manage",
  FORECASTS_VIEW: "forecasts.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<Permission, string> = {
  "pnl.view": "عرض الأرباح والخسائر",
  "pnl.upload": "رفع بيانات P&L",
  "pnl.analyze": "تحليل P&L",
  "companies.view": "عرض الشركات",
  "companies.manage": "إدارة الشركات",
  "users.view": "عرض المستخدمين",
  "users.manage": "إدارة المستخدمين",
  "roles.view": "عرض الأدوار",
  "roles.manage": "إدارة الأدوار",
  "system.settings": "إعدادات النظام",
  "system.audit": "سجل التدقيق",
  "expenses.categories": "تصنيفات المصروفات",
  "prepaid.view": "عرض المصروفات المقدمة",
  "prepaid.manage": "إدارة المصروفات المقدمة",
  "forecasts.view": "عرض التنبؤات",
};

export function hasPermission(
  userPermissions: string[],
  permission: Permission
): boolean {
  return userPermissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: string[],
  permissions: Permission[]
): boolean {
  return permissions.some((p) => userPermissions.includes(p));
}
