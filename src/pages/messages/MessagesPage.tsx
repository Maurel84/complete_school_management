import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../lib/utils';
import type { Message, Profile } from '../../types';
import { Mail, Plus, Send, Megaphone } from 'lucide-react';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';

export default function MessagesPage() {
  const { school } = useApp();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<(Message & { sender?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<(Message & { sender?: Profile }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'inbox' | 'sent' | 'announcements'>('inbox');
  const [form, setForm] = useState({ recipient_id: '', subject: '', content: '', is_announcement: false });

  useEffect(() => { if (school && profile) fetchMessages(); }, [school, profile]);

  async function fetchMessages() {
    setLoading(true);
    const { data } = await supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(*)').eq('school_id', school!.id).order('created_at', { ascending: false });
    setMessages((data as any[]) || []);
    setLoading(false);
  }

  async function handleSend() {
    setSaving(true);
    await supabase.from('messages').insert({
      ...form,
      school_id: school!.id,
      sender_id: profile!.id,
    });
    setSaving(false); setComposeOpen(false); setForm({ recipient_id: '', subject: '', content: '', is_announcement: false }); fetchMessages();
  }

  async function markAsRead(msg: Message) {
    await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
    fetchMessages();
  }

  const inbox = messages.filter(m => m.recipient_id === profile?.id && !m.is_announcement);
  const sent = messages.filter(m => m.sender_id === profile?.id && !m.is_announcement);
  const announcements = messages.filter(m => m.is_announcement);

  const displayed = tab === 'inbox' ? inbox : tab === 'sent' ? sent : announcements;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1">Communication interne</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setForm({...form, is_announcement: false}); setComposeOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={18} /> Nouveau message
          </button>
          <button onClick={() => { setForm({...form, is_announcement: true}); setComposeOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
            <Megaphone size={18} /> Annonce
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setTab('inbox')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'inbox' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>
          Boîte de réception {inbox.filter(m => !m.is_read).length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-xs">{inbox.filter(m => !m.is_read).length}</span>}
        </button>
        <button onClick={() => setTab('sent')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'sent' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Envoyés</button>
        <button onClick={() => setTab('announcements')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'announcements' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent'}`}>Annonces</button>
      </div>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            <Mail size={40} className="mx-auto mb-3" />
            <p>Aucun message</p>
          </div>
        ) : displayed.map(msg => (
          <div key={msg.id}
            onClick={() => { setSelectedMessage(msg); if (!msg.is_read && msg.recipient_id === profile?.id) markAsRead(msg); }}
            className={`p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${!msg.is_read && msg.recipient_id === profile?.id ? 'border-l-4 border-l-blue-500' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {msg.is_announcement && <Megaphone size={14} className="text-teal-600" />}
                  <p className="text-sm font-medium text-gray-900">{msg.subject || '(Sans objet)'}</p>
                  {!msg.is_read && msg.recipient_id === profile?.id && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{msg.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {msg.sender?.first_name} {msg.sender?.last_name} - {formatDateTime(msg.created_at)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!selectedMessage} onClose={() => setSelectedMessage(null)} title={selectedMessage?.subject || 'Message'} size="md">
        {selectedMessage && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-bold">
                {selectedMessage.sender?.first_name?.[0]}{selectedMessage.sender?.last_name?.[0]}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedMessage.sender?.first_name} {selectedMessage.sender?.last_name}</p>
                <p className="text-xs text-gray-500">{formatDateTime(selectedMessage.created_at)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
          </div>
        )}
      </Modal>

      <Modal isOpen={composeOpen} onClose={() => setComposeOpen(false)} title={form.is_announcement ? 'Nouvelle annonce' : 'Nouveau message'} size="md"
        actions={<>
          <button onClick={() => setComposeOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleSend} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"><Send size={16} /> Envoyer</button>
        </>}>
        <div className="space-y-4">
          {!form.is_announcement && (
            <FormField label="Destinataire">
              <input type="text" value={form.recipient_id} onChange={e => setForm({...form, recipient_id: e.target.value})} placeholder="ID du destinataire" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </FormField>
          )}
          <FormField label="Objet"><input type="text" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
          <FormField label="Message" required><textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></FormField>
        </div>
      </Modal>
    </div>
  );
}
