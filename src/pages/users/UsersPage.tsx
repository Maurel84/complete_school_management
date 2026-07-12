import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Badge from '../../components/common/Badge';
import { APP_MODULES, getDefaultModuleKeys, type ModuleKey } from '../../lib/moduleAccess';
import type { Profile, Role, UserRole } from '../../types';
import {
  Check,
  KeyRound,
  Lock,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';

type UserRow = Profile & { role?: Role };

type UserForm = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role_name: UserRole;
  account_type: string;
  active: boolean;
  module_access: ModuleKey[];
};

const EMPTY_FORM: UserForm = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role_name: 'teacher',
  account_type: 'staff',
  active: true,
  module_access: getDefaultModuleKeys('teacher'),
};

function normalizeUserRow(value: UserRow): UserRow {
  return {
    ...value,
    role: Array.isArray(value.role) ? value.role[0] : value.role,
    email: value.email || '',
    account_type: value.account_type || 'staff',
    module_access: Array.isArray(value.module_access) ? value.module_access : [],
  };
}

export default function UsersPage() {
  const { school } = useApp();
  const { isAdmin, isSuperAdmin, profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageUsers = isAdmin || isSuperAdmin;

  useEffect(() => {
    if (!school) return;
    void fetchData();
  }, [school]);

  async function fetchData() {
    if (!school) return;
    setLoading(true);
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, role:roles(*)')
        .eq('school_id', school.id)
        .order('last_name', { ascending: true }),
      supabase.from('roles').select('*').order('display_name'),
    ]);

    setUsers(((profileRes.data as UserRow[]) || []).map(normalizeUserRow));
    setRoles((roleRes.data as Role[]) || []);
    setLoading(false);
  }

  const roleOptions = useMemo(
    () => roles.filter(role => isSuperAdmin || role.name !== 'super_admin'),
    [roles, isSuperAdmin],
  );

  const modulesByCategory = useMemo(() => {
    return APP_MODULES.reduce<Record<string, typeof APP_MODULES>>((accumulator, module) => {
      if (!accumulator[module.category]) accumulator[module.category] = [];
      accumulator[module.category].push(module);
      return accumulator;
    }, {});
  }, []);

  function resetForm(nextRole: UserRole = 'teacher') {
    setForm({
      ...EMPTY_FORM,
      role_name: nextRole,
      module_access: getDefaultModuleKeys(nextRole),
    });
  }

  function setRole(roleName: UserRole) {
    setForm(current => ({
      ...current,
      role_name: roleName,
      module_access: getDefaultModuleKeys(roleName),
    }));
  }

  function toggleModule(moduleKey: ModuleKey) {
    setForm(current => {
      const exists = current.module_access.includes(moduleKey);
      const module_access = exists
        ? current.module_access.filter(key => key !== moduleKey)
        : [...current.module_access, moduleKey];

      return {
        ...current,
        module_access: Array.from(new Set(['dashboard' as ModuleKey, ...module_access])),
      };
    });
  }

  function openCreate() {
    setNotice(null);
    resetForm();
    setCreateOpen(true);
  }

  function openEdit(user: UserRow) {
    setNotice(null);
    setEditingUser(user);
    setForm({
      email: user.email || '',
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      role_name: (user.role?.name || 'teacher') as UserRole,
      account_type: user.account_type || 'staff',
      active: user.active,
      module_access: Array.isArray(user.module_access) && user.module_access.length > 0
        ? user.module_access as ModuleKey[]
        : getDefaultModuleKeys((user.role?.name || 'teacher') as UserRole),
    });
    setEditOpen(true);
  }

  async function createUser() {
    if (!school) return;
    setSaving(true);
    setNotice(null);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          ...form,
          school_id: school.id,
          module_access: form.module_access,
        },
      });

      if (error) {
        throw error;
      }

      setSaving(false);
      setCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (e: any) {
      let msg = e.message || "Le compte n'a pas pu être créé.";
      if (
        msg.includes("Failed to send a request to the Edge Function") ||
        msg.includes("Failed to fetch") ||
        msg.includes("edge function")
      ) {
        msg = "Erreur : La fonction Edge 'admin-create-user' n'est pas déployée en production. Pour la déployer et permettre la création de comptes, veuillez exécuter la commande suivante dans votre terminal local : \n\n supabase functions deploy admin-create-user --project-ref <id_projet_supabase>";
      }
      setNotice(msg);
      setSaving(false);
    }
  }

  async function updateUser() {
    if (!editingUser) return;
    setSaving(true);
    setNotice(null);

    const roleId = roles.find(role => role.name === form.role_name)?.id;
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email,
        role_id: roleId,
        account_type: form.account_type,
        active: form.active,
        module_access: form.module_access,
      })
      .eq('id', editingUser.id);

    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditOpen(false);
    setEditingUser(null);
    await fetchData();
  }

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      label: 'Utilisateur',
      render: user => (
        <div>
          <p className="font-semibold text-slate-900">{user.first_name} {user.last_name}</p>
          <p className="text-xs text-slate-500">{user.email || 'Email non renseigne'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: user => user.role?.display_name || '-',
    },
    {
      key: 'account_type',
      label: 'Type',
      render: user => (
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${
          user.account_type === 'demo' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
        }`}>
          {user.account_type === 'demo' ? 'Demo' : 'Equipe'}
        </span>
      ),
    },
    {
      key: 'module_access',
      label: 'Modules',
      render: user => {
        const count = Array.isArray(user.module_access) && user.module_access.length > 0
          ? user.module_access.length
          : getDefaultModuleKeys(user.role?.name || null).length;
        return `${count} module(s)`;
      },
    },
    {
      key: 'active',
      label: 'Statut',
      render: user => <Badge status={user.active ? 'active' : 'inactive'} label={user.active ? 'Actif' : 'Bloque'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: user => (
        <button
          onClick={() => openEdit(user)}
          disabled={!canManageUsers || user.id === profile?.id}
          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Modifier"
        >
          <PencilLine size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="surface-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <ShieldCheck size={16} /> Administration des acces
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Utilisateurs et modules</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Cree les comptes de l'equipe, puis limite chaque profil aux modules utiles a son travail.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void fetchData()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Actualiser
            </button>
            <button
              onClick={openCreate}
              disabled={!canManageUsers}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} /> Nouveau compte
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface-card p-4">
          <Users className="text-emerald-700" size={20} />
          <p className="mt-3 text-2xl font-semibold text-slate-950">{users.length}</p>
          <p className="text-sm text-slate-500">Comptes rattaches</p>
        </div>
        <div className="surface-card p-4">
          <Check className="text-blue-700" size={20} />
          <p className="mt-3 text-2xl font-semibold text-slate-950">{users.filter(user => user.active).length}</p>
          <p className="text-sm text-slate-500">Comptes actifs</p>
        </div>
        <div className="surface-card p-4">
          <Lock className="text-amber-700" size={20} />
          <p className="mt-3 text-2xl font-semibold text-slate-950">{APP_MODULES.length}</p>
          <p className="text-sm text-slate-500">Modules controlables</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchPlaceholder="Rechercher un utilisateur..."
        searchKeys={['first_name', 'last_name', 'email', 'account_type']}
      />

      <UserModal
        isOpen={createOpen}
        title="Nouveau compte"
        form={form}
        roleOptions={roleOptions}
        modulesByCategory={modulesByCategory}
        saving={saving}
        notice={notice}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onChange={setForm}
        onRoleChange={setRole}
        onToggleModule={toggleModule}
        onSubmit={() => void createUser()}
      />

      <UserModal
        isOpen={editOpen}
        title="Modifier les acces"
        form={form}
        roleOptions={roleOptions}
        modulesByCategory={modulesByCategory}
        saving={saving}
        notice={notice}
        mode="edit"
        onClose={() => setEditOpen(false)}
        onChange={setForm}
        onRoleChange={setRole}
        onToggleModule={toggleModule}
        onSubmit={() => void updateUser()}
      />
    </div>
  );
}

interface UserModalProps {
  isOpen: boolean;
  title: string;
  form: UserForm;
  roleOptions: Role[];
  modulesByCategory: Record<string, typeof APP_MODULES>;
  saving: boolean;
  notice: string | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onChange: (form: UserForm) => void;
  onRoleChange: (roleName: UserRole) => void;
  onToggleModule: (moduleKey: ModuleKey) => void;
  onSubmit: () => void;
}

function UserModal({
  isOpen,
  title,
  form,
  roleOptions,
  modulesByCategory,
  saving,
  notice,
  mode,
  onClose,
  onChange,
  onRoleChange,
  onToggleModule,
  onSubmit,
}: UserModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      actions={
        <>
          <button onClick={onClose} className="btn-premium-secondary">
            Annuler
          </button>
          <button onClick={onSubmit} disabled={saving} className="btn-premium-primary">
            {saving ? 'Enregistrement...' : mode === 'create' ? 'Créer le compte' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-5 animate-in">
        {notice && (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 text-sm text-red-800 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-red-700">
              <ShieldAlert size={16} />
              <span>Erreur lors de la création de compte</span>
            </div>
            <p className="whitespace-pre-wrap font-medium leading-relaxed font-sans text-xs bg-white/60 p-3 rounded-xl border border-red-100">{notice}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Prenom" required>
            <input value={form.first_name} onChange={event => onChange({ ...form, first_name: event.target.value })} className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Nom" required>
            <input value={form.last_name} onChange={event => onChange({ ...form, last_name: event.target.value })} className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Email" required>
            <input type="email" value={form.email} onChange={event => onChange({ ...form, email: event.target.value })} className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          {mode === 'create' && (
            <FormField label="Mot de passe" required>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" value={form.password} onChange={event => onChange({ ...form, password: event.target.value })} className="w-full rounded-md border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
              </div>
            </FormField>
          )}
          <FormField label="Telephone">
            <input value={form.phone} onChange={event => onChange({ ...form, phone: event.target.value })} className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
          </FormField>
          <FormField label="Role">
            <select value={form.role_name} onChange={event => onRoleChange(event.target.value as UserRole)} className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10">
              {roleOptions.map(role => (
                <option key={role.id} value={role.name}>{role.display_name}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={event => onChange({ ...form, active: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Compte actif
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.account_type === 'demo'}
              onChange={event => onChange({ ...form, account_type: event.target.checked ? 'demo' : 'staff' })}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Compte demo
          </label>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserCog size={16} /> Modules autorises
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(modulesByCategory).map(([category, modules]) => (
              <div key={category} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase text-slate-500">{category}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modules.map(module => (
                    <label key={module.key} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={form.module_access.includes(module.key)}
                        disabled={module.key === 'dashboard'}
                        onChange={() => onToggleModule(module.key)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">{module.label}</span>
                        <span className="block text-xs leading-5 text-slate-500">{module.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
