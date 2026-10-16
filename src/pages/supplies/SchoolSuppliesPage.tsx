import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import DataTable, { Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../lib/utils';
import { buildClassSupplyListHtml, openPrintPreview } from '../../lib/printableDocuments';
import { resolveTeacherClass } from '../../lib/roleDataResolver';
import type { SchoolSupplyItem } from '../../types';
import { 
  BookOpen, 
  Plus, 
  Printer, 
  Trash2, 
  Edit, 
  Copy, 
  Sparkles, 
  PackageCheck, 
  School,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';

const CATEGORIES = [
  { value: 'manuel', label: '📚 Manuels & Livres scolaires' },
  { value: 'cahier', label: '📓 Cahiers' },
  { value: 'papeterie', label: '✏️ Papeterie & Écriture' },
  { value: 'geometrie', label: '📐 Matériel géométrique & Dessin' },
  { value: 'uniforme', label: '👔 Tenues & Accessoires' },
  { value: 'autre', label: '📦 Autres fournitures' },
];

const STANDARD_PACK_TEMPLATES: Record<string, { item_name: string; category: SchoolSupplyItem['category']; quantity: number; unit_price: number; is_mandatory: boolean }[]> = {
  maternelle: [
    { item_name: 'Cahier de coloriage et d’activités préscolaires', category: 'manuel', quantity: 1, unit_price: 3500, is_mandatory: true },
    { item_name: 'Boîte de 12 crayons de couleur Jumbo', category: 'papeterie', quantity: 1, unit_price: 2500, is_mandatory: true },
    { item_name: 'Boîte de pâte à modeler non toxique', category: 'papeterie', quantity: 1, unit_price: 3000, is_mandatory: true },
    { item_name: 'Paquet de papier rame blanc A4 (80g)', category: 'papeterie', quantity: 1, unit_price: 4500, is_mandatory: true },
    { item_name: 'Blouse / Tablier d’activité de protection', category: 'uniforme', quantity: 1, unit_price: 4000, is_mandatory: true },
    { item_name: 'Ardoise blanche avec feutres et éponge', category: 'papeterie', quantity: 1, unit_price: 1500, is_mandatory: true },
  ],
  primaire: [
    { item_name: 'Mon livre de lecture et d’expression française', category: 'manuel', quantity: 1, unit_price: 5500, is_mandatory: true },
    { item_name: 'Livre de mathématiques au programme', category: 'manuel', quantity: 1, unit_price: 5500, is_mandatory: true },
    { item_name: 'Cahiers 100 pages double ligne (Grand format)', category: 'cahier', quantity: 4, unit_price: 700, is_mandatory: true },
    { item_name: 'Cahiers 200 pages double ligne pour leçons', category: 'cahier', quantity: 2, unit_price: 1200, is_mandatory: true },
    { item_name: 'Boîte d’instruments géométriques (Règle, Équerre, Rapporteur, Compas)', category: 'geometrie', quantity: 1, unit_price: 2500, is_mandatory: true },
    { item_name: 'Paquet de stylos à bille (Bleu, Vert, Rouge, Noir)', category: 'papeterie', quantity: 1, unit_price: 1500, is_mandatory: true },
    { item_name: 'Paquet de papier rame A4 (80g)', category: 'papeterie', quantity: 1, unit_price: 4500, is_mandatory: true },
    { item_name: 'Dictionnaire bilingue / illustré pour élèves', category: 'manuel', quantity: 1, unit_price: 6000, is_mandatory: false },
  ],
};

export default function SchoolSuppliesPage() {
  const { profile, role, isTeacher } = useAuth();
  const isTeacherUser = isTeacher || role === 'teacher' || (profile?.role as any)?.name === 'teacher';
  const { school, academicYear } = useApp();
  const schoolId = school?.id;
  const queryClient = useQueryClient();

  const [teacherClass, setTeacherClass] = useState<any | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SchoolSupplyItem | null>(null);

  // Form State
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<SchoolSupplyItem['category']>('manuel');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);
  const [notes, setNotes] = useState('');

  // 1. Fetch Academic Years
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic_years', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Default to current academic year
  useEffect(() => {
    if (academicYear?.id && !selectedYearId) {
      setSelectedYearId(academicYear.id);
    } else if (academicYears.length > 0 && !selectedYearId) {
      setSelectedYearId(academicYears[0].id);
    }
  }, [academicYear, academicYears, selectedYearId]);

  // 2. Fetch Classes for selected Year
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', schoolId, selectedYearId],
    queryFn: async () => {
      if (!schoolId) return [];
      let query = supabase.from('classes').select('*, level:levels(name)').eq('school_id', schoolId).order('name');
      if (selectedYearId) {
        query = query.eq('academic_year_id', selectedYearId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Default to assigned teacher class or first class
  useEffect(() => {
    if (!classes || classes.length === 0) return;
    if (isTeacherUser && profile && schoolId) {
      void resolveTeacherClass(schoolId, profile, classes as any[]).then(res => {
        if (res.assignedClass) {
          setTeacherClass(res.assignedClass);
          setSelectedClassId(res.assignedClass.id);
        } else if (!selectedClassId && classes.length > 0) {
          setSelectedClassId(classes[0].id);
        }
      });
    } else if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, isTeacherUser, profile, schoolId, selectedClassId]);

  // 3. Fetch Supplies for School, Year and Class
  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ['school_supplies', schoolId, selectedYearId, selectedClassId],
    queryFn: async () => {
      if (!schoolId || !selectedYearId || !selectedClassId) return [];
      const { data, error } = await supabase
        .from('school_supplies')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_id', selectedYearId)
        .eq('class_id', selectedClassId)
        .order('category', { ascending: true })
        .order('item_name', { ascending: true });

      if (error) throw error;
      return (data as SchoolSupplyItem[]) || [];
    },
    enabled: !!schoolId && !!selectedYearId && !!selectedClassId,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const totalItems = supplies.length;
    const totalBudget = supplies.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
    const booksCount = supplies.filter(i => i.category === 'manuel').length;
    const mandatoryCount = supplies.filter(i => i.is_mandatory).length;

    return { totalItems, totalBudget, booksCount, mandatoryCount };
  }, [supplies]);

  // Save / Edit Mutation
  const saveSupplyMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId || !selectedYearId || !selectedClassId) {
        throw new Error('Veuillez sélectionner une année scolaire et une classe.');
      }
      if (!itemName.trim()) {
        throw new Error("Le nom de l'article ou du livre est obligatoire.");
      }

      const payload = {
        school_id: schoolId,
        academic_year_id: selectedYearId,
        class_id: selectedClassId,
        item_name: itemName.trim(),
        category,
        quantity: Math.max(1, Number(quantity) || 1),
        unit_price: Math.max(0, Number(unitPrice) || 0),
        is_mandatory: isMandatory,
        notes: notes.trim() || null,
      };

      if (editingItem?.id) {
        const { error } = await supabase
          .from('school_supplies')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('school_supplies')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school_supplies', schoolId, selectedYearId, selectedClassId] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Erreur : ${err.message}`);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('school_supplies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school_supplies', schoolId, selectedYearId, selectedClassId] });
    },
  });

  // Seed Standard Pack Mutation
  const seedPackMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId || !selectedYearId || !selectedClassId) return;

      const currentClass = classes.find(c => c.id === selectedClassId);
      const isMaternelle = currentClass?.name?.toLowerCase().includes('mat') || 
                           currentClass?.name?.toLowerCase().includes('ps') || 
                           currentClass?.name?.toLowerCase().includes('ms') || 
                           currentClass?.name?.toLowerCase().includes('gs');

      const template = isMaternelle ? STANDARD_PACK_TEMPLATES.maternelle : STANDARD_PACK_TEMPLATES.primaire;

      const rowsToInsert = template.map(t => ({
        school_id: schoolId,
        academic_year_id: selectedYearId,
        class_id: selectedClassId,
        item_name: t.item_name,
        category: t.category,
        quantity: t.quantity,
        unit_price: t.unit_price,
        is_mandatory: t.is_mandatory,
      }));

      const { error } = await supabase.from('school_supplies').insert(rowsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['school_supplies', schoolId, selectedYearId, selectedClassId] });
      alert("✅ Pack standard de fournitures importé avec succès pour cette classe !");
    },
  });

  function resetForm() {
    setEditingItem(null);
    setItemName('');
    setCategory('manuel');
    setQuantity(1);
    setUnitPrice(0);
    setIsMandatory(true);
    setNotes('');
  }

  function handleOpenCreate() {
    resetForm();
    setModalOpen(true);
  }

  function handleOpenEdit(item: SchoolSupplyItem) {
    setEditingItem(item);
    setItemName(item.item_name);
    setCategory(item.category);
    setQuantity(item.quantity);
    setUnitPrice(item.unit_price);
    setIsMandatory(item.is_mandatory);
    setNotes(item.notes || '');
    setModalOpen(true);
  }

  function handlePrintOfficialList() {
    if (!school) return;
    const currentClass = classes.find(c => c.id === selectedClassId);
    const yearObj = academicYears.find(y => y.id === selectedYearId);

    const html = buildClassSupplyListHtml({
      school,
      className: currentClass?.name || 'Classe',
      academicYearName: yearObj?.name || '2026-2027',
      items: supplies,
    });

    openPrintPreview(html);
  }

  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const selectedYearObj = academicYears.find(y => y.id === selectedYearId);

  const columns: Column<SchoolSupplyItem>[] = [
    {
      key: 'item_name',
      label: 'Article / Manuel scolaire',
      render: row => (
        <div>
          <p className="font-bold text-slate-900">{row.item_name}</p>
          {row.notes && <p className="text-xs text-slate-500 mt-0.5">ℹ️ {row.notes}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Catégorie',
      render: row => {
        const cat = CATEGORIES.find(c => c.value === row.category);
        return <span className="text-xs font-semibold text-slate-700">{cat?.label || row.category}</span>;
      },
    },
    {
      key: 'quantity',
      label: 'Qté requise',
      render: row => <span className="font-extrabold text-blue-700 text-sm">{row.quantity}</span>,
    },
    {
      key: 'unit_price',
      label: 'Prix Unitaire',
      render: row => (
        <span className="font-mono text-xs text-slate-600">
          {row.unit_price > 0 ? formatCurrency(row.unit_price) : '-'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total Estimé',
      render: row => {
        const total = Number(row.quantity) * Number(row.unit_price);
        return (
          <span className="font-mono font-bold text-xs text-slate-900">
            {total > 0 ? formatCurrency(total) : '-'}
          </span>
        );
      },
    },
    {
      key: 'is_mandatory',
      label: 'Caractère',
      render: row => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
            row.is_mandatory ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.is_mandatory ? 'Obligatoire' : 'Facultatif'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Modifier"
          >
            <Edit size={15} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Supprimer "${row.item_name}" de la liste ?`)) {
                deleteMutation.mutate(row.id);
              }
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Supprimer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <section className="surface-card overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200/60">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h1 className="display-font text-2xl font-bold text-slate-900">
                    {isTeacherUser
                      ? `Fournitures & Manuels Scolaires • ${teacherClass?.name || 'CP1'}`
                      : 'Fournitures & Manuels Scolaires'}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {isTeacherUser
                      ? `Consultez et imprimez la liste des manuels et fournitures de votre classe (${teacherClass?.name || 'CP1'}).`
                      : 'Configurez et imprimez les listes officielles de livres et fournitures par classe et par rentrée académique.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrintOfficialList}
                disabled={supplies.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition disabled:opacity-40"
              >
                <Printer size={15} /> Imprimer Liste Officielle
              </button>
              <button
                onClick={handleOpenCreate}
                disabled={!selectedClassId}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 shadow-xs transition disabled:opacity-40"
              >
                <Plus size={15} /> Ajouter un article
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Selectors Bar & Class Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={14} /> Année :
            </span>
            <select
              value={selectedYearId}
              onChange={e => setSelectedYearId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.active ? '(En cours)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Class selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <School size={14} /> Classe :
            </span>
            {isTeacherUser && teacherClass ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                Votre classe : {teacherClass.name}
              </div>
            ) : (
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    Classe de {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Suggest / Fast Prepopulate button */}
        {supplies.length === 0 && (
          <button
            onClick={() => void seedPackMutation.mutate()}
            disabled={seedPackMutation.isPending || !selectedClassId}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100 transition"
          >
            <Sparkles size={14} className="text-amber-600" />
            {seedPackMutation.isPending ? 'Chargement...' : 'Pré-remplir avec le pack officiel'}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Articles</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalItems}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{stats.mandatoryCount} obligatoires</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Manuels & Livres</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats.booksCount}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">Au programme officiel</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Budget Total Estimé</p>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {formatCurrency(stats.totalBudget)}
          </p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Par élève pour l'année</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Classe Active</p>
          <p className="text-2xl font-black text-purple-900 mt-1">
            {selectedClassObj?.name || '-'}
          </p>
          <p className="text-[11px] text-purple-600 mt-0.5">{selectedYearObj?.name || '2026-2027'}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Liste des articles pour la classe de {selectedClassObj?.name || ''}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {supplies.length} éléments enregistrés
          </span>
        </div>

        <DataTable
          columns={columns}
          data={supplies}
          searchPlaceholder="Rechercher un manuel, cahier ou article..."
          searchKeys={['item_name', 'category', 'notes']}
          loading={isLoading}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Modifier l'article de fourniture" : `Ajouter à la liste de ${selectedClassObj?.name || ''}`}
        size="md"
        actions={
          <div className="flex justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => saveSupplyMutation.mutate()}
              disabled={saveSupplyMutation.isPending || !itemName.trim()}
              className="px-4 py-2 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
            >
              {saveSupplyMutation.isPending ? 'Enregistrement...' : editingItem ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Désignation du manuel ou de la fourniture" required>
            <input
              type="text"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              placeholder="Ex: Mon livre de lecture français CIAM, Cahier double ligne..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Catégorie" required>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Quantité demandée" required>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold focus:border-blue-600 focus:outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix Unitaire Indicatif (FCFA)">
              <input
                type="number"
                min="0"
                step="100"
                value={unitPrice}
                onChange={e => setUnitPrice(Number(e.target.value))}
                placeholder="Ex: 5500"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
              />
            </FormField>

            <FormField label="Caractère de l'article">
              <div className="flex items-center gap-3 pt-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={e => setIsMandatory(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Obligatoire dès la rentrée
                </label>
              </div>
            </FormField>
          </div>

          <FormField label="Remarques / Éditeur recommandé (Optionnel)">
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Édition Hatier 2026, couverture bleue exigée..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
