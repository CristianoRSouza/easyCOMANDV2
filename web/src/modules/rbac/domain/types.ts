export type RbacScope = "global" | "company" | "store";
export type OverrideEffect = "grant" | "deny";

export interface RbacModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: string;
  is_active: boolean;
  permission_count?: number;
}

export interface RbacPermission {
  id: string;
  key: string;
  module_key: string | null;
  scope: RbacScope;
  description: string | null;
  is_active: boolean;
  role_count?: number;
}

export interface RbacRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: RbacScope;
  is_system: boolean;
  permission_ids: string[];
  permission_keys: string[];
}

export interface RbacAssignment {
  id: string;
  user_id: string;
  role_id: string;
  company_id: string | null;
  store_id: string | null;
  created_at: string;
  role: { id: string; key: string; name: string; scope: RbacScope };
  user: { id: string; email: string | null; full_name: string | null };
  company?: { id: string; name: string | null } | null;
  store?: { id: string; trade_name: string | null } | null;
}

export interface RbacOverride {
  id: string;
  user_id: string;
  permission_id: string;
  company_id: string | null;
  store_id: string | null;
  effect: OverrideEffect;
  permission: { id: string; key: string; scope: RbacScope };
}

export interface RbacAuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
  created_at: string;
  actor?: { email: string | null; full_name: string | null } | null;
}

export const PERMISSION_KEY_REGEX = /^[a-z0-9_]+(\.[a-z0-9_*]+)+$|^\*$/;