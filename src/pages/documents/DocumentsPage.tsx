import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import Badge from '../../components/common/Badge';
import { formatDate, formatCurrency } from '../../lib/utils';
import type { Document, Student, Class, Teacher, Parent, StudentParent } from '../../types';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  Printer,
  Award,
  GraduationCap,
  CalendarCheck,
  MailWarning,
  Receipt,
  CreditCard,
  Contact,
  Users,
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  FolderLock,
  Plus,
  X,
  Shield,
  FileCheck,
  ImageIcon,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  buildSchoolCertificateHtml,
  buildParentSummonsHtml,
  buildHonorDiplomaHtml,
  buildReportCardHtml,
  buildPayslipHtml,
  buildStudentAccountStatementHtml,
  buildStudentCardHtml,
  buildClassRosterHtml,
  buildClassAttendanceSheetHtml,
  buildClassSupplyListHtml,
  openPrintPreview,
  downloadTextDocument,
} from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';

export const VAULT_DOC_TYPES: { id: string; label: string; icon: string; forEntity: ('student' | 'teacher' | 'school')[] }[] = [
  { id: 'birth_certificate', label: 'Extrait d’acte de naissance', icon: 'FileText', forEntity: ['student'] },
  { id: 'medical_certificate', label: 'Certificat médical / Carnet de santé', icon: 'Shield', forEntity: ['student', 'teacher'] },
  { id: 'id_card', label: 'Pièce d’identité (CNI / Passeport)', icon: 'FileCheck', forEntity: ['student', 'teacher', 'school'] },
  { id: 'transfer_certificate', label: 'Certificat de radiation / Transfert', icon: 'FileText', forEntity: ['student'] },
  { id: 'prior_diploma', label: 'Diplôme / Attestation antérieure', icon: 'Award', forEntity: ['student', 'teacher'] },
  { id: 'staff_contract', label: 'Contrat de travail / Convention', icon: 'FileCheck', forEntity: ['teacher'] },
  { id: 'identity_photo', label: 'Photo d’identité numérisée', icon: 'Image', forEntity: ['student', 'teacher'] },
  { id: 'ministry_authorization', label: 'Agrément ministériel / Statuts', icon: 'Shield', forEntity: ['school'] },
  { id: 'other_vault', label: 'Autre document administratif', icon: 'FolderLock', forEntity: ['student', 'teacher', 'school'] },
];

export const OFFICIAL_DOCUMENT_TEMPLATES = [
  {
    id: 'school_certificate',
    title: 'Attestation de Scolarité',
    category: 'Scolarité',
    description: 'Atteste de l’inscription régulière et de la présence de l’élève pour les démarches administratives.',
    icon: GraduationCap,
    badgeColor: 'blue',
  },
  {
    id: 'attendance_certificate',
    title: 'Certificat de Fréquentation',
    category: 'Scolarité',
    description: 'Certifie l’assiduité de l’élève pour les organismes sociaux et de santé.',
    icon: CalendarCheck,
    badgeColor: 'teal',
  },
  {
    id: 'parent_summons',
    title: 'Convocation de Parent / Tuteur',
    category: 'Discipline & Suivi',
    description: 'Convocation formelle avec motif, date, heure, lieu et coupon-réponse détachable.',
    icon: MailWarning,
    badgeColor: 'amber',
  },
  {
    id: 'honor_diploma',
    title: 'Diplôme de Réussite & Tableau d’Honneur',
    category: 'Mérite & Récompenses',
    description: 'Diplôme prestige avec cadre doré, notes, rangs et félicitations du conseil.',
    icon: Award,
    badgeColor: 'purple',
  },
  {
    id: 'report_card',
    title: 'Bulletin Scolaire Trimestriel',
    category: 'Évaluations',
    description: 'Relevé de notes officiel avec appréciations, rangs et moyennes par matière.',
    icon: FileText,
    badgeColor: 'indigo',
  },
  {
    id: 'payslip',
    title: 'Bulletin de Salaire (Fiche de Paie)',
    category: 'Ressources Humaines',
    description: 'Fiche de paie officielle pour enseignants et personnel avec cotisations.',
    icon: Receipt,
    badgeColor: 'emerald',
  },
  {
    id: 'account_statement',
    title: 'Relevé Financier Élève',
    category: 'Finances',
    description: 'État complet des versements, reste à payer et échéances de la scolarité.',
    icon: CreditCard,
    badgeColor: 'cyan',
  },
  {
    id: 'student_card',
    title: 'Carte d’Identité Scolaire',
    category: 'Administration',
    description: 'Badge plastifiable avec photo, matricule, QR code et contacts du tuteur.',
    icon: Contact,
    badgeColor: 'slate',
  },
  {
    id: 'class_roster',
    title: 'Registre & Fiche d’Appel Vierge',
    category: 'Pédagogie',
    description: 'Feuille d’émargement officielle de classe pour l’appel quotidien.',
    icon: Users,
    badgeColor: 'blue',
  },
  {
    id: 'supply_list',
    title: 'Liste des Fournitures Scolaires',
    category: 'Rentrée',
    description: 'Catalogue des manuels et fournitures de classe avec budget estimatif.',
    icon: ShoppingBag,
    badgeColor: 'teal',
  },
];

