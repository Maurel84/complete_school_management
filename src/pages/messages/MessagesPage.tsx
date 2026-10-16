import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime, parsePhoneNumbers, formatCombinedPhone } from '../../lib/utils';
import { resolveTeacherClass, resolveParentChildren } from '../../lib/roleDataResolver';
import type { Message, Profile, Student, Class, Parent } from '../../types';
import {
  Mail,
  Plus,
  Send,
  Megaphone,
  MessageSquare,
  Phone,
  Search,
  Users,
  CheckCircle,
  ExternalLink,
  MessageCircle,
  Save,
  Check,
  Shield,
  Building,
  GraduationCap,
  Sparkles,
  Copy,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

function cleanPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  let p = rawPhone.replace(/[^\d+]/g, '');
  if (p.startsWith('00')) {
    p = p.substring(2);
  } else if (p.startsWith('+')) {
    p = p.substring(1);
  } else if (p.length === 10 || p.length === 8) {
    p = `225${p}`; // Default West Africa / Cote d'Ivoire prefix
  }
  return p;
}

export default function MessagesPage() {
  const { school } = useApp();
  const { profile, isTeacher, isParent, isAdmin, isDirector, isSuperAdmin, role } = useAuth();

  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const isParentUser = isParent || role === 'parent' || (profile?.role as any)?.name === 'parent' || profile?.account_type === 'parent';
  const isAdminUser = isAdmin || isDirector || isSuperAdmin || role === 'admin' || role === 'director' || role === 'super_admin';

  const [messages, setMessages] = useState<(Message & { sender?: Profile })[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherClass, setTeacherClass] = useState<Class | null>(null);
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<{ id: string; label: string; roleDescription: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'parents' (Parent Communication Suite), 'inbox', 'sent', 'announcements'
  // PARENT MUST NEVER DEFAULT TO 'parents' TAB!
  const [tab, setTab] = useState<'parents' | 'inbox' | 'sent' | 'announcements'>(isParentUser ? 'inbox' : 'parents');

  // Enforce zero access for parents to the parents directory tab
  useEffect(() => {
    if (isParentUser && tab === 'parents') {
      setTab('inbox');
    }
  }, [isParentUser, tab]);

  // Internal Messaging State
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { sender?: Profile }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ recipient_id: '', subject: '', content: '', is_announcement: false });

  // Parent Communication State
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [searchParent, setSearchParent] = useState('');
  const [customMsgModal, setCustomMsgModal] = useState(false);
  const [activeParentTarget, setActiveParentTarget] = useState<any | null>(null);
  const [messageChannel, setMessageChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [parentMessageContent, setParentMessageContent] = useState('');

  // Editable Contact Fields in Modal
  const [contactMainPhone, setContactMainPhone] = useState('');
  const [contactWhatsappPhone, setContactWhatsappPhone] = useState('');
  const [contactIsSingleNumber, setContactIsSingleNumber] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaveNotice, setContactSaveNotice] = useState<string | null>(null);

  // Broadcast / Message Groupé State
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastTargetScope, setBroadcastTargetScope] = useState<'all' | string>('all');
  const [broadcastChannel, setBroadcastChannel] = useState<'whatsapp' | 'sms' | 'internal'>('whatsapp');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);
  const [broadcastCopiedNotice, setBroadcastCopiedNotice] = useState(false);

  useEffect(() => {
    if (school) fetchData();
  }, [school, profile]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    try {
      // 1. Fetch messages
      const msgPromise = supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('school_id', sid)
        .order('created_at', { ascending: false });

      // 2. Fetch classes
      const clsPromise = supabase
        .from('classes')
        .select('*')
        .eq('school_id', sid)
        .order('name');

      // 3. Fetch staff and teachers
      const staffPromise = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role:roles(name)');

      const teachersPromise = supabase
        .from('teachers')
        .select('id, user_id, first_name, last_name, specialty, teacher_subjects(class_id, class:classes(name))')
        .eq('school_id', sid);

      const [msgRes, clsRes, staffRes, teachRes] = await Promise.all([
        msgPromise,
        clsPromise,
        staffPromise,
        teachersPromise,
      ]);

      const loadedClasses = (clsRes.data as Class[]) || [];
      setMessages((msgRes.data as any[]) || []);
      setClasses(loadedClasses);

      // Build recipients list
      const staffList = (staffRes.data || []) as any[];
      const teachList = (teachRes.data || []) as any[];
      const recList: { id: string; label: string; roleDescription: string }[] = [];

      // Direction / Admin
      staffList.forEach(s => {
        const rName = s.role?.name || '';
        if (['admin', 'director', 'super_admin', 'supervisor'].includes(rName)) {
          recList.push({
            id: s.id,
            label: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Direction & Secrétariat',
            roleDescription: rName === 'director' ? 'Direction de l’école' : rName === 'supervisor' ? 'Vie Scolaire' : 'Administration',
          });
        }
      });

      // Teachers
      teachList.forEach(t => {
        const userProfile = staffList.find(s => s.id === t.user_id || (t.email && s.email === t.email));
        const targetId = userProfile ? userProfile.id : t.id;
        const assignedClass = t.teacher_subjects?.[0]?.class?.name || t.specialty || 'Enseignant';
        recList.push({
          id: targetId,
          label: `M./Mme ${t.last_name} ${t.first_name}`,
          roleDescription: `Enseignant (${assignedClass})`,
        });
      });

      setAvailableRecipients(recList);

      // 4. Role specific data loading
      if (isParentUser) {
        const { children: pChildren } = await resolveParentChildren(sid, profile);
        setParentChildren(pChildren);
        setStudents(pChildren);
        setParents([]); // Zero external parents loaded for parents!
      } else if (isTeacherUser) {
        const { assignedClass } = await resolveTeacherClass(sid, profile, loadedClasses);
        setTeacherClass(assignedClass);

        if (assignedClass) {
          const [stRes, parRes] = await Promise.all([
            supabase
              .from('students')
              .select('id, first_name, last_name, matricule, class_id, class:classes(name), student_parents(parent:parents(*))')
              .eq('school_id', sid)
              .eq('class_id', assignedClass.id)
              .order('last_name'),
            supabase.from('parents').select('*').eq('school_id', sid).order('last_name'),
          ]);
          setStudents(stRes.data || []);
          setParents((parRes.data as Parent[]) || []);
        }
      } else {
        // Admin / Director: load full roster
        const [stuRes, parRes] = await Promise.all([
          supabase
            .from('students')
            .select('id, first_name, last_name, matricule, class_id, class:classes(name), student_parents(parent:parents(*))')
            .eq('school_id', sid)
            .order('last_name'),
          supabase.from('parents').select('*').eq('school_id', sid).order('last_name'),
        ]);
        setStudents(stuRes.data || []);
        setParents((parRes.data as Parent[]) || []);
      }
    } catch (e) {
      console.error('Error fetching messaging data', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInternal() {
    if (!form.content.trim()) return;
    setSaving(true);
    try {
      let targetRecipient = form.recipient_id;

      // If parent chose "direction" or empty recipient, assign to first admin/direction profile
      if (targetRecipient === 'direction' || (!targetRecipient && !form.is_announcement)) {
        const adminRec = availableRecipients.find(r =>
          r.roleDescription.toLowerCase().includes('admin') ||
          r.roleDescription.toLowerCase().includes('direction') ||
          r.roleDescription.toLowerCase().includes('école')
        );
        targetRecipient = adminRec ? adminRec.id : (availableRecipients[0]?.id || profile!.id);
      }

      await supabase.from('messages').insert({
        school_id: school!.id,
        sender_id: profile!.id,
        recipient_id: form.is_announcement ? null : targetRecipient,
        subject: form.subject.trim() || (form.is_announcement ? 'Annonce générale' : 'Message interne'),
        content: form.content.trim(),
        is_announcement: form.is_announcement,
        is_read: false,
      });

      setComposeOpen(false);
      setForm({ recipient_id: '', subject: '', content: '', is_announcement: false });
      void fetchData();
    } catch (err: any) {
      alert("Erreur lors de l'envoi du message : " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function markAsRead(msg: Message) {
    await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
    void fetchData();
  }

  // Compile list of parent contacts with linked children & classes
  const parentDirectory = useMemo(() => {
    // STRICT DATA PRIVACY: Parents NEVER see other parents!
    if (isParentUser) {
      return [];
    }

    const map = new Map<string, { parent: Parent; children: any[]; className: string }>();

    students.forEach(st => {
      // If teacher user, lock strictly to teacher's assigned class (e.g. CP1)
      if (isTeacherUser && teacherClass && st.class_id !== teacherClass.id) {
        return;
      }

      const parentLinks = st.student_parents || [];
      parentLinks.forEach((pl: any) => {
        const par = pl.parent;
        if (!par) return;

        if (!map.has(par.id)) {
          map.set(par.id, {
            parent: par,
            children: [],
            className: st.class?.name || '',
          });
        }
        map.get(par.id)!.children.push(st);
      });
    });

    if (isAdminUser) {
      parents.forEach(p => {
        if (!map.has(p.id)) {
          map.set(p.id, {
            parent: p,
            children: [],
            className: '',
          });
        }
      });
    }

    return Array.from(map.values());
  }, [students, parents, isParentUser, isTeacherUser, teacherClass, isAdminUser]);

  // Filter directory
  const filteredParents = useMemo(() => {
    return parentDirectory.filter(item => {
      const matchClass =
        !selectedClassFilter || item.children.some(c => c.class_id === selectedClassFilter);
      const searchTerms = `${item.parent.first_name} ${item.parent.last_name} ${item.parent.phone} ${item.parent.email} ${item.children
        .map(c => `${c.first_name} ${c.last_name} ${c.matricule}`)
        .join(' ')}`.toLowerCase();
      const matchSearch = !searchParent || searchTerms.includes(searchParent.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [parentDirectory, selectedClassFilter, searchParent]);

  // Parent Message Actions
  function openParentMessage(item: any, defaultChannel: 'whatsapp' | 'sms' | 'email' = 'whatsapp') {
    setActiveParentTarget(item);
    setMessageChannel(defaultChannel);

    const parsed = parsePhoneNumbers(item.parent.phone || '');
    setContactMainPhone(parsed.mainPhone);
    setContactWhatsappPhone(parsed.whatsappPhone);
    setContactIsSingleNumber(parsed.isSingleNumber);
    setContactEmail(item.parent.email || '');
    setContactSaveNotice(null);

    const childName = item.children[0] ? `${item.children[0].first_name} ${item.children[0].last_name}` : 'votre enfant';
    const text = `Bonjour M./Mme ${item.parent.last_name || ''},\n\nNous vous contactons depuis l'établissement ${school?.name || 'Groupe Scolaire'} concernant ${childName}.\n\nMessage : \n\nCordialement,\nLa Direction`;
    setParentMessageContent(text);
    setCustomMsgModal(true);
  }

  async function handleSaveParentContact() {
    if (!activeParentTarget?.parent?.id) return;
    setSavingContact(true);
    setContactSaveNotice(null);
    try {
      const combinedPhone = formatCombinedPhone(contactMainPhone, contactWhatsappPhone, contactIsSingleNumber);
      const { error } = await supabase
        .from('parents')
        .update({
          phone: combinedPhone,
          email: contactEmail.trim(),
        })
        .eq('id', activeParentTarget.parent.id);

      if (error) throw error;

      // Update in-memory objects
      activeParentTarget.parent.phone = combinedPhone;
      activeParentTarget.parent.email = contactEmail.trim();
      setParents(prev =>
        prev.map(p =>
          p.id === activeParentTarget.parent.id
            ? { ...p, phone: combinedPhone, email: contactEmail.trim() }
            : p
        )
      );
      setContactSaveNotice('Numéro enregistré dans la fiche du parent !');
      setTimeout(() => setContactSaveNotice(null), 3500);
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setSavingContact(false);
    }
  }

  function applyParentTemplate(type: 'reunion' | 'absence' | 'info' | 'felicitations') {
    if (!activeParentTarget) return;
    const par = activeParentTarget.parent;
    const child = activeParentTarget.children[0];
    const childName = child ? `${child.first_name} ${child.last_name}` : 'votre enfant';
    const className = child?.class?.name || '';

    if (type === 'reunion') {
      setParentMessageContent(
        `CONVOCATION / RÉUNION DE PARENTS D'ÉLÈVES\n\nCher(e) parent ${par.first_name} ${par.last_name},\nVous êtes cordialement invité(e) à prendre part à la rencontre parents-enseignants pour la classe de ${childName} (${className}).\n\nVotre présence est vivement souhaitée.\n\nLa Direction - ${school?.name || 'Groupe Scolaire'}`
      );
    } else if (type === 'absence') {
      setParentMessageContent(
        `AVIS D'ABSENCE SCOLAIRE\n\nBonjour M./Mme ${par.last_name},\nNous constatons avec regret l'absence en classe de ${childName} ce jour.\n\nMerci de bien vouloir justifier cette absence dans les plus brefs délais auprès de la vie scolaire.\n\n${school?.name || 'Groupe Scolaire'}`
      );
    } else if (type === 'info') {
      setParentMessageContent(
        `NOTE D'INFORMATION AUX PARENTS D'ÉLÈVES\n\nChers parents d'élèves de ${school?.name || 'notre établissement'},\nNous vous informons de la tenue prochaine d'un événement important dans notre école.\n\nMerci pour votre fidélité et votre collaboration.\n\nLa Direction`
      );
    } else if (type === 'felicitations') {
      setParentMessageContent(
        `FÉLICITATIONS DU CONSEIL DES MAÎTRES\n\nCher parent de ${childName},\nNous avons le plaisir de vous féliciter pour le travail remarquable et l'assiduité exemplaire de votre enfant pour cette période scolaire.\n\nContinuez à l'encourager dans cette belle voie !\n\nL'Équipe Pédagogique - ${school?.name || 'Groupe Scolaire'}`
      );
    }
  }

  function handleSendParentMessage() {
    if (!activeParentTarget) return;

    // Auto-sync in background if phone was modified in input
    const combinedPhone = formatCombinedPhone(contactMainPhone, contactWhatsappPhone, contactIsSingleNumber);
    if (activeParentTarget.parent?.id && combinedPhone && combinedPhone !== activeParentTarget.parent.phone) {
      void supabase
        .from('parents')
        .update({ phone: combinedPhone, email: contactEmail.trim() })
        .eq('id', activeParentTarget.parent.id)
        .then(() => {
          activeParentTarget.parent.phone = combinedPhone;
          activeParentTarget.parent.email = contactEmail.trim();
        });
    }

    const targetWaNumber = contactIsSingleNumber ? contactMainPhone : (contactWhatsappPhone || contactMainPhone);
    const targetSmsNumber = contactMainPhone;

    if (messageChannel === 'whatsapp') {
      const waClean = cleanPhone(targetWaNumber);
      if (!waClean) {
        alert('Numéro WhatsApp du parent manquant. Veuillez saisir le numéro dans le champ WhatsApp.');
        return;
      }
      const url = `https://wa.me/${waClean}?text=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    } else if (messageChannel === 'sms') {
      const smsClean = cleanPhone(targetSmsNumber);
      if (!smsClean) {
        alert('Numéro SMS / Téléphone du parent manquant.');
        return;
      }
      const url = `sms:${smsClean}?body=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    } else if (messageChannel === 'email') {
      const emailToUse = contactEmail.trim() || activeParentTarget.parent.email;
      const url = `mailto:${emailToUse || ''}?subject=${encodeURIComponent(
        `Information École - ${school?.name || 'Groupe Scolaire'}`
      )}&body=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    }

    setCustomMsgModal(false);
  }

  function openBroadcastModal() {
    const defaultScope = isTeacherUser && teacherClass ? teacherClass.id : 'all';
    setBroadcastTargetScope(defaultScope);
    setBroadcastChannel('whatsapp');
    setBroadcastNotice(null);
    setBroadcastCopiedNotice(false);

    const schoolName = school?.name || 'Groupe Scolaire';
    const targetLabel = isTeacherUser && teacherClass ? `la classe de ${teacherClass.name}` : "l'établissement";
    setBroadcastSubject(`Information Importante — ${schoolName}`);
    setBroadcastContent(
      `NOTE D'INFORMATION AUX PARENTS D'ÉLÈVES — ${schoolName}\n\nChers parents d'élèves de ${targetLabel},\n\nNous vous informons de la tenue prochaine d'un événement important dans notre école.\n\nMerci pour votre constante collaboration et votre engagement aux côtés de l'équipe pédagogique.\n\nCordialement,\nLa Direction`
    );
    setBroadcastModalOpen(true);
  }

  function applyBroadcastTemplate(type: 'reunion' | 'rentree' | 'finances' | 'fermeture' | 'fete') {
    const schoolName = school?.name || 'Groupe Scolaire';
    const targetLabel = isTeacherUser && teacherClass ? `la classe de ${teacherClass.name}` : "l'établissement";

    if (type === 'reunion') {
      setBroadcastSubject(`Convocation : Assemblée Générale des Parents d'Élèves`);
      setBroadcastContent(
        `CONVOCATION / ASSEMBLÉE GÉNÉRALE DES PARENTS D'ÉLÈVES\n\nChers parents d'élèves de ${targetLabel},\n\nNous avons l'honneur de vous convier à la réunion générale des parents d'élèves qui se tiendra dans l'enceinte de l'école.\n\nOrdre du jour :\n1. Bilan d'étape et projet pédagogique\n2. Suivi scolaire et portails numériques (notes, scolarités)\n3. Calendrier des évaluations et divers\n\nVotre présence est vivement souhaitée pour la réussite de nos apprenants.\n\nLa Direction — ${schoolName}`
      );
    } else if (type === 'rentree') {
      setBroadcastSubject(`Rentrée Scolaire & Horaires des Cours`);
      setBroadcastContent(
        `AVIS DE RENTRÉE SCOLAIRE — ${schoolName}\n\nChers parents,\n\nNous vous souhaitons la bienvenue pour cette nouvelle rentrée scolaire. Les cours débutent tous les matins dès 07h45 (montée des couleurs à 07h30).\n\nNous vous prions de veiller au port strict de la tenue scolaire réglementaire et à la ponctualité de vos enfants.\n\nBonne et fructueuse année scolaire !\nLa Direction`
      );
    } else if (type === 'finances') {
      setBroadcastSubject(`Rappel : Échéance des frais de scolarité`);
      setBroadcastContent(
        `AVIS IMPORTANT / COMPTABILITÉ — ${schoolName}\n\nChers parents d'élèves,\n\nNous vous rappelons que l'échéance des frais de scolarité arrive à terme selon le calendrier officiel.\n\nNous vous prions de bien vouloir régulariser la situation auprès de la caisse ou par paiement Mobile Money afin de garantir la continuité pédagogique.\n\nMerci pour votre fidélité et votre diligence.\nLe Service Comptabilité`
      );
    } else if (type === 'fermeture') {
      setBroadcastSubject(`Information : Congés scolaires et arrêt des cours`);
      setBroadcastContent(
        `NOTE D'INFORMATION AUX FAMILLES — ${schoolName}\n\nChers parents,\n\nNous vous informons de l'arrêt temporaire des cours conformément au calendrier officiel du Ministère de l'Éducation Nationale.\n\nLa reprise effective des cours aura lieu le matin à 07h45.\n\nNous souhaitons un excellent repos à tous nos élèves.\nLa Direction`
      );
    } else if (type === 'fete') {
      setBroadcastSubject(`Invitation : Cérémonie d'Excellence et Fête de l'École`);
      setBroadcastContent(
        `GRANDE FÊTE DE L'ÉCOLE & CÉRÉMONIE DE L'EXCELLENCE — ${schoolName}\n\nChers parents d'élèves,\n\nVous êtes chaleureusement conviés à prendre part à la grande fête de fin d'année et à la remise des prix d'excellence récompensant le travail remarquable de nos élèves.\n\nVenez nombreux célébrer le mérite de nos enfants !\nL'Équipe de Direction`
      );
    }
  }

  // Targeted parents for the broadcast
  const targetedBroadcastParents = useMemo(() => {
    if (isParentUser) return [];
    if (isTeacherUser && teacherClass) {
      return parentDirectory.filter(item => item.children.some(c => c.class_id === teacherClass.id));
    }
    if (broadcastTargetScope === 'all') {
      return parentDirectory;
    }
    return parentDirectory.filter(item => item.children.some(c => c.class_id === broadcastTargetScope));
  }, [parentDirectory, isParentUser, isTeacherUser, teacherClass, broadcastTargetScope]);

  // Clean phone numbers list
  const broadcastPhonesList = useMemo(() => {
    const set = new Set<string>();
    targetedBroadcastParents.forEach(item => {
      const p = item.parent;
      const parsed = parsePhoneNumbers(p.phone || '');
      const num = parsed.whatsappPhone || parsed.mainPhone || p.phone;
      const clean = cleanPhone(num);
      if (clean) set.add(clean);
    });
    return Array.from(set);
  }, [targetedBroadcastParents]);

  async function handleExecuteBroadcast() {
    if (!broadcastContent.trim()) {
      alert('Veuillez saisir le contenu du message à diffuser.');
      return;
    }

    if (broadcastChannel === 'internal') {
      setBroadcastSending(true);
      try {
        const scopeLabel = broadcastTargetScope === 'all' ? 'Toutes les familles' : classes.find(c => c.id === broadcastTargetScope)?.name || 'Classe';
        await supabase.from('messages').insert({
          school_id: school!.id,
          sender_id: profile!.id,
          recipient_id: null,
          subject: broadcastSubject.trim() || `Information aux Familles (${scopeLabel})`,
          content: broadcastContent.trim(),
          is_announcement: true,
          is_read: false,
        });
        setBroadcastNotice(`✅ Annonce interne publiée avec succès pour ${targetedBroadcastParents.length} parents !`);
        setTimeout(() => {
          setBroadcastModalOpen(false);
          setBroadcastNotice(null);
          void fetchData();
        }, 2000);
      } catch (err: any) {
        alert("Erreur lors de la diffusion de l'annonce : " + err.message);
      } finally {
        setBroadcastSending(false);
      }
    } else if (broadcastChannel === 'sms') {
      if (broadcastPhonesList.length === 0) {
        alert('Aucun numéro de téléphone valide trouvé pour la sélection ciblée.');
        return;
      }
      const smsUri = `sms:${broadcastPhonesList.join(',')}?body=${encodeURIComponent(broadcastContent)}`;
      window.open(smsUri, '_blank');
      setBroadcastNotice(`Application SMS ouverte pour ${broadcastPhonesList.length} destinataires.`);
    } else if (broadcastChannel === 'whatsapp') {
      if (broadcastPhonesList.length === 0) {
        alert('Aucun numéro WhatsApp trouvé pour les parents ciblés.');
        return;
      }
      navigator.clipboard?.writeText(broadcastPhonesList.join(', '));
      const firstNum = broadcastPhonesList[0];
      const waUri = `https://wa.me/${firstNum}?text=${encodeURIComponent(broadcastContent)}`;
      window.open(waUri, '_blank');
      setBroadcastNotice(`Numéros copiés dans le presse-papier (${broadcastPhonesList.length} numéros). WhatsApp ouvert.`);
    }
  }

  function handleCopyAllNumbers() {
    if (broadcastPhonesList.length === 0) return;
    const txt = broadcastPhonesList.join('; ');
    navigator.clipboard?.writeText(txt);
    setBroadcastCopiedNotice(true);
    setTimeout(() => setBroadcastCopiedNotice(false), 3000);
  }

  const inbox = messages.filter(m => m.recipient_id === profile?.id && !m.is_announcement);
  const sent = messages.filter(m => m.sender_id === profile?.id && !m.is_announcement);
  const announcements = messages.filter(m => m.is_announcement);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="display-font text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="text-emerald-600" size={26} />
            {isParentUser
              ? 'Messagerie Famille & Établissement'
              : isTeacherUser
              ? `Communications & Messages • ${teacherClass?.name || 'CP1'}`
              : 'Communications & Messages'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isParentUser
              ? 'Échangez directement avec la Direction et les enseignants de vos enfants en toute confidentialité'
              : isTeacherUser
              ? `Messagerie interne et contact direct avec les parents de votre classe (${teacherClass?.name || 'CP1'})`
              : 'Envoi de messages WhatsApp, SMS et e-mails aux parents & messagerie interne'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setForm({
                recipient_id: isParentUser ? 'direction' : availableRecipients[0]?.id || '',
                subject: '',
                content: '',
                is_announcement: false,
              });
              setComposeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-xs transition"
          >
            <Plus size={16} /> {isParentUser ? "Écrire à l'école / aux enseignants" : "Nouveau message interne"}
          </button>

          {!isParentUser && (
            <button
              onClick={() => openBroadcastModal()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-xs transition"
            >
              <Megaphone size={16} />
              {isTeacherUser ? `Message Groupé aux Parents (${teacherClass?.name || 'CP1'})` : 'Message Groupé aux Parents (1 clic)'}
            </button>
          )}

          {isAdminUser && (
            <button
              onClick={() => {
                setForm({ recipient_id: '', subject: '', content: '', is_announcement: true });
                setComposeOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 shadow-xs transition"
            >
              <Megaphone size={16} /> Annonce générale
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        {!isParentUser && (
          <button
            onClick={() => setTab('parents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === 'parents'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <MessageCircle size={15} />
            <span>
              {isTeacherUser
                ? `Parents de ma classe (${teacherClass?.name || 'CP1'})`
                : 'Communication Parents (WhatsApp / SMS / Mail)'}
            </span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-200">
              {parentDirectory.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            tab === 'inbox'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Mail size={15} />
          <span>Boîte de réception</span>
          {inbox.filter(m => !m.is_read).length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px]">
              {inbox.filter(m => !m.is_read).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            tab === 'sent'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Send size={15} />
          <span>Envoyés</span>
        </button>

        <button
          onClick={() => setTab('announcements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            tab === 'announcements'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Megaphone size={15} />
          <span>Annonces {isParentUser ? "de l'école" : ''}</span>
        </button>
      </div>

      {/* TAB 1: PARENT COMMUNICATION SUITE (EXCLUDED FOR PARENTS) */}
      {tab === 'parents' && !isParentUser && (
        <div className="space-y-4">
          {/* Teacher context banner */}
          {isTeacherUser && teacherClass && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="font-bold">Espace Enseignante • Classe de {teacherClass.name}</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Accès strictement restreint aux {filteredParents.length} familles des élèves de votre classe.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-blue-200/60 text-blue-800 rounded-lg font-bold text-[11px]">
                {filteredParents.length} Parents rattachés
              </span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {isAdminUser && (
                <div>
                  <select
                    value={selectedClassFilter}
                    onChange={e => setSelectedClassFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">Tous les parents (Toutes classes)</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        Parents de {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par parent, élève ou N°..."
                value={searchParent}
                onChange={e => setSearchParent(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs w-72 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Parents Directory Table */}
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-wider">
                    <th className="px-4 py-3.5">Parent / Tuteur</th>
                    <th className="px-4 py-3.5">Contact (Téléphone & Mail)</th>
                    <th className="px-4 py-3.5">Élève(s) rattaché(s)</th>
                    <th className="px-4 py-3.5">Classe</th>
                    <th className="px-4 py-3.5 text-right">Actions rapides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParents.map((item, idx) => {
                    const par = item.parent;
                    const parsed = parsePhoneNumbers(par.phone || '');
                    const mainClean = cleanPhone(parsed.mainPhone);
                    const waClean = cleanPhone(parsed.isSingleNumber ? parsed.mainPhone : (parsed.whatsappPhone || parsed.mainPhone));

                    return (
                      <tr key={par.id || idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-900 text-sm">
                            {par.last_name} {par.first_name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {par.profession || 'Parent d’élève'}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          {par.phone ? (
                            <div className="space-y-1">
                              {parsed.isSingleNumber ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 font-mono text-xs">
                                    {parsed.mainPhone}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                                    <Phone size={10} />
                                    <MessageCircle size={10} />
                                    Unique
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-slate-800 font-mono text-xs">
                                    <Phone size={11} className="text-blue-600" />
                                    <span>{parsed.mainPhone || '-'}</span>
                                  </div>
                                  {parsed.whatsappPhone && (
                                    <div className="flex items-center gap-1 text-emerald-700 font-mono text-xs font-semibold">
                                      <MessageCircle size={11} className="text-emerald-600" />
                                      <span>WA: {parsed.whatsappPhone}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500">{par.email || '-'}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-400 italic">Non renseigné</span>
                              <p className="text-[11px] text-slate-500">{par.email || '-'}</p>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {item.children.length > 0 ? (
                            <div className="space-y-1">
                              {item.children.map(c => (
                                <p key={c.id} className="font-medium text-slate-800">
                                  {c.last_name} {c.first_name} ({c.matricule})
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Aucun élève lié</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {item.children.map(c => c.class?.name).filter(Boolean).join(', ') || '-'}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openParentMessage(item, 'whatsapp')}
                              title="Envoyer un message WhatsApp"
                              disabled={!waClean}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition border border-emerald-200 disabled:opacity-40"
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              onClick={() => openParentMessage(item, 'sms')}
                              title="Envoyer un SMS"
                              disabled={!mainClean}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition border border-blue-200 disabled:opacity-40"
                            >
                              <Phone size={13} />
                              <span>SMS</span>
                            </button>

                            <button
                              onClick={() => openParentMessage(item, 'email')}
                              title="Envoyer un E-mail"
                              disabled={!par.email}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition disabled:opacity-40"
                            >
                              <Mail size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2, 3, 4: INTERNAL MESSAGING */}
      {tab !== 'parents' && (
        <div className="space-y-2">
          {(tab === 'inbox' ? inbox : tab === 'sent' ? sent : announcements).length === 0 ? (
            <div className="surface-card p-12 text-center text-slate-400">
              <Mail size={40} className="mx-auto mb-3 text-slate-300" />
              <p>Aucun message dans cette boîte</p>
            </div>
          ) : (
            (tab === 'inbox' ? inbox : tab === 'sent' ? sent : announcements).map(msg => (
              <div
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (!msg.is_read && msg.recipient_id === profile?.id) void markAsRead(msg);
                }}
                className={`p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition ${
                  !msg.is_read && msg.recipient_id === profile?.id ? 'border-l-4 border-l-blue-600 bg-blue-50/20' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {msg.is_announcement && <Megaphone size={14} className="text-teal-600" />}
                      <p className="text-sm font-bold text-slate-900">{msg.subject || '(Sans objet)'}</p>
                      {!msg.is_read && msg.recipient_id === profile?.id && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">{msg.content}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {msg.sender?.first_name} {msg.sender?.last_name} • {formatDateTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Parent Custom Message (WhatsApp / SMS / Mail) */}
      <Modal
        isOpen={customMsgModal}
        onClose={() => setCustomMsgModal(false)}
        title="Envoyer un message au parent"
        size="md"
        actions={
          <>
            <button
              onClick={() => setCustomMsgModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleSendParentMessage}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition flex items-center gap-2 ${
                messageChannel === 'whatsapp'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : messageChannel === 'sms'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <Send size={14} /> Ouvrir & Envoyer ({messageChannel.toUpperCase()})
            </button>
          </>
        }
      >
        {activeParentTarget && (
          <div className="space-y-4">
            {/* Target Summary & Editable Contacts */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3.5 text-xs text-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200/60 pb-2.5">
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {activeParentTarget.parent.first_name} {activeParentTarget.parent.last_name}
                  </p>
                  {activeParentTarget.children[0] && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Élève : <strong>{activeParentTarget.children[0].first_name} {activeParentTarget.children[0].last_name}</strong> (Classe: {activeParentTarget.children[0].class?.name || '-'})
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveParentContact}
                    disabled={savingContact}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs"
                    title="Enregistrer les modifications directement dans la fiche du parent"
                  >
                    <Save size={13} />
                    <span>{savingContact ? 'Enregistrement...' : 'Enregistrer dans fiche parent'}</span>
                  </button>
                </div>
              </div>

              {contactSaveNotice && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600" />
                  {contactSaveNotice}
                </div>
              )}

              {/* Single Phone vs Separate WhatsApp/SMS Toggle */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone size={13} className="text-blue-600" />
                    Numéro(s) de contact du parent
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={contactIsSingleNumber}
                      onChange={e => {
                        const checked = e.target.checked;
                        setContactIsSingleNumber(checked);
                        if (checked) {
                          setContactWhatsappPhone('');
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span>Un seul numéro pour tout (WhatsApp & Appels/SMS)</span>
                  </label>
                </div>

                {contactIsSingleNumber ? (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Numéro unique (WhatsApp, SMS & Appels)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={contactMainPhone}
                        onChange={e => setContactMainPhone(e.target.value)}
                        placeholder="Ex: 0708091011 ou +225 0708091011"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 pl-8 text-xs font-mono font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                      />
                      <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Tous les messages WhatsApp, SMS et appels utiliseront ce numéro unique.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Numéro Appels & SMS Direct
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={contactMainPhone}
                          onChange={e => setContactMainPhone(e.target.value)}
                          placeholder="Ex: 0708091011"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 pl-8 text-xs font-mono font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                        />
                        <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
                        Numéro Dédié WhatsApp
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={contactWhatsappPhone}
                          onChange={e => setContactWhatsappPhone(e.target.value)}
                          placeholder="Ex: 0501020304"
                          className="w-full rounded-xl border border-emerald-300 bg-emerald-50/20 px-3 py-2 pl-8 text-xs font-mono font-medium focus:bg-white focus:border-emerald-500 focus:outline-none"
                        />
                        <MessageCircle size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Email du parent (Optionnel)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="Ex: parent@email.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 pl-8 text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                    <Mail size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Channel Switcher */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageChannel('whatsapp')}
                className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition text-xs font-bold ${
                  messageChannel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <MessageCircle size={18} className="text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageChannel('sms')}
                className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition text-xs font-bold ${
                  messageChannel === 'sms'
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <Phone size={18} className="text-blue-600" />
                <span>SMS Direct</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageChannel('email')}
                className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition text-xs font-bold ${
                  messageChannel === 'email'
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <Mail size={18} className="text-slate-700" />
                <span>E-mail</span>
              </button>
            </div>

            {/* Quick Templates */}
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Modèles de message suggérés :
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyParentTemplate('reunion')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  📅 Convocation réunion
                </button>
                <button
                  type="button"
                  onClick={() => applyParentTemplate('absence')}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  ⚠️ Notification absence
                </button>
                <button
                  type="button"
                  onClick={() => applyParentTemplate('info')}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  📢 Information générale
                </button>
                <button
                  type="button"
                  onClick={() => applyParentTemplate('felicitations')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  ⭐ Félicitations
                </button>
              </div>
            </div>

            <FormField label="Contenu du message" required>
              <textarea
                rows={5}
                value={parentMessageContent}
                onChange={e => setParentMessageContent(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 font-sans"
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Internal View Message Modal */}
      <Modal
        isOpen={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title={selectedMessage?.subject || 'Message'}
        size="md"
      >
        {selectedMessage && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">
                {selectedMessage.sender?.first_name?.[0]}
                {selectedMessage.sender?.last_name?.[0]}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {selectedMessage.sender?.first_name} {selectedMessage.sender?.last_name}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(selectedMessage.created_at)}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedMessage.content}</p>
          </div>
        )}
      </Modal>

      {/* Compose Internal Message Modal */}
      <Modal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={
          form.is_announcement
            ? 'Nouvelle annonce générale'
            : isParentUser
            ? "Écrire à l'école / aux enseignants"
            : 'Nouveau message interne'
        }
        size="md"
        actions={
          <>
            <button
              onClick={() => setComposeOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              onClick={handleSendInternal}
              disabled={saving || !form.content.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              <Send size={15} /> Envoyer le message
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {!form.is_announcement && (
            <FormField label="Destinataire" required>
              <select
                value={form.recipient_id}
                onChange={e => setForm({ ...form, recipient_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white"
              >
                {isParentUser ? (
                  <>
                    <option value="direction">🏛️ Direction & Secrétariat de l'école</option>
                    {parentChildren.map(child => {
                      // Find if there is an assigned teacher in recipients
                      const teacherMatch = availableRecipients.find(r =>
                        r.roleDescription.toLowerCase().includes(child.class?.name?.toLowerCase() || '___')
                      );
                      const targetId = teacherMatch ? teacherMatch.id : 'direction';
                      return (
                        <option key={child.id} value={targetId}>
                          👩‍🏫 Enseignant(e) de {child.first_name} ({child.class?.name || 'Classe'})
                        </option>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <option value="">-- Sélectionner un destinataire --</option>
                    {availableRecipients.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label} — {r.roleDescription}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </FormField>
          )}

          <FormField label="Objet" required>
            <input
              type="text"
              placeholder={
                isParentUser
                  ? "Ex: Demande de renseignement, Absence de mon enfant, Rendez-vous..."
                  : "Ex: Point pédagogique, Demande administrative..."
              }
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </FormField>
          <FormField label="Message" required>
            <textarea
              value={form.content}
              placeholder={
                isParentUser
                  ? "Rédigez votre message à l'attention de l'équipe pédagogique ou de la direction..."
                  : "Rédigez votre message interne..."
              }
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </FormField>
        </div>
      </Modal>

      {/* MODAL MESSAGE GROUPÉ / BROADCAST AUX PARENTS */}
      <Modal
        open={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        title="Diffusion de Message Groupé aux Parents (1 Clic)"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                {broadcastPhonesList.length}
              </span>
              <span>numéros valides prêts pour la diffusion</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAllNumbers}
                disabled={broadcastPhonesList.length === 0}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {broadcastCopiedNotice ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span>Numéros copiés !</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copier les numéros</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setBroadcastModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={handleExecuteBroadcast}
                disabled={broadcastSending || !broadcastContent.trim() || targetedBroadcastParents.length === 0}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-xs transition disabled:opacity-50 ${
                  broadcastChannel === 'whatsapp'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : broadcastChannel === 'sms'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                <Send size={15} />
                {broadcastSending
                  ? 'Envoi en cours...'
                  : broadcastChannel === 'whatsapp'
                  ? 'Lancer WhatsApp Broadcast'
                  : broadcastChannel === 'sms'
                  ? 'Lancer SMS Groupé'
                  : 'Publier Annonce aux Parents'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {broadcastNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
              <span>{broadcastNotice}</span>
            </div>
          )}

          {/* Target Scope Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Destinataires ciblés :
              </label>
              {isTeacherUser && teacherClass ? (
                <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  👩‍🏫 Parents de votre classe ({teacherClass.name}) • {targetedBroadcastParents.length} parents
                </div>
              ) : (
                <select
                  value={broadcastTargetScope}
                  onChange={e => setBroadcastTargetScope(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">👨‍👩‍👧‍👦 Toutes les familles de l'école ({parentDirectory.length} parents)</option>
                  {classes.map(c => {
                    const countInClass = parentDirectory.filter(item => item.children.some(ch => ch.class_id === c.id)).length;
                    return (
                      <option key={c.id} value={c.id}>
                        Classe {c.name} ({countInClass} parents)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Canal de diffusion :
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBroadcastChannel('whatsapp')}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                    broadcastChannel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastChannel('sms')}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                    broadcastChannel === 'sms'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Phone size={14} /> SMS
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastChannel('internal')}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition ${
                    broadcastChannel === 'internal'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Megaphone size={14} /> Portail
                </button>
              </div>
            </div>
          </div>

          {/* Quick Pre-filled Templates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Modèles de messages rapides :
              </label>
              <span className="text-[11px] text-slate-400">Cliquez pour appliquer</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyBroadcastTemplate('reunion')}
                className="px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 transition"
              >
                📅 Réunion / Assemblée
              </button>
              <button
                type="button"
                onClick={() => applyBroadcastTemplate('rentree')}
                className="px-2.5 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
              >
                🎓 Rentrée scolaire
              </button>
              <button
                type="button"
                onClick={() => applyBroadcastTemplate('finances')}
                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition"
              >
                💳 Rappel de scolarité
              </button>
              <button
                type="button"
                onClick={() => applyBroadcastTemplate('fermeture')}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-medium hover:bg-rose-100 transition"
              >
                🏖️ Congés / Arrêt cours
              </button>
              <button
                type="button"
                onClick={() => applyBroadcastTemplate('fete')}
                className="px-2.5 py-1.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 transition"
              >
                🏆 Fête de l'école
              </button>
            </div>
          </div>

          {/* Subject & Content */}
          <FormField label="Objet de la communication" required>
            <input
              type="text"
              value={broadcastSubject}
              onChange={e => setBroadcastSubject(e.target.value)}
              placeholder="Ex: Assemblée Générale des Parents d'Élèves..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </FormField>

          <FormField label="Contenu du message aux parents" required>
            <textarea
              rows={6}
              value={broadcastContent}
              onChange={e => setBroadcastContent(e.target.value)}
              placeholder="Rédigez ici le texte à envoyer à tous les parents..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-normal text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
