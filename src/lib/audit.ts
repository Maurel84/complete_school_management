import { supabase } from './supabase';

interface AuditLogInput {
  schoolId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAuditLog({
  schoolId,
  userId,
  action,
  entityType,
  entityId,
  details = {},
}: AuditLogInput) {
  try {
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      user_id: userId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details,
    });
  } catch (error) {
    console.error('Unable to write audit log', error);
  }
}
