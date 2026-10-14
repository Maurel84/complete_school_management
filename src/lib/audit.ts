import { supabase } from './supabase';

interface AuditLogInput {
  schoolId: string;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordAuditLog({
  schoolId,
  userId,
  userName,
  userEmail,
  userRole,
  action,
  entityType,
  entityId,
  details = {},
}: AuditLogInput) {
  try {
    const enrichedDetails = {
      ...details,
      actor_name: userName || details.user_name || 'Utilisateur',
      actor_email: userEmail || details.user_email || '',
      actor_role: userRole || details.user_role || '',
      timestamp: new Date().toISOString(),
    };

    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      user_id: userId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: enrichedDetails,
    });
  } catch (error) {
    console.error('Unable to write audit log', error);
  }
}
