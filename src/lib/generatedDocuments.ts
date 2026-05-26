import { supabase } from './supabase';
import { sanitizeDocumentName } from './printableDocuments';

interface SaveGeneratedDocumentInput {
  schoolId: string;
  entityType: string;
  entityId: string;
  documentType: string;
  title: string;
  baseFileName: string;
  html: string;
  uploadedBy?: string;
}

export async function saveGeneratedDocument({
  schoolId,
  entityType,
  entityId,
  documentType,
  title,
  baseFileName,
  html,
  uploadedBy,
}: SaveGeneratedDocumentInput) {
  const fileName = `${sanitizeDocumentName(baseFileName) || 'document'}.html`;
  const path = `${schoolId}/${entityType}/${entityId}/${fileName}`;
  const file = new Blob([html], { type: 'text/html;charset=utf-8' });

  const { error: uploadError } = await supabase.storage.from('school-documents').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: 'text/html',
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('school-documents').getPublicUrl(path);
  const fileUrl = data.publicUrl;

  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('school_id', schoolId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('document_type', documentType)
    .eq('title', title)
    .maybeSingle();

  const payload = {
    school_id: schoolId,
    entity_type: entityType,
    entity_id: entityId,
    document_type: documentType,
    title,
    file_url: fileUrl,
    file_size: file.size,
    uploaded_by: uploadedBy || null,
  };

  if (existing?.id) {
    await supabase.from('documents').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('documents').insert(payload);
  }

  return { fileUrl, fileSize: file.size, path };
}
