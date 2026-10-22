/**
 * Service de Notification, SMS en Masse, WhatsApp Automatique et Routage Intelligent
 * Adapté pour la Côte d'Ivoire et l'Afrique de l'Ouest
 */

import { parsePhoneNumbers } from './utils';

export type SmsProvider = 'africastalking' | 'orange-ci' | 'generic' | 'simulation';
export type WhatsAppProvider = 'green-api' | 'twilio' | 'simulation';
export type BroadcastChannel = 'smart_mixed' | 'sms' | 'whatsapp_auto' | 'internal' | 'vcf';

export interface NotificationConfig {
  // SMS Gateway Config
  smsProvider: SmsProvider;
  smsApiKey: string;
  smsUsername: string; // Africa's Talking username (ex: sandbox ou live username)
  smsSenderId: string; // Ex: "HARPE-DAVID" ou "COCON-ANGRE" (max 11 caractères)
  smsEndpoint?: string; // URL personnalisée si passerelle générique
  
  // WhatsApp Gateway Config
  waProvider: WhatsAppProvider;
  waInstance: string;  // Green-API Instance ID
  waToken: string;     // Green-API Token
  
  // Modèles
  receiptText?: string;
}

export interface ParentBroadcastTarget {
  parent: {
    id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
  };
  children: Array<{
    id: string;
    first_name: string;
    last_name: string;
    matricule?: string;
    class_id?: string;
  }>;
  className?: string;
}

export interface BroadcastLogItem {
  id: string;
  recipientName: string;
  phone: string;
  channel: 'sms' | 'whatsapp' | 'internal';
  status: 'success' | 'error' | 'simulated';
  message: string;
  time: string;
}

export interface BroadcastProgressState {
  total: number;
  current: number;
  successCount: number;
  errorCount: number;
  currentContactName: string;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  logs: BroadcastLogItem[];
}

/**
 * Récupère la configuration des notifications (localStorage avec fallback)
 */
export function getNotificationConfig(schoolId?: string): NotificationConfig {
  let customSchoolConfig: any = {};
  if (typeof window !== 'undefined' && schoolId) {
    try {
      const stored = localStorage.getItem(`school_notifications_${schoolId}`);
      if (stored) customSchoolConfig = JSON.parse(stored);
    } catch {}
  }

  return {
    smsProvider: (customSchoolConfig.smsProvider || localStorage.getItem('sms_provider') || 'simulation') as SmsProvider,
    smsApiKey: customSchoolConfig.smsApiKey || localStorage.getItem('sms_api_key') || '',
    smsUsername: customSchoolConfig.smsUsername || localStorage.getItem('sms_username') || '',
    smsSenderId: customSchoolConfig.smsSenderId || localStorage.getItem('sms_sender_id') || 'ECOLE-INFO',
    smsEndpoint: customSchoolConfig.smsEndpoint || localStorage.getItem('sms_endpoint') || '',
    
    waProvider: (customSchoolConfig.waProvider || localStorage.getItem('wa_provider') || 'simulation') as WhatsAppProvider,
    waInstance: customSchoolConfig.waInstance || localStorage.getItem('wa_instance') || '',
    waToken: customSchoolConfig.waToken || localStorage.getItem('wa_token') || '',
    receiptText: customSchoolConfig.receiptText || localStorage.getItem('receipt_text') || '',
  };
}

/**
 * Sauvegarde la configuration des notifications
 */
export function saveNotificationConfig(config: NotificationConfig, schoolId?: string): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('sms_provider', config.smsProvider);
  localStorage.setItem('sms_api_key', config.smsApiKey);
  localStorage.setItem('sms_username', config.smsUsername);
  localStorage.setItem('sms_sender_id', config.smsSenderId);
  if (config.smsEndpoint) localStorage.setItem('sms_endpoint', config.smsEndpoint);

  localStorage.setItem('wa_provider', config.waProvider);
  localStorage.setItem('wa_instance', config.waInstance);
  localStorage.setItem('wa_token', config.waToken);
  if (config.receiptText) localStorage.setItem('receipt_text', config.receiptText);

  if (schoolId) {
    localStorage.setItem(`school_notifications_${schoolId}`, JSON.stringify(config));
  }
}

