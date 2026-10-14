import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../lib/utils';
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
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

function cleanPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  let p = rawPhone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) {
    p = p.substring(1);
  } else if (p.length === 10 || p.length === 8) {
    p = `225${p}`; // Default West Africa / Cote d'Ivoire prefix
  }
  return p;
}

export default function MessagesPage() {
  const { school } = useApp();
  const { profile } = useAuth();

  const [messages, setMessages] = useState<(Message & { sender?: Profile })[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'parents' (Parent Communication Suite), 'inbox', 'sent', 'announcements'
  const [tab, setTab] = useState<'parents' | 'inbox' | 'sent' | 'announcements'>('parents');

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

  useEffect(() => {
    if (school) fetchData();
  }, [school, profile]);

  async function fetchData() {
    setLoading(true);
    const sid = school!.id;
    try {
      const [msgRes, stuRes, parRes, clsRes] = await Promise.all([
        supabase
          .from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey(*)')
          .eq('school_id', sid)
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, first_name, last_name, matricule, class_id, class:classes(name), student_parents(parent:parents(*))')
          .eq('school_id', sid)
          .order('last_name'),
        supabase.from('parents').select('*').eq('school_id', sid).order('last_name'),
        supabase.from('classes').select('*').eq('school_id', sid).order('name'),
      ]);

      setMessages((msgRes.data as any[]) || []);
      setStudents(stuRes.data || []);
      setParents((parRes.data as Parent[]) || []);
      setClasses((clsRes.data as Class[]) || []);
    } catch (e) {
      console.error('Error fetching messaging data', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInternal() {
    setSaving(true);
    await supabase.from('messages').insert({
      ...form,
      school_id: school!.id,
      sender_id: profile!.id,
    });
    setSaving(false);
    setComposeOpen(false);
    setForm({ recipient_id: '', subject: '', content: '', is_announcement: false });
    void fetchData();
  }

  async function markAsRead(msg: Message) {
    await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
    void fetchData();
  }

  // Compile list of parent contacts with linked children & classes
  const parentDirectory = useMemo(() => {
    const map = new Map<string, { parent: Parent; children: any[]; className: string }>();

    students.forEach(st => {
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

    parents.forEach(p => {
      if (!map.has(p.id)) {
        map.set(p.id, {
          parent: p,
          children: [],
          className: '',
        });
      }
    });

    return Array.from(map.values());
  }, [students, parents]);

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
    const childName = item.children[0] ? `${item.children[0].first_name} ${item.children[0].last_name}` : 'votre enfant';
    const text = `Bonjour M./Mme ${item.parent.last_name || ''},\n\nNous vous contactons depuis l'établissement ${school?.name || 'Groupe Scolaire'} concernant ${childName}.\n\nMessage : \n\nCordialement,\nLa Direction`;
    setParentMessageContent(text);
    setCustomMsgModal(true);
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
    const phone = cleanPhone(activeParentTarget.parent.phone);
    const email = activeParentTarget.parent.email;

    if (messageChannel === 'whatsapp') {
      if (!phone) {
        alert('Numéro de téléphone du parent manquant ou non renseigné.');
        return;
      }
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    } else if (messageChannel === 'sms') {
      if (!phone) {
        alert('Numéro de téléphone du parent manquant ou non renseigné.');
        return;
      }
      const url = `sms:${phone}?body=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    } else if (messageChannel === 'email') {
      const url = `mailto:${email || ''}?subject=${encodeURIComponent(
        `Information École - ${school?.name || 'Groupe Scolaire'}`
      )}&body=${encodeURIComponent(parentMessageContent)}`;
      window.open(url, '_blank');
    }

    setCustomMsgModal(false);
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
            Communications & Messages
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Envoi de messages WhatsApp, SMS et e-mails aux parents & messagerie interne
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setForm({ ...form, is_announcement: false });
              setComposeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-xs transition"
          >
            <Plus size={16} /> Nouveau message interne
          </button>
          <button
            onClick={() => {
              setForm({ ...form, is_announcement: true });
              setComposeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 shadow-xs transition"
          >
            <Megaphone size={16} /> Annonce générale
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          onClick={() => setTab('parents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            tab === 'parents'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <MessageCircle size={15} />
          <span>Communication Parents (WhatsApp / SMS / Mail)</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-200">
            {parentDirectory.length}
          </span>
        </button>

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
          <span>Annonces</span>
        </button>
      </div>

      {/* TAB 1: PARENT COMMUNICATION SUITE */}
      {tab === 'parents' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
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
                    const phone = cleanPhone(par.phone);

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
                          <p className="font-semibold text-slate-800 font-mono">
                            {par.phone || <span className="text-slate-400 italic">Non renseigné</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{par.email || '-'}</p>
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
                              disabled={!phone}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition border border-emerald-200 disabled:opacity-40"
                            >
                              <MessageCircle size={13} />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              onClick={() => openParentMessage(item, 'sms')}
                              title="Envoyer un SMS"
                              disabled={!phone}
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
            {/* Target Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed">
              <p>
                Destinataire : <strong>{activeParentTarget.parent.first_name} {activeParentTarget.parent.last_name}</strong>
              </p>
              <p className="mt-1">
                Téléphone : <strong>{activeParentTarget.parent.phone || 'Non renseigné'}</strong> • Email :{' '}
                <strong>{activeParentTarget.parent.email || 'Non renseigné'}</strong>
              </p>
              {activeParentTarget.children[0] && (
                <p className="mt-1">
                  Élève concerné : <strong>{activeParentTarget.children[0].first_name} {activeParentTarget.children[0].last_name}</strong> (Classe: {activeParentTarget.children[0].class?.name || '-'})
                </p>
              )}
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
        title={form.is_announcement ? 'Nouvelle annonce générale' : 'Nouveau message interne'}
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
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={15} /> Envoyer
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Objet">
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </FormField>
          <FormField label="Message" required>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