export default function DocumentsPage() {
  const { school, academicYear } = useApp();
  const { profile } = useAuth();

  // Navigation
  const [activeTab, setActiveTab] = useState<'generate' | 'vault'>('generate');

  // School data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [studentParents, setStudentParents] = useState<StudentParent[]>([]);
  const [loading, setLoading] = useState(true);

  // Vault upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadEntityType, setUploadEntityType] = useState<'student' | 'teacher' | 'school'>('student');
  const [uploadEntityId, setUploadEntityId] = useState<string>('');
  const [uploadDocType, setUploadDocType] = useState<string>('birth_certificate');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileBase64, setUploadFileBase64] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Vault filters
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultEntityFilter, setVaultEntityFilter] = useState<'all' | 'student' | 'teacher' | 'school'>('all');
  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>('all');

  // Preview modal for vault items
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  // Document Generator Modal State
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('school_certificate');
  const [generatorClassId, setGeneratorClassId] = useState<string>('');
  const [generatorStudentId, setGeneratorStudentId] = useState<string>('');
  const [generatorTeacherId, setGeneratorTeacherId] = useState<string>('');
  
  // Specific Generator parameters
  const [paramPurpose, setParamPurpose] = useState('');
  const [paramSummonsDate, setParamSummonsDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [paramSummonsTime, setParamSummonsTime] = useState('10:00');
  const [paramSummonsLocation, setParamSummonsLocation] = useState('Bureau de la Direction');
  const [paramSummonsReason, setParamSummonsReason] = useState('Entretien concernant le comportement et les résultats scolaires');
  const [paramSummonsNotes, setParamSummonsNotes] = useState('');
  const [paramDiplomaType, setParamDiplomaType] = useState<'reussite' | 'tableau_honneur' | 'excellence' | 'encouragement'>('tableau_honneur');
  const [paramDiplomaDistinction, setParamDiplomaDistinction] = useState('Félicitations du Conseil de Classe');
  const [paramDiplomaPeriod, setParamDiplomaPeriod] = useState('Année Scolaire 2026-2027');
  const [paramDiplomaAverage, setParamDiplomaAverage] = useState<number>(15.5);
  const [paramDiplomaRank, setParamDiplomaRank] = useState<number | string>(1);
  const [paramTerm, setParamTerm] = useState('Trimestre 1');
  const [paramCity, setParamCity] = useState(school?.city || 'Abidjan');
  const [paramDirectorName, setParamDirectorName] = useState('Le Chef d’Établissement');
  
  // Feedback
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  useEffect(() => {
    if (!school) return;
    void fetchData();
  }, [school]);

  async function fetchData() {
    if (!school) return;
    setLoading(true);
    try {
      const [
        { data: docsData },
        { data: studsData },
        { data: classesData },
        { data: teachersData },
        { data: parentsData },
        { data: spData },
      ] = await Promise.all([
        supabase.from('documents').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('students').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('teachers').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('parents').select('*').eq('school_id', school.id),
        supabase.from('student_parents').select('*'),
      ]);

      setDocuments((docsData as Document[]) || []);
      setStudents((studsData as Student[]) || []);
      setClasses((classesData as Class[]) || []);
      setTeachers((teachersData as Teacher[]) || []);
      setParents((parentsData as Parent[]) || []);
      setStudentParents((spData as StudentParent[]) || []);

      if (classesData && classesData.length > 0) {
        setGeneratorClassId(classesData[0].id);
        const classStudents = (studsData || []).filter(s => s.class_id === classesData[0].id);
        if (classStudents.length > 0) {
          setGeneratorStudentId(classStudents[0].id);
        }
      }
      if (teachersData && teachersData.length > 0) {
        setGeneratorTeacherId(teachersData[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter students by selected class for generator
  const availableStudentsForClass = useMemo(() => {
    if (!generatorClassId) return students;
    return students.filter(s => s.class_id === generatorClassId);
  }, [students, generatorClassId]);

  // Selected student entity
  const currentSelectedStudent = useMemo(() => {
    return students.find(s => s.id === generatorStudentId);
  }, [students, generatorStudentId]);

  // Selected student's primary parent
  const currentStudentParent = useMemo(() => {
    if (!currentSelectedStudent) return null;
    const sp = studentParents.find(p => p.student_id === currentSelectedStudent.id);
    if (!sp) return null;
    return parents.find(p => p.id === sp.parent_id);
  }, [currentSelectedStudent, studentParents, parents]);

  // Selected teacher
  const currentSelectedTeacher = useMemo(() => {
    return teachers.find(t => t.id === generatorTeacherId);
  }, [teachers, generatorTeacherId]);

  // Selected class
  const currentSelectedClass = useMemo(() => {
    return classes.find(c => c.id === generatorClassId);
  }, [classes, generatorClassId]);

  // Handle class change in generator
  function handleGeneratorClassChange(newClassId: string) {
    setGeneratorClassId(newClassId);
    const inClass = students.filter(s => s.class_id === newClassId);
    if (inClass.length > 0) {
      setGeneratorStudentId(inClass[0].id);
    } else {
      setGeneratorStudentId('');
    }
  }

  // Handle file select in upload modal
  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Le fichier dépasse la limite maximale autorisée (15 Mo).');
      return;
    }

    setUploadFile(file);
    setUploadError(null);

    // Read file as Base64 Data URL for guaranteed reliability
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Auto title if empty
    if (!uploadTitle) {
      const typeLabel = VAULT_DOC_TYPES.find(t => t.id === uploadDocType)?.label || 'Document';
      let personName = '';
      if (uploadEntityType === 'student') {
        const stud = students.find(s => s.id === uploadEntityId);
        if (stud) personName = ` - ${stud.last_name} ${stud.first_name}`;
      } else if (uploadEntityType === 'teacher') {
        const t = teachers.find(teach => teach.id === uploadEntityId);
        if (t) personName = ` - ${t.last_name} ${t.first_name}`;
      }
      setUploadTitle(`${typeLabel}${personName}`);
    }
  }

  // Execute vault upload
  async function handleExecuteUpload() {
    if (!school) return;
    if (!uploadFile) {
      setUploadError('Veuillez sélectionner un fichier à téléverser.');
      return;
    }

    let finalEntityId = uploadEntityId;
    if (uploadEntityType === 'school' || !finalEntityId) {
      finalEntityId = school.id;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const ext = uploadFile.name.split('.').pop() || 'dat';
      const cleanFileName = `${uploadDocType}_${Date.now()}.${ext}`;
      const storagePath = `${school.id}/${uploadEntityType}/${finalEntityId}/${cleanFileName}`;

      let finalFileUrl = uploadFileBase64;

      // Try uploading to Supabase Storage if possible
      try {
        const { error: storageError } = await supabase.storage
          .from('school-documents')
          .upload(storagePath, uploadFile, {
            upsert: true,
            contentType: uploadFile.type,
          });

        if (!storageError) {
          const { data } = supabase.storage.from('school-documents').getPublicUrl(storagePath);
          if (data?.publicUrl) {
            finalFileUrl = data.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Supabase storage bucket unconfigured, using Data URL fallback:', err);
      }

      // Insert record in documents table
      const { data: newDoc, error: dbError } = await supabase
        .from('documents')
        .insert({
          school_id: school.id,
          entity_type: uploadEntityType,
          entity_id: finalEntityId,
          document_type: uploadDocType,
          title: uploadTitle.trim() || uploadFile.name,
          file_url: finalFileUrl,
          file_size: uploadFile.size,
          uploaded_by: profile?.id || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (newDoc) {
        setDocuments(prev => [newDoc as Document, ...prev]);
      }

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadFileBase64('');
      setUploadTitle('');
      setActionSuccessMessage('Le document a été archivé avec succès dans le coffre-fort numérique !');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Erreur lors de l’archivage du document:', err);
      setUploadError(err.message || 'Une erreur est survenue lors de l’enregistrement du document.');
    } finally {
      setIsUploading(false);
    }
  }

  // Delete vault document
  async function handleDeleteDocument(docId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce document des archives ?')) return;

    try {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (previewDoc?.id === docId) setPreviewDoc(null);
    } catch (err) {
      console.error('Erreur suppression document:', err);
      alert('Impossible de supprimer ce document.');
    }
  }

  // Build HTML for currently selected template
  function generateCurrentHtml(): { html: string; title: string; baseFileName: string; entityType: string; entityId: string } | null {
    if (!school) return null;

    const academicYearName = academicYear?.name || '2026-2027';
    const className = currentSelectedClass?.name || 'Classe non assignée';

    if (selectedTemplateId === 'school_certificate' || selectedTemplateId === 'attendance_certificate') {
      if (!currentSelectedStudent) return null;
      const isAttestation = selectedTemplateId === 'school_certificate';
      const title = isAttestation ? `Attestation de Scolarité - ${currentSelectedStudent.last_name}` : `Certificat de Fréquentation - ${currentSelectedStudent.last_name}`;
      const baseFileName = `${isAttestation ? 'attestation' : 'frequentation'}_${currentSelectedStudent.matricule}`;

      const html = buildSchoolCertificateHtml({
        school,
        certificateType: isAttestation ? 'attestation_scolarite' : 'certificat_frequentation',
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          date_of_birth: (currentSelectedStudent as any).date_of_birth,
          place_of_birth: (currentSelectedStudent as any).place_of_birth,
          gender: currentSelectedStudent.sex,
        },
        className,
        academicYearName,
        city: paramCity,
        directorName: paramDirectorName,
        purpose: paramPurpose,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'parent_summons') {
      if (!currentSelectedStudent) return null;
      const parentName = currentStudentParent ? `${currentStudentParent.first_name} ${currentStudentParent.last_name}` : 'Parent / Tuteur';
      const parentPhone = currentStudentParent?.phone || '';
      const title = `Convocation Parent - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `convocation_${currentSelectedStudent.matricule}`;

      const html = buildParentSummonsHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
        },
        parentName,
        parentPhone,
        className,
        summonsDate: formatDate(paramSummonsDate),
        summonsTime: paramSummonsTime,
        location: paramSummonsLocation,
        reason: paramSummonsReason,
        notes: paramSummonsNotes,
        directorName: paramDirectorName,
        city: paramCity,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'honor_diploma') {
      if (!currentSelectedStudent) return null;
      const title = `Diplôme d’Honneur - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `diplome_${currentSelectedStudent.matricule}`;

      const html = buildHonorDiplomaHtml({
        school,
        diplomaType: paramDiplomaType,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          photo_url: currentSelectedStudent.photo_url,
        },
        className,
        academicYearName,
        periodLabel: paramDiplomaPeriod,
        average: Number(paramDiplomaAverage),
        rank: paramDiplomaRank,
        distinction: paramDiplomaDistinction,
        city: paramCity,
        directorName: paramDirectorName,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'student_card') {
      if (!currentSelectedStudent) return null;
      const title = `Carte Scolaire - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `carte_scolaire_${currentSelectedStudent.matricule}`;
      const parentName = currentStudentParent ? `${currentStudentParent.first_name} ${currentStudentParent.last_name}` : undefined;
      const parentPhone = currentStudentParent?.phone || undefined;

      const html = buildStudentCardHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          photo_url: currentSelectedStudent.photo_url,
        },
        className,
        academicYearName,
        primaryGuardian: parentName,
        primaryGuardianPhone: parentPhone,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'class_roster') {
      const title = `Feuille d’Appel & Registre - ${className}`;
      const baseFileName = `registre_${className.replace(/\s+/g, '_')}`;

      const html = buildClassAttendanceSheetHtml({
        school,
        className,
        academicYearName,
        monthName: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        students: availableStudentsForClass.map(s => ({
          matricule: s.matricule,
          first_name: s.first_name,
          last_name: s.last_name,
          sex: s.sex || 'M',
        })),
      });

      return { html, title, baseFileName, entityType: 'class', entityId: currentSelectedClass?.id || school.id };
    }

    if (selectedTemplateId === 'report_card') {
      if (!currentSelectedStudent) return null;
      const title = `Bulletin Scolaire - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `bulletin_${currentSelectedStudent.matricule}`;

      const sampleSubjects = [
        { name: 'Français (Expression & Grammaire)', devoirsAvg: 14.5, compScore: 15, subjectAvg: 14.8, coefficient: 4, weightedScore: 59.2 },
        { name: 'Mathématiques & Géométrie', devoirsAvg: 16.0, compScore: 17.5, subjectAvg: 17.0, coefficient: 4, weightedScore: 68.0 },
        { name: 'Sciences de la Vie & de la Terre', devoirsAvg: 13.0, compScore: 14.0, subjectAvg: 13.7, coefficient: 2, weightedScore: 27.4 },
        { name: 'Histoire & Géographie', devoirsAvg: 15.0, compScore: 14.5, subjectAvg: 14.7, coefficient: 2, weightedScore: 29.4 },
        { name: 'Anglais', devoirsAvg: 16.5, compScore: 18.0, subjectAvg: 17.5, coefficient: 2, weightedScore: 35.0 },
        { name: 'Éducation Civique & Morale', devoirsAvg: 17.0, compScore: 16.0, subjectAvg: 16.3, coefficient: 1, weightedScore: 16.3 },
      ];

      const html = buildReportCardHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          photo_url: currentSelectedStudent.photo_url,
        },
        className,
        academicYearName,
        term: paramTerm,
        subjects: sampleSubjects,
        overallAverage: 15.7,
        rank: 1,
        totalStudents: availableStudentsForClass.length || 28,
        classAverage: 12.8,
        maxAverage: 16.9,
        minAverage: 7.5,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'payslip') {
      const teacher = currentSelectedTeacher;
      const name = teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Enseignant';
      const title = `Bulletin de Salaire - ${name}`;
      const baseFileName = `bulletin_paie_${teacher?.matricule || 'personnel'}`;

      const mockPayroll = {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        base_salary: 280000,
        bonuses: 45000,
        deductions: 22000,
        net_salary: 303000,
        details: {
          sursalaire: 25000,
          transport: 20000,
          anciennete: 15000,
          cr: 3500,
          its: 8500,
          cnps: 10000,
        },
      };

      const html = buildPayslipHtml({
        school,
        payroll: mockPayroll,
        person: teacher || {
          first_name: 'Enseignant',
          last_name: 'Principal',
          matricule: 'ENS-001',
          specialty: 'Lettres Modernes',
        },
      });

      return { html, title, baseFileName, entityType: 'teacher', entityId: teacher?.id || school.id };
    }

    if (selectedTemplateId === 'account_statement') {
      if (!currentSelectedStudent) return null;
      const title = `Relevé Financier - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `releve_compte_${currentSelectedStudent.matricule}`;

      const html = buildStudentAccountStatementHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
        },
        className,
        academicYearName,
        planName: 'Plan Standard Trimestriel',
        totalExpected: 350000,
        totalPaid: 250000,
        remaining: 100000,
        installments: [
          { installment_number: 1, label: 'Inscription & 1ère Tranche', amount: 150000, due_date: '2026-09-15' },
          { installment_number: 2, label: '2ème Tranche', amount: 100000, due_date: '2026-12-15' },
          { installment_number: 3, label: '3ème Tranche (Solde)', amount: 100000, due_date: '2027-03-15' },
        ],
        paymentHistory: [
          { receipt_number: 'REC-2026-00142', payment_date: '2026-09-10', payment_method: 'Espèces', amount: 150000 },
          { receipt_number: 'REC-2026-00984', payment_date: '2026-12-12', payment_method: 'Wave / Mobile Money', amount: 100000 },
        ],
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    if (selectedTemplateId === 'supply_list') {
      const title = `Liste des Fournitures - ${className}`;
      const baseFileName = `fournitures_${className.replace(/\s+/g, '_')}`;

      const sampleSupplies = [
        { item_name: 'Livre de Lecture & Expression CP/CE', category: 'manuel' as const, quantity: 1, unit_price: 6500, is_mandatory: true, notes: 'Programme officiel' },
        { item_name: 'Cahier de Mathématiques 200 pages', category: 'cahier' as const, quantity: 3, unit_price: 1200, is_mandatory: true, notes: 'Grands carreaux' },
        { item_name: 'Boîte de craies et ardoise', category: 'papeterie' as const, quantity: 1, unit_price: 2500, is_mandatory: true },
        { item_name: 'Boîte d’instruments de géométrie', category: 'geometrie' as const, quantity: 1, unit_price: 3500, is_mandatory: true },
        { item_name: 'Uniforme scolaire réglementaire', category: 'uniforme' as const, quantity: 2, unit_price: 12000, is_mandatory: true, notes: 'Écusson de l’école inclus' },
      ];

      const html = buildClassSupplyListHtml({
        school,
        className,
        academicYearName,
        items: sampleSupplies,
      });

      return { html, title, baseFileName, entityType: 'class', entityId: currentSelectedClass?.id || school.id };
    }

    return null;
  }

  // Action: Live Print
  function handlePrintCurrentDocument() {
    const generated = generateCurrentHtml();
    if (!generated) {
      alert('Veuillez sélectionner un élève ou renseigner les champs requis.');
      return;
    }
    openPrintPreview(generated.html);
  }

  // Action: Download HTML
  function handleDownloadCurrentDocument() {
    const generated = generateCurrentHtml();
    if (!generated) {
      alert('Veuillez sélectionner un élève ou renseigner les champs requis.');
      return;
    }
    downloadTextDocument(generated.html, `${generated.baseFileName}.html`);
  }

  // Action: Archive Document in School Database
  async function handleArchiveCurrentDocument() {
    const generated = generateCurrentHtml();
    if (!generated || !school) {
      alert('Veuillez sélectionner un élève ou renseigner les champs requis.');
      return;
    }

    setIsGeneratingDoc(true);
    try {
      await saveGeneratedDocument({
        schoolId: school.id,
        entityType: generated.entityType,
        entityId: generated.entityId,
        documentType: selectedTemplateId,
        title: generated.title,
        baseFileName: generated.baseFileName,
        html: generated.html,
        uploadedBy: profile?.id,
      });

      // Refresh documents
      const { data: updatedDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false });

      setDocuments((updatedDocs as Document[]) || []);
      setActionSuccessMessage(`Le document "${generated.title}" a été archivé avec succès dans les documents de l'établissement !`);
      setIsGeneratorModalOpen(false);
      setTimeout(() => setActionSuccessMessage(null), 4500);
    } catch (err: any) {
      console.error('Erreur archivage document:', err);
      alert('Une erreur est survenue lors de l’archivage du document.');
    } finally {
      setIsGeneratingDoc(false);
    }
  }

  // Open generator modal for a template
  function openGeneratorFor(templateId: string) {
    setSelectedTemplateId(templateId);
    setIsGeneratorModalOpen(true);
  }

  // Filtered Vault documents
  const filteredVaultDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Entity filter
      if (vaultEntityFilter !== 'all' && doc.entity_type !== vaultEntityFilter) return false;
      // Type filter
      if (vaultTypeFilter !== 'all' && doc.document_type !== vaultTypeFilter) return false;
      // Search
      if (vaultSearch.trim()) {
        const query = vaultSearch.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesType = doc.document_type.toLowerCase().includes(query);
        return matchesTitle || matchesType;
      }
      return true;
    });
  }, [documents, vaultEntityFilter, vaultTypeFilter, vaultSearch]);

  // Resolve entity name for vault item
  function getEntityLabel(doc: Document) {
    if (doc.entity_type === 'student') {
      const student = students.find(s => s.id === doc.entity_id);
      if (student) {
        const cl = classes.find(c => c.id === student.class_id);
        return `Élève : ${student.last_name} ${student.first_name} (${cl?.name || 'Sans classe'}) - Matr. ${student.matricule}`;
      }
      return 'Élève';
    }
    if (doc.entity_type === 'teacher') {
      const teacher = teachers.find(t => t.id === doc.entity_id);
      if (teacher) {
        return `Personnel : ${teacher.last_name} ${teacher.first_name}`;
      }
      return 'Personnel / Enseignant';
    }
    return `Établissement : ${school?.name || 'Direction'}`;
  }

  // Count stats
  const totalVaultCount = documents.filter(d => VAULT_DOC_TYPES.some(v => v.id === d.document_type)).length;
  const totalOfficialCount = documents.length - totalVaultCount;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionSuccessMessage && (
        <div className="animate-in fade-in flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-900 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium">{actionSuccessMessage}</p>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Header */}
      <section className="surface-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700">
              <FolderLock size={14} /> Centre de Gestion Documentaire & Coffre-fort Numérique
            </div>
            <h1 className="display-font mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Documents Scolaires & Numérisation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Générez instantanément toutes les pièces officielles (attestations, convocations, diplômes de réussite, bulletins, fiches de paie) et archivez les pièces d’état civil numérisées (extraits de naissance, certificats médicaux, contrats).
            </p>

            {/* Navigation Tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('generate')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  activeTab === 'generate'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sparkles size={16} />
                Générateur de Documents Officiels
              </button>

              <button
                onClick={() => setActiveTab('vault')}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  activeTab === 'vault'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FolderLock size={16} />
                Coffre-fort & Numérisation
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-800">
                  {documents.length}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Header Widget */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              {school?.logo_url ? (
                <img src={school.logo_url} alt={school.name} className="h-14 w-14 rounded-2xl border border-slate-200 object-cover shadow-sm" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white font-bold text-blue-700 shadow-sm">
                  <ImageIcon size={22} />
                </div>
              )}
              <div>
                <p className="font-bold text-slate-900">{school?.name || 'Établissement Scolaire'}</p>
                <p className="text-xs text-slate-500">{school?.city || 'Côte d’Ivoire'} • Sceau & Cachet Actifs</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                <p className="text-xs font-semibold text-slate-500">Documents Générés</p>
                <p className="text-xl font-bold text-blue-700">{totalOfficialCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                <p className="text-xs font-semibold text-slate-500">Pièces Numérisées</p>
                <p className="text-xl font-bold text-emerald-700">{documents.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TAB 1: GENERATEUR DE DOCUMENTS */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Modèles de Documents Prêts à l’Emploi</h2>
              <p className="text-sm text-slate-500">Cliquez sur un document pour configurer les informations et l’imprimer directement.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICIAL_DOCUMENT_TEMPLATES.map(tpl => {
              const IconComp = tpl.icon;
              return (
                <div
                  key={tpl.id}
                  className="surface-card group flex flex-col justify-between p-5 transition hover:border-blue-400 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                        <IconComp size={22} />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {tpl.category}
                      </span>
                    </div>

                    <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-700 transition">
                      {tpl.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Prêt pour impression</span>
                    <button
                      onClick={() => openGeneratorFor(tpl.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600"
                    >
                      <span>Générer</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COFFRE-FORT NUMERIQUE & PIECES JOINTES */}
      {activeTab === 'vault' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Archives & Pièces Numérisées</h2>
              <p className="text-sm text-slate-500">
                Consultez, téléchargez et ajoutez des extraits de naissance, certificats médicaux et pièces d’identité.
              </p>
            </div>

            <button
              onClick={() => {
                setUploadError(null);
                setUploadFile(null);
                setUploadFileBase64('');
                setUploadTitle('');
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Upload size={16} />
              Déposer / Numériser une Pièce
            </button>
          </div>

          {/* Filters Bar */}
          <div className="surface-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher par titre ou type..."
                  value={vaultSearch}
                  onChange={e => setVaultSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Entity Filter */}
              <div>
                <select
                  value={vaultEntityFilter}
                  onChange={e => setVaultEntityFilter(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Toutes les cibles (Élèves, Personnel, Établissement)</option>
                  <option value="student">Élèves uniquement</option>
                  <option value="teacher">Personnel & Enseignants</option>
                  <option value="school">Direction de l’établissement</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={vaultTypeFilter}
                  onChange={e => setVaultTypeFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Tous les types de documents</option>
                  {VAULT_DOC_TYPES.map(vt => (
                    <option key={vt.id} value={vt.id}>
                      {vt.label}
                    </option>
                  ))}
                  <option value="school_certificate">Attestation de scolarité</option>
                  <option value="attendance_certificate">Certificat de fréquentation</option>
                  <option value="parent_summons">Convocation de parent</option>
                  <option value="honor_diploma">Diplôme d'honneur</option>
                  <option value="report_card">Bulletin scolaire</option>
                  <option value="payslip">Bulletin de salaire</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document list */}
          {filteredVaultDocuments.length === 0 ? (
            <EmptyState
              icon={<FolderLock size={44} className="text-slate-400" />}
              title="Aucun document trouvé"
              description="Aucune pièce numérisée ne correspond à vos critères de recherche. Utilisez le bouton 'Déposer / Numériser' pour ajouter un premier fichier."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVaultDocuments.map(doc => {
                const isImage = doc.file_url?.startsWith('data:image') || doc.file_url?.match(/\.(jpeg|jpg|gif|png|webp)/i);
                const isHtml = doc.file_url?.startsWith('data:text/html') || doc.file_url?.endsWith('.html');
                const isPdf = doc.file_url?.startsWith('data:application/pdf') || doc.file_url?.endsWith('.pdf');

                return (
                  <div
                    key={doc.id}
                    className="surface-card flex flex-col justify-between p-5 transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {VAULT_DOC_TYPES.find(v => v.id === doc.document_type)?.label || doc.document_type}
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-bold text-slate-900 line-clamp-1" title={doc.title}>
                        {doc.title}
                      </h4>

                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {getEntityLabel(doc)}
                      </p>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                        <span>{formatDate(doc.created_at)}</span>
                        {doc.file_size ? <span>• {Math.round(doc.file_size / 1024)} Ko</span> : null}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Preview */}
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          title="Visualiser"
                        >
                          <Eye size={13} />
                          <span>Voir</span>
                        </button>

                        {/* Download */}
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            download={doc.title}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                            title="Télécharger"
                          >
                            <Download size={13} />
                            <span>Télécharger</span>
                          </a>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DOCUMENT GENERATOR STUDIO                          */}
      {/* ========================================================= */}
      <Modal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        title={OFFICIAL_DOCUMENT_TEMPLATES.find(t => t.id === selectedTemplateId)?.title || 'Générateur de Document'}
        size="lg"
        actions={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <button
              onClick={() => setIsGeneratorModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Annuler
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadCurrentDocument}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download size={15} />
                <span>Télécharger HTML</span>
              </button>

              <button
                onClick={handleArchiveCurrentDocument}
                disabled={isGeneratingDoc}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <FolderLock size={15} />
                <span>{isGeneratingDoc ? 'Archivage...' : 'Archiver dans le dossier'}</span>
              </button>

              <button
                onClick={handlePrintCurrentDocument}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Printer size={15} />
                <span>Imprimer / PDF Direct</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Target Selection: Class & Student (or Staff) */}
          {selectedTemplateId === 'payslip' ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Personnel / Enseignant Bénéficiaire
              </label>
              <select
                value={generatorTeacherId}
                onChange={e => setGeneratorTeacherId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.last_name} {t.first_name} — {t.specialty || 'Enseignant'} (Matr: {t.matricule})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Classe
                </label>
                <select
                  value={generatorClassId}
                  onChange={e => handleGeneratorClassChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplateId !== 'class_roster' && selectedTemplateId !== 'supply_list' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Élève concerné
                  </label>
                  <select
                    value={generatorStudentId}
                    onChange={e => setGeneratorStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    {availableStudentsForClass.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.last_name} {s.first_name} (Matr: {s.matricule})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Context Banner */}
          {currentSelectedStudent && selectedTemplateId !== 'payslip' && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50/70 border border-blue-200/60 p-3 text-xs text-blue-900">
              <GraduationCap className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold">
                  {currentSelectedStudent.last_name} {currentSelectedStudent.first_name}
                </span>{' '}
                • Matricule : <span className="font-mono">{currentSelectedStudent.matricule}</span>
                {currentStudentParent && (
                  <span className="ml-2 text-blue-700">
                    • Tuteur : {currentStudentParent.first_name} {currentStudentParent.last_name} ({currentStudentParent.phone || 'Sans contact'})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Specific Parameters: Attestation & Frequentation */}
          {(selectedTemplateId === 'school_certificate' || selectedTemplateId === 'attendance_certificate') && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mention spéciale / Objet spécifique (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex : Pour constitution de dossier d'allocations familiales"
                  value={paramPurpose}
                  onChange={e => setParamPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Specific Parameters: Convocation Parent */}
          {selectedTemplateId === 'parent_summons' && (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date du rendez-vous</label>
                  <input
                    type="date"
                    value={paramSummonsDate}
                    onChange={e => setParamSummonsDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Heure précise</label>
                  <input
                    type="text"
                    placeholder="Ex: 10h00"
                    value={paramSummonsTime}
                    onChange={e => setParamSummonsTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lieu d'accueil</label>
                  <input
                    type="text"
                    value={paramSummonsLocation}
                    onChange={e => setParamSummonsLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Objet / Motif de la convocation</label>
                <input
                  type="text"
                  value={paramSummonsReason}
                  onChange={e => setParamSummonsReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Consignes complémentaires</label>
                <textarea
                  rows={2}
                  value={paramSummonsNotes}
                  onChange={e => setParamSummonsNotes(e.target.value)}
                  placeholder="Ex : Prière de vous munir du carnet de correspondance et de la pièce d'identité."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Specific Parameters: Diplome & Tableau d'Honneur */}
          {selectedTemplateId === 'honor_diploma' && (
            <div className="space-y-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type de Diplôme</label>
                  <select
                    value={paramDiplomaType}
                    onChange={e => setParamDiplomaType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="tableau_honneur">Tableau d'Honneur</option>
                    <option value="excellence">Prix d'Excellence</option>
                    <option value="reussite">Diplôme de Réussite</option>
                    <option value="encouragement">Diplôme d'Encouragement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mention / Distinction</label>
                  <input
                    type="text"
                    value={paramDiplomaDistinction}
                    onChange={e => setParamDiplomaDistinction(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Période concernée</label>
                  <input
                    type="text"
                    value={paramDiplomaPeriod}
                    onChange={e => setParamDiplomaPeriod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Moyenne (/20)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paramDiplomaAverage}
                    onChange={e => setParamDiplomaAverage(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rang de l'élève</label>
                  <input
                    type="text"
                    value={paramDiplomaRank}
                    onChange={e => setParamDiplomaRank(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specific Parameters: Bulletin Scolaire */}
          {selectedTemplateId === 'report_card' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Période d'évaluation</label>
                <select
                  value={paramTerm}
                  onChange={e => setParamTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Trimestre 1">1er Trimestre</option>
                  <option value="Trimestre 2">2ème Trimestre</option>
                  <option value="Trimestre 3">3ème Trimestre (Bilan Annuel)</option>
                  <option value="Semestre 1">1er Semestre</option>
                  <option value="Semestre 2">2ème Semestre</option>
                </select>
              </div>
            </div>
          )}

          {/* Common Signatures and Location Settings */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ville d'émission</label>
              <input
                type="text"
                value={paramCity}
                onChange={e => setParamCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Signataire officiel</label>
              <input
                type="text"
                value={paramDirectorName}
                onChange={e => setParamDirectorName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: UPLOAD VAULT PIECE (Extrait, Certificat, CNI...)   */}
      {/* ========================================================= */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Numériser & Archiver une Pièce Justificative"
        size="md"
        actions={
          <div className="flex justify-end gap-2 w-full">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              onClick={handleExecuteUpload}
              disabled={isUploading || !uploadFile}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload size={15} />
              <span>{isUploading ? 'Enregistrement...' : 'Enregistrer dans le coffre'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {uploadError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium">
              {uploadError}
            </div>
          )}

          {/* 1. Target Entity Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Cible du document
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadEntityType('student');
                  if (students.length > 0) setUploadEntityId(students[0].id);
                }}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  uploadEntityType === 'student'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Élève
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadEntityType('teacher');
                  if (teachers.length > 0) setUploadEntityId(teachers[0].id);
                }}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  uploadEntityType === 'teacher'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Personnel
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadEntityType('school');
                  setUploadEntityId(school?.id || '');
                }}
                className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                  uploadEntityType === 'school'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Établissement
              </button>
            </div>
          </div>

          {/* 2. Select Specific Person */}
          {uploadEntityType === 'student' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sélectionner l'élève</label>
              <select
                value={uploadEntityId}
                onChange={e => setUploadEntityId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {students.map(s => {
                  const cl = classes.find(c => c.id === s.class_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.last_name} {s.first_name} ({cl?.name || 'Sans classe'}) — Matr: {s.matricule}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {uploadEntityType === 'teacher' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sélectionner l'enseignant / agent</label>
              <select
                value={uploadEntityId}
                onChange={e => setUploadEntityId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.last_name} {t.first_name} — {t.specialty || 'Enseignant'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Document Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nature de la pièce</label>
            <select
              value={uploadDocType}
              onChange={e => {
                setUploadDocType(e.target.value);
                const typeObj = VAULT_DOC_TYPES.find(v => v.id === e.target.value);
                if (typeObj) {
                  let suffix = '';
                  if (uploadEntityType === 'student') {
                    const st = students.find(s => s.id === uploadEntityId);
                    if (st) suffix = ` - ${st.last_name} ${st.first_name}`;
                  }
                  setUploadTitle(`${typeObj.label}${suffix}`);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              {VAULT_DOC_TYPES.map(vt => (
                <option key={vt.id} value={vt.id}>
                  {vt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Titre / Libellé de la pièce</label>
            <input
              type="text"
              placeholder="Ex : Extrait de naissance Kouassi Marc"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 5. File Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fichier (PDF, Image, Scan)</label>
            <div className="relative rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-400 bg-slate-50/50">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,.docx,.doc"
                onChange={handleFileSelect}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex flex-col items-center justify-center">
                <Upload size={32} className="text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {uploadFile ? uploadFile.name : 'Glissez-déposez le fichier ici ou cliquez pour parcourir'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Formats acceptés : PDF, PNG, JPG, DOCX (Max 15 Mo)
                </p>
                {uploadFile && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={12} /> {Math.round(uploadFile.size / 1024)} Ko sélectionné
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: DOCUMENT PREVIEW MODAL                             */}
      {/* ========================================================= */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'Aperçu du document'}
        size="xl"
        actions={
          previewDoc?.file_url ? (
            <div className="flex justify-end gap-2 w-full">
              <a
                href={previewDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Download size={14} /> Télécharger l'original
              </a>
            </div>
          ) : undefined
        }
      >
        <div className="p-2">
          {previewDoc?.file_url ? (
            previewDoc.file_url.startsWith('data:image') || previewDoc.file_url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
              <div className="flex justify-center bg-slate-900/5 p-4 rounded-xl">
                <img
                  src={previewDoc.file_url}
                  alt={previewDoc.title}
                  className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-sm"
                />
              </div>
            ) : (
              <iframe
                src={previewDoc.file_url}
                title={previewDoc.title}
                className="h-[60vh] w-full rounded-xl border border-slate-200"
              />
            )
          ) : (
            <p className="text-center text-sm text-slate-400 py-10">Aucun aperçu disponible pour ce fichier.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