/**
 * Formate un numéro de téléphone en format international E.164 (+225...)
 * Adapté pour la Côte d'Ivoire (10 chiffres) et les formats internationaux
 */
export function formatInternationalPhone(rawPhone: string): { e164: string; digitsOnly: string; isValid: boolean } {
  if (!rawPhone) return { e164: '', digitsOnly: '', isValid: false };

  // Retirer espaces, parenthèses, tirets, slashs
  let cleaned = rawPhone.trim().replace(/[\s\-\.\(\)\/]/g, '');

  // Supprimer tout texte accidentel
  cleaned = cleaned.replace(/^(tel|cel|wa|phone|contact)\s*:\s*/i, '');

  if (!cleaned) return { e164: '', digitsOnly: '', isValid: false };

  // Retirer le + pour analyse des chiffres
  let digits = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;

  // Format ivoirien standard : 10 chiffres débutant par 01, 05, 07 ou 25, 27
  // Ex: 0709176869 -> 2250709176869
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `225${digits}`;
  } else if (digits.length === 8) {
    // Ancien format 8 chiffres de CI -> préfixe
    digits = `225${digits}`;
  }

  const e164 = `+${digits}`;
  const isValid = digits.length >= 8 && digits.length <= 15 && /^\d+$/.test(digits);

  return { e164, digitsOnly: digits, isValid };
}

/**
 * Analyse un contact parent pour déterminer le meilleur canal (Routage Intelligent)
 */
export function classifyParentContact(target: ParentBroadcastTarget): {
  parentName: string;
  hasWhatsApp: boolean;
  smsPhone: string;
  waPhone: string;
  preferredChannel: 'whatsapp' | 'sms';
} {
  const p = target.parent;
  const parentName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Parent d’élève';
  const parsed = parsePhoneNumbers(p.phone || '');

  const mainClean = formatInternationalPhone(parsed.mainPhone || p.phone || '');
  const waClean = formatInternationalPhone(parsed.whatsappPhone || '');

  // Un parent a WhatsApp si son numéro WhatsApp est explicitement renseigné ou s'il s'agit d'un numéro unique
  const hasWhatsApp = waClean.isValid;
  const preferredChannel: 'whatsapp' | 'sms' = (!parsed.isSingleNumber && waClean.isValid) ? 'whatsapp' : 'sms';

  return {
    parentName,
    hasWhatsApp,
    smsPhone: mainClean.e164 || waClean.e164,
    waPhone: waClean.digitsOnly || mainClean.digitsOnly,
    preferredChannel,
  };
}

/**
 * Envoi d'un SMS unitaire via le fournisseur sélectionné
 */
export async function sendSingleSms(
  phone: string,
  message: string,
  config: NotificationConfig
): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const formatted = formatInternationalPhone(phone);
  if (!formatted.isValid) {
    return { success: false, error: `Numéro de téléphone invalide (${phone})` };
  }

  // 1. Mode Simulation
  if (config.smsProvider === 'simulation' || !config.smsApiKey) {
    await new Promise(resolve => setTimeout(resolve, 120)); // délai réaliste
    return {
      success: true,
      simulated: true,
      messageId: `SIM-SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
  }

  // 2. Africa's Talking API
  if (config.smsProvider === 'africastalking') {
    try {
      const isSandbox = (config.smsUsername || '').toLowerCase() === 'sandbox';
      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const formData = new URLSearchParams();
      formData.append('username', config.smsUsername || 'sandbox');
      formData.append('to', formatted.e164);
      formData.append('message', message);
      if (config.smsSenderId && config.smsSenderId !== 'ECOLE-INFO') {
        formData.append('from', config.smsSenderId);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apiKey': config.smsApiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, error: `Africa's Talking HTTP ${res.status}: ${errorText}` };
      }

      const data = await res.json();
      return { success: true, messageId: data?.SMSMessageData?.Recipients?.[0]?.messageId || 'SENT' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau Africa\'s Talking' };
    }
  }

  // 3. Orange SMS API (Côte d'Ivoire)
  if (config.smsProvider === 'orange-ci') {
    try {
      const senderAddress = config.smsSenderId ? `tel:+225${config.smsSenderId}` : 'tel:+2250000000000';
      const endpoint = config.smsEndpoint || 'https://api.orange.com/smsmessaging/v1/outbound/tel:+2250000000000/requests';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.smsApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: `tel:${formatted.e164}`,
            senderAddress,
            outboundSMSTextMessage: { message },
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Orange SMS HTTP ${res.status}: ${errText}` };
      }

      return { success: true, messageId: `ORANGE-${Date.now()}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau Orange SMS' };
    }
  }

  // 4. Passerelle SMS Universelle (Webhook / REST)
  if (config.smsProvider === 'generic' && config.smsEndpoint) {
    try {
      const res = await fetch(config.smsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.smsApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: formatted.e164,
          message,
          sender: config.smsSenderId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { success: true, messageId: `GENERIC-${Date.now()}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur passerelle SMS générique' };
    }
  }

  return { success: false, error: 'Fournisseur SMS non configuré ou inconnu' };
}

/**
 * Envoi d'un message WhatsApp unitaire automatique via Green-API ou simulation
 */
export async function sendSingleWhatsApp(
  phone: string,
  message: string,
  config: NotificationConfig
): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  const formatted = formatInternationalPhone(phone);
  if (!formatted.isValid) {
    return { success: false, error: `Numéro WhatsApp invalide (${phone})` };
  }

  // Mode Simulation
  if (config.waProvider === 'simulation' || !config.waToken || !config.waInstance) {
    await new Promise(resolve => setTimeout(resolve, 140));
    return {
      success: true,
      simulated: true,
      messageId: `SIM-WA-${Date.now()}`,
    };
  }

  // Green-API
  if (config.waProvider === 'green-api') {
    try {
      const chatId = `${formatted.digitsOnly}@c.us`;
      const url = `https://api.green-api.com/waInstance${config.waInstance}/sendMessage/${config.waToken}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Green-API HTTP ${res.status}: ${text}` };
      }

      const data = await res.json();
      return { success: true, messageId: data?.idMessage || 'SENT' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur Green-API' };
    }
  }

  return { success: false, error: 'Fournisseur WhatsApp non configuré' };
}

/**
 * Moteur d'envoi groupé avec Routage Intelligent et progression en direct
 */
export async function executeSmartBroadcast({
  targets,
  message,
  channel,
  config,
  onProgress,
  checkCancelled,
}: {
  targets: ParentBroadcastTarget[];
  message: string;
  channel: BroadcastChannel;
  config: NotificationConfig;
  onProgress: (state: BroadcastProgressState) => void;
  checkCancelled?: () => boolean;
}): Promise<BroadcastProgressState> {
  const logs: BroadcastLogItem[] = [];
  let successCount = 0;
  let errorCount = 0;

  const total = targets.length;
  const state: BroadcastProgressState = {
    total,
    current: 0,
    successCount: 0,
    errorCount: 0,
    currentContactName: '',
    status: 'running',
    logs,
  };

  onProgress({ ...state });

  for (let i = 0; i < targets.length; i++) {
    if (checkCancelled && checkCancelled()) {
      state.status = 'cancelled';
      onProgress({ ...state });
      break;
    }

    const target = targets[i];
    const classified = classifyParentContact(target);
    state.current = i + 1;
    state.currentContactName = classified.parentName;

    let targetChannel: 'sms' | 'whatsapp' = 'sms';
    let targetPhone = classified.smsPhone;

    if (channel === 'whatsapp_auto') {
      targetChannel = 'whatsapp';
      targetPhone = classified.waPhone;
    } else if (channel === 'sms') {
      targetChannel = 'sms';
      targetPhone = classified.smsPhone;
    } else if (channel === 'smart_mixed') {
      // Routage intelligent : si parent a un WhatsApp valide -> WhatsApp, sinon SMS
      if (classified.hasWhatsApp && config.waInstance && config.waToken) {
        targetChannel = 'whatsapp';
        targetPhone = classified.waPhone;
      } else {
        targetChannel = 'sms';
        targetPhone = classified.smsPhone;
      }
    }

    let result: { success: boolean; simulated?: boolean; messageId?: string; error?: string };

    if (targetChannel === 'whatsapp') {
      result = await sendSingleWhatsApp(targetPhone, message, config);
    } else {
      result = await sendSingleSms(targetPhone, message, config);
    }

    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (result.success) {
      successCount++;
      state.successCount = successCount;
      logs.unshift({
        id: `log-${Date.now()}-${i}`,
        recipientName: classified.parentName,
        phone: targetPhone,
        channel: targetChannel,
        status: result.simulated ? 'simulated' : 'success',
        message: result.simulated ? 'Envoyé (Mode Simulation démo)' : 'Délivré avec succès',
        time: now,
      });
    } else {
      errorCount++;
      state.errorCount = errorCount;
      logs.unshift({
        id: `log-${Date.now()}-${i}`,
        recipientName: classified.parentName,
        phone: targetPhone,
        channel: targetChannel,
        status: 'error',
        message: result.error || 'Échec de distribution',
        time: now,
      });
    }

    onProgress({ ...state });
    // Pause légère de 100ms entre chaque envoi pour fluidité et anti-blocage
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  state.status = state.status === 'cancelled' ? 'cancelled' : 'completed';
  state.currentContactName = '';
  onProgress({ ...state });
  return state;
}

/**
 * Générateur de fichier vCard (.vcf) conforme aux standards internationaux vCard 3.0
 * Permet l'import direct des contacts parents dans le smartphone pour créer des Listes de diffusion WhatsApp
 */
export function generateVCardContacts(
  targets: ParentBroadcastTarget[],
  schoolName = 'Établissement Scolaire'
): string {
  const lines: string[] = [];

  targets.forEach((target, index) => {
    const p = target.parent;
    const classified = classifyParentContact(target);
    const childrenNames = target.children.map(c => `${c.first_name} ${c.last_name}`).join(', ');
    const className = target.className || (target.children[0] as any)?.class?.name || 'École';

    // Nom formaté affiché : [CP1] Nom Prénom (Parent de Élève)
    const displayName = `[${className}] ${classified.parentName}${childrenNames ? ` (${childrenNames})` : ''}`;
    const lastName = p.last_name || 'Parent';
    const firstName = p.first_name || '';

    lines.push('BEGIN:VCARD');
    lines.push('VERSION:3.0');
    lines.push(`FN:${displayName.replace(/[;\n]/g, ' ')}`);
    lines.push(`N:${lastName.replace(/[;\n]/g, ' ')};${firstName.replace(/[;\n]/g, ' ')};;;`);
    lines.push(`ORG:${schoolName.replace(/[;\n]/g, ' ')}`);
    lines.push(`TITLE:Parent d'élève - ${className.replace(/[;\n]/g, ' ')}`);

    if (classified.smsPhone) {
      lines.push(`TEL;TYPE=CELL,VOICE:${classified.smsPhone}`);
    }
    if (classified.waPhone) {
      const waE164 = formatInternationalPhone(classified.waPhone).e164;
      lines.push(`TEL;TYPE=CELL,PREF:${waE164 || classified.smsPhone}`);
    }
    if (p.email) {
      lines.push(`EMAIL;TYPE=HOME,INTERNET:${p.email.trim()}`);
    }
    if (childrenNames) {
      lines.push(`NOTE:Élève(s) inscrit(s): ${childrenNames} | Classe: ${className}`);
    }

    lines.push('END:VCARD');
  });

  return lines.join('\r\n');
}

/**
 * Déclenche le téléchargement du fichier vCard (.vcf) dans le navigateur
 */
export function downloadVCardFile(vcardContent: string, fileName = 'contacts_parents_diffusion.vcf'): void {
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
