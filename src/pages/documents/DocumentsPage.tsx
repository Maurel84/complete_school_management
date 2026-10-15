import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import { formatDate, formatCurrency } from '../../lib/utils';
import type { Document, Student, Class, Teacher, Parent, StudentParent, Subject, Grade, Payment, SchoolSupplyItem, Staff } from '../../types';
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
  CheckCircle2,
  FolderLock,
  X,
  Shield,
  FileCheck,
  FileCheck2,
  Briefcase,
  Navigation,
  ImageIcon,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  buildSchoolCertificateHtml,
  buildParentSummonsHtml,
  buildHonorDiplomaHtml,
  buildReportCardHtml,
  buildPayslipHtml,
  buildStudentAccountStatementHtml,
  buildStudentCardHtml,
  buildClassAttendanceSheetHtml,
  buildClassSupplyListHtml,
  buildWorkAttestationHtml,
  buildWorkCertificateHtml,
  buildMissionOrderHtml,
  buildRecommendationLetterHtml,
  openPrintPreview,
  downloadTextDocument,
} from '../../lib/printableDocuments';
import { saveGeneratedDocument } from '../../lib/generatedDocuments';
import { resolveStudentFinance } from '../../lib/financePlanResolver';

export const VAULT_DOC_TYPES: { id: string; label: string; icon: string; forEntity: ('student' | 'teacher' | 'school')[] }[] = [
  { id: 'birth_certificate', label: 'Extrait d’acte de naissance', icon: 'FileText', forEntity: ['student'] },
  { id: 'medical_certificate', label: 'Certificat médical / Carnet de santé', icon: 'Shield', forEntity: ['student', 'teacher'] },
  { id: 'id_card', label: 'Pièce d’identité (CNI / Passeport)', icon: 'FileCheck', forEntity: ['student', 'teacher', 'school'] },
  { id: 'transfer_certificate', label: 'Certificat de radiation / Transfert', icon: 'FileText', forEntity: ['student'] },
  { id: 'prior_diploma', label: 'Diplôme / Attestation antérieure', icon: 'Award', forEntity: ['student', 'teacher'] },
  { id: 'staff_contract', label: 'Contrat de travail / Convention', icon: 'FileCheck', forEntity: ['teacher'] },
  { id: 'work_certificate_uploaded', label: 'Certificat de travail (Départ archivé)', icon: 'FileCheck2', forEntity: ['teacher'] },
  { id: 'resume_cv', label: 'Curriculum Vitae (CV) & Lettre de motivation', icon: 'Briefcase', forEntity: ['teacher'] },
  { id: 'resignation_letter', label: 'Lettre de démission / Notification de départ', icon: 'FileText', forEntity: ['teacher'] },
  { id: 'identity_photo', label: 'Photo d’identité numérisée', icon: 'Image', forEntity: ['student', 'teacher'] },
  { id: 'ministry_authorization', label: 'Agrément ministériel / Statuts', icon: 'Shield', forEntity: ['school'] },
  { id: 'other_vault', label: 'Autre document administratif', icon: 'FolderLock', forEntity: ['student', 'teacher', 'school'] },
];

export const OFFICIAL_DOCUMENT_TEMPLATES = [
  {
    id: 'school_certificate',
    title: 'Attestation de Scolarité',
    category: 'Scolarité',
    description: 'Atteste de l’inscription régulière et assidue de l’élève avec en-tête et cachet officiel.',
    icon: GraduationCap,
    badgeColor: 'blue',
  },
  {
    id: 'attendance_certificate',
    title: 'Certificat de Fréquentation',
    category: 'Scolarité',
    description: 'Certifie la fréquentation et présence aux cours pour la CNPS, mutuelles et allocations.',
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
    description: 'Diplôme prestige avec cadre d’honneur, moyenne réelle, rang et félicitations du conseil.',
    icon: Award,
    badgeColor: 'purple',
  },
  {
    id: 'report_card',
    title: 'Bulletin Scolaire Trimestriel',
    category: 'Évaluations',
    description: 'Relevé de notes officiel avec notes réelles, coefficients, moyennes et appréciations.',
    icon: FileText,
    badgeColor: 'indigo',
  },
  {
    id: 'payslip',
    title: 'Bulletin de Salaire (Fiche de Paie)',
    category: 'Ressources Humaines',
    description: 'Fiche de paie officielle pour enseignants et personnel avec détail des cotisations.',
    icon: Receipt,
    badgeColor: 'emerald',
  },
  {
    id: 'work_attestation',
    title: 'Attestation de Travail (En fonction)',
    category: 'Ressources Humaines',
    description: 'Atteste qu’un membre du personnel ou enseignant est sous contrat actif (démarches bancaires, visas, CNPS).',
    icon: Briefcase,
    badgeColor: 'teal',
  },
  {
    id: 'work_certificate',
    title: 'Certificat de Travail (Fin de contrat / Départ)',
    category: 'Ressources Humaines',
    description: 'Document officiel obligatoire remis au salarié à son départ (certifie qu’il quitte libre de tout engagement).',
    icon: FileCheck2,
    badgeColor: 'amber',
  },
  {
    id: 'mission_order',
    title: 'Ordre de Mission Officiel',
    category: 'Administration & RH',
    description: 'Autorisation formelle de déplacement pour séminaires, examens officiels ou missions d’inspection.',
    icon: Navigation,
    badgeColor: 'blue',
  },
  {
    id: 'recommendation_letter',
    title: 'Lettre de Recommandation Professionnelle',
    category: 'Ressources Humaines',
    description: 'Lettre de recommandation élogieuse signée de la Direction pour concours, embauche ou mobilités.',
    icon: Award,
    badgeColor: 'purple',
  },
  {
    id: 'account_statement',
    title: 'Relevé Financier Élève',
    category: 'Finances',
    description: 'Situation financière réelle : versements réels, solde restant et échéancier.',
    icon: CreditCard,
    badgeColor: 'cyan',
  },
  {
    id: 'student_card',
    title: 'Carte d’Identité Scolaire',
    category: 'Administration',
    description: 'Badge plastifiable avec photo, matricule, QR code et contacts d’urgence.',
    icon: Contact,
    badgeColor: 'slate',
  },
  {
    id: 'class_roster',
    title: 'Registre & Fiche d’Appel Vierge',
    category: 'Pédagogie',
    description: 'Feuille d’émargement officielle avec liste réelle des élèves de la classe.',
    icon: Users,
    badgeColor: 'blue',
  },
  {
    id: 'supply_list',
    title: 'Liste des Fournitures Scolaires',
    category: 'Rentrée',
    description: 'Catalogue des manuels et fournitures réels de la classe avec budget estimatif.',
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
  const [staff, setStaff] = useState<Staff[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [studentParents, setStudentParents] = useState<StudentParent[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [canteenPayments, setCanteenPayments] = useState<any[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [studentFees, setStudentFees] = useState<any[]>([]);
  const [studentInstallments, setStudentInstallments] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [schoolSupplies, setSchoolSupplies] = useState<SchoolSupplyItem[]>([]);
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
  
  // Specific Generator parameters (Synchronized with selected student/teacher)
  const [paramBirthDate, setParamBirthDate] = useState('');
  const [paramBirthPlace, setParamBirthPlace] = useState('');
  const [paramPurpose, setParamPurpose] = useState('');

  // Parent Convocation
  const [paramParentName, setParamParentName] = useState('');
  const [paramParentPhone, setParamParentPhone] = useState('');
  const [paramSummonsDate, setParamSummonsDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [paramSummonsTime, setParamSummonsTime] = useState('10:00');
  const [paramSummonsLocation, setParamSummonsLocation] = useState('Bureau de la Direction');
  const [paramSummonsReason, setParamSummonsReason] = useState('Entretien concernant le comportement et les résultats scolaires');
  const [paramSummonsNotes, setParamSummonsNotes] = useState('');

  // Diploma
  const [paramDiplomaType, setParamDiplomaType] = useState<'reussite' | 'tableau_honneur' | 'excellence' | 'encouragement'>('tableau_honneur');
  const [paramDiplomaDistinction, setParamDiplomaDistinction] = useState('Félicitations du Conseil de Classe');
  const [paramDiplomaPeriod, setParamDiplomaPeriod] = useState('Année Scolaire 2026-2027');
  const [paramDiplomaAverage, setParamDiplomaAverage] = useState<number>(14.0);
  const [paramDiplomaRank, setParamDiplomaRank] = useState<number | string>(1);

  // Term
  const [paramTerm, setParamTerm] = useState('Trimestre 1');
  const [paramCity, setParamCity] = useState(school?.city || 'Abidjan');
  const [paramDirectorName, setParamDirectorName] = useState('Le Chef d’Établissement');

  // Teacher / Staff Payroll parameters
  const [payrollMonth, setPayrollMonth] = useState<number>(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(new Date().getFullYear());
  const [salaryBase, setSalaryBase] = useState<number>(250000);
  const [salarySursalaire, setSalarySursalaire] = useState<number>(25000);
  const [salaryTransport, setSalaryTransport] = useState<number>(20000);
  const [salaryAnciennete, setSalaryAnciennete] = useState<number>(15000);
  const [salaryAutresPrimes, setSalaryAutresPrimes] = useState<number>(10000);
  const [salaryDeductions, setSalaryDeductions] = useState<number>(15000);

  // Staff Official Documents parameters (Attestation, Certificat de Travail, Ordre de Mission, Recommandation)
  const [paramStaffPosition, setParamStaffPosition] = useState('');
  const [paramStaffDepartment, setParamStaffDepartment] = useState('');
  const [paramStaffContractType, setParamStaffContractType] = useState('CDI');
  const [paramStaffHireDate, setParamStaffHireDate] = useState('');
  const [paramStaffEndDate, setParamStaffEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paramStaffCni, setParamStaffCni] = useState('');
  const [paramStaffDepartureReason, setParamStaffDepartureReason] = useState('Fin normale du contrat de travail');
  const [paramStaffAttestationPurpose, setParamStaffAttestationPurpose] = useState('Pour servir et valoir ce que de droit (démarches administratives, bancaires ou consulaires)');

  // Mission Order parameters
  const [paramMissionDestination, setParamMissionDestination] = useState('Yamoussoukro - Centre Régional');
  const [paramMissionPurpose, setParamMissionPurpose] = useState('Participation au séminaire de formation pédagogique et d’évaluation');
  const [paramMissionStartDate, setParamMissionStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [paramMissionEndDate, setParamMissionEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [paramMissionTransport, setParamMissionTransport] = useState('Véhicule de l’établissement / Transport en commun agréé');
  const [paramMissionExpenseCoverage, setParamMissionExpenseCoverage] = useState('Frais de séjour et de déplacement intégralement pris en charge par l’établissement');

  // Recommendation Letter parameters
  const [paramRecRecipient, setParamRecRecipient] = useState('À qui de droit / Direction des Ressources Humaines');
  const [paramRecQualities, setParamRecQualities] = useState('de remarquables compétences professionnelles et pédagogiques, une ponctualité exemplaire, une éthique de travail irréprochable et un dévouement constant.');
  
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
        { data: staffData },
        { data: parentsData },
        { data: spData },
        { data: gradesData },
        { data: subsData },
        { data: paymentsData },
        { data: canteenData },
        { data: plansData },
        { data: feesData },
        { data: instData },
        { data: payrollsData },
        { data: suppliesData },
      ] = await Promise.all([
        supabase.from('documents').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('students').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
        supabase.from('teachers').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('staff').select('*').eq('school_id', school.id).order('last_name'),
        supabase.from('parents').select('*').eq('school_id', school.id),
        supabase.from('student_parents').select('*'),
        supabase.from('grades').select('*').eq('school_id', school.id),
        supabase.from('subjects').select('*').eq('school_id', school.id).order('name'),
        supabase.from('payments').select('*').eq('school_id', school.id).order('payment_date', { ascending: false }),
        supabase.from('canteen_payments').select('*').eq('school_id', school.id).order('payment_date', { ascending: false }),
        supabase.from('payment_plans').select('*, levels:payment_plan_levels(level_id), schedule:payment_schedule_templates(*), composition:payment_plan_compositions(*)').eq('school_id', school.id),
        supabase.from('student_fees').select('*, plan:payment_plans(*)').eq('school_id', school.id),
        supabase.from('student_installments').select('*').eq('school_id', school.id),
        supabase.from('payrolls').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('school_supplies').select('*').eq('school_id', school.id),
      ]);

      const loadedStudents = (studsData as Student[]) || [];
      const loadedClasses = (classesData as Class[]) || [];
      const loadedTeachers = (teachersData as Teacher[]) || [];
      const loadedStaff = (staffData as Staff[]) || [];

      setDocuments((docsData as Document[]) || []);
      setStudents(loadedStudents);
      setClasses(loadedClasses);
      setTeachers(loadedTeachers);
      setStaff(loadedStaff);
      setParents((parentsData as Parent[]) || []);
      setStudentParents((spData as StudentParent[]) || []);
      setGrades((gradesData as Grade[]) || []);
      setSubjects((subsData as Subject[]) || []);
      setPayments((paymentsData as Payment[]) || []);
      setCanteenPayments((canteenData as any[]) || []);
      setPaymentPlans((plansData as any[]) || []);
      setStudentFees((feesData as any[]) || []);
      setStudentInstallments((instData as any[]) || []);
      setPayrolls((payrollsData as any[]) || []);
      setSchoolSupplies((suppliesData as SchoolSupplyItem[]) || []);

      if (loadedClasses.length > 0) {
        setGeneratorClassId(loadedClasses[0].id);
        const classStudents = loadedStudents.filter(s => s.class_id === loadedClasses[0].id);
        if (classStudents.length > 0) {
          syncStudentState(classStudents[0], loadedClasses[0].id, (spData as StudentParent[]) || [], (parentsData as Parent[]) || [], (gradesData as Grade[]) || [], (subsData as Subject[]) || []);
        }
      }
      if (loadedTeachers.length > 0) {
        syncTeacherState(loadedTeachers[0], (payrollsData as any[]) || []);
      } else if (loadedStaff.length > 0) {
        setGeneratorTeacherId(loadedStaff[0].id);
        setParamStaffPosition(loadedStaff[0].position || 'Personnel Administratif');
        setParamStaffDepartment(loadedStaff[0].department || 'Administration & Support');
        setParamStaffContractType(loadedStaff[0].contract_type || 'CDI');
        setParamStaffHireDate(loadedStaff[0].hire_date || '');
      }
    } catch (err) {
      console.error('Erreur chargement documents:', err);
    } finally {
      setLoading(false);
    }
  }

  // Synchronize student data to generator form fields
  function syncStudentState(
    student: Student,
    classId: string,
    spList = studentParents,
    pList = parents,
    gList = grades,
    subList = subjects
  ) {
    setGeneratorStudentId(student.id);
    setParamBirthDate(student.date_of_birth || '');
    setParamBirthPlace(student.birth_place || '');

    // Parent details
    const sp = spList.find(p => p.student_id === student.id);
    const parentObj = sp ? pList.find(p => p.id === sp.parent_id) : null;
    const resolvedParentName = parentObj ? `${parentObj.first_name} ${parentObj.last_name}` : '';
    const resolvedParentPhone = parentObj?.phone || student.phone || '';
    setParamParentName(resolvedParentName);
    setParamParentPhone(resolvedParentPhone);

    // Calculate real grades and rank for honor diploma
    const rc = computeStudentReportCardData(student.id, classId, paramTerm, gList, subList);
    if (rc.hasRealGrades) {
      setParamDiplomaAverage(rc.overallAverage);
      setParamDiplomaRank(rc.rank);
      if (rc.overallAverage >= 16) {
        setParamDiplomaDistinction('Félicitations du Conseil de Classe - Mention Très Bien');
      } else if (rc.overallAverage >= 14) {
        setParamDiplomaDistinction('Tableau d’Honneur - Mention Bien');
      } else if (rc.overallAverage >= 12) {
        setParamDiplomaDistinction('Tableau d’Honneur - Mention Assez Bien');
      } else if (rc.overallAverage >= 10) {
        setParamDiplomaDistinction('Diplôme de Réussite & Félicitations');
      } else {
        setParamDiplomaDistinction('Diplôme d’Encouragement');
      }
    }
  }

  // Synchronize teacher salary data
  function syncTeacherState(teacher: Teacher, pList = payrolls) {
    setGeneratorTeacherId(teacher.id);
    setParamStaffPosition(teacher.specialty ? `Enseignant (${teacher.specialty})` : 'Enseignant');
    setParamStaffDepartment('Corps Enseignant');
    setParamStaffContractType(teacher.contract_type || 'CDI');
    setParamStaffHireDate(teacher.hire_date || '');

    const existing = pList.find(p => p.person_id === teacher.id);
    if (existing) {
      setSalaryBase(Number(existing.base_salary) || 250000);
      setSalarySursalaire(Number(existing.details?.sursalaire) || 0);
      setSalaryTransport(Number(existing.details?.transport) || 15000);
      setSalaryAnciennete(Number(existing.details?.anciennete) || 0);
      setSalaryAutresPrimes(Number(existing.details?.autres_primes) || 0);
      setSalaryDeductions(Number(existing.deductions) || 15000);
    } else {
      setSalaryBase(250000);
      setSalarySursalaire(25000);
      setSalaryTransport(20000);
      setSalaryAnciennete(10000);
      setSalaryAutresPrimes(0);
      setSalaryDeductions(12500);
    }
  }

  // Unified list of all school staff (teachers + administrative & support staff)
  const unifiedStaff = useMemo(() => {
    const list: {
      id: string;
      source: 'teacher' | 'staff';
      first_name: string;
      last_name: string;
      matricule: string;
      position: string;
      department: string;
      contract_type: string;
      hire_date: string;
      date_of_birth: string;
      sex: string;
      phone: string;
      email: string;
      address: string;
      photo_url: string;
    }[] = [];

    teachers.forEach(t => {
      list.push({
        id: t.id,
        source: 'teacher',
        first_name: t.first_name,
        last_name: t.last_name,
        matricule: t.matricule || '',
        position: t.specialty ? `Enseignant (${t.specialty})` : 'Enseignant',
        department: 'Corps Enseignant',
        contract_type: t.contract_type || 'CDI',
        hire_date: t.hire_date || '',
        date_of_birth: t.date_of_birth || '',
        sex: t.sex || 'M',
        phone: t.phone || '',
        email: t.email || '',
        address: t.address || '',
        photo_url: t.photo_url || '',
      });
    });

    staff.forEach(s => {
      list.push({
        id: s.id,
        source: 'staff',
        first_name: s.first_name,
        last_name: s.last_name,
        matricule: s.matricule || '',
        position: s.position || 'Personnel Administratif',
        department: s.department || 'Administration & Support',
        contract_type: s.contract_type || 'CDI',
        hire_date: s.hire_date || '',
        date_of_birth: s.date_of_birth || '',
        sex: s.sex || 'M',
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        photo_url: s.photo_url || '',
      });
    });

    return list.sort((a, b) => a.last_name.localeCompare(b.last_name));
  }, [teachers, staff]);

  // Selected unified staff member (either teacher or administrative staff)
  const currentSelectedStaff = useMemo(() => {
    return unifiedStaff.find(s => s.id === generatorTeacherId) || unifiedStaff[0] || null;
  }, [unifiedStaff, generatorTeacherId]);

  // Filter students by selected class for generator
  const availableStudentsForClass = useMemo(() => {
    if (!generatorClassId) return students;
    return students.filter(s => s.class_id === generatorClassId);
  }, [students, generatorClassId]);

  // Selected student entity
  const currentSelectedStudent = useMemo(() => {
    return students.find(s => s.id === generatorStudentId);
  }, [students, generatorStudentId]);

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
      syncStudentState(inClass[0], newClassId);
    } else {
      setGeneratorStudentId('');
    }
  }

  // Handle student change
  function handleGeneratorStudentChange(studentId: string) {
    const student = students.find(s => s.id === studentId);
    if (student) {
      syncStudentState(student, generatorClassId);
    }
  }

  // Handle teacher / staff change
  function handleGeneratorTeacherChange(empId: string) {
    setGeneratorTeacherId(empId);
    const emp = unifiedStaff.find(e => e.id === empId);
    if (emp) {
      setParamStaffPosition(emp.position);
      setParamStaffDepartment(emp.department);
      setParamStaffContractType(emp.contract_type || 'CDI');
      setParamStaffHireDate(emp.hire_date || '');

      const teacher = teachers.find(t => t.id === empId);
      if (teacher) {
        syncTeacherState(teacher);
      } else {
        const existing = payrolls.find(p => p.person_id === empId);
        if (existing) {
          setSalaryBase(Number(existing.base_salary) || 250000);
          setSalarySursalaire(Number(existing.details?.sursalaire) || 0);
          setSalaryTransport(Number(existing.details?.transport) || 15000);
          setSalaryAnciennete(Number(existing.details?.anciennete) || 0);
          setSalaryAutresPrimes(Number(existing.details?.autres_primes) || 0);
          setSalaryDeductions(Number(existing.deductions) || 15000);
        }
      }
    }
  }

  // Calculate real student report card data
  function computeStudentReportCardData(
    studentId: string,
    classId: string,
    term: string,
    gList = grades,
    subList = subjects
  ) {
    const classStudents = students.filter(s => s.class_id === classId);

    // Compute averages for all students in class for ranking
    const studentAverages = classStudents.map(st => {
      const stGrades = gList.filter(g => g.student_id === st.id && g.term === term);
      const subjectScores = subList.map(sub => {
        const subGrades = stGrades.filter(g => g.subject_id === sub.id);
        if (subGrades.length === 0) return null;

        const devoirs = subGrades.filter(g => g.grade_type !== 'composition');
        const comp = subGrades.find(g => g.grade_type === 'composition');

        const devoirsAvg = devoirs.length > 0
          ? devoirs.reduce((sum, g) => sum + (Number(g.score) / (Number(g.max_score) || 20)) * 20, 0) / devoirs.length
          : 10;
        const compScore = comp ? (Number(comp.score) / (Number(comp.max_score) || 20)) * 20 : null;

        let subjectAvg = devoirsAvg;
        if (compScore !== null) {
          subjectAvg = devoirs.length > 0 ? (devoirsAvg * 2 + compScore) / 3 : compScore;
        }

        const coeff = Number(subGrades[0]?.coefficient) || 1;
        return { subjectAvg, coeff, weighted: subjectAvg * coeff };
      }).filter(Boolean) as { subjectAvg: number; coeff: number; weighted: number }[];

      const totalCoeff = subjectScores.reduce((sum, s) => sum + s.coeff, 0);
      const totalWeighted = subjectScores.reduce((sum, s) => sum + s.weighted, 0);
      const avg = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;
      return { studentId: st.id, average: parseFloat(avg.toFixed(2)) };
    });

    const sortedAverages = [...studentAverages].sort((a, b) => b.average - a.average);
    const myRankIndex = sortedAverages.findIndex(item => item.studentId === studentId);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : 1;

    const validAverages = studentAverages.map(a => a.average).filter(a => a > 0);
    const classAvg = validAverages.length > 0
      ? parseFloat((validAverages.reduce((sum, a) => sum + a, 0) / validAverages.length).toFixed(2))
      : 0;
    const maxAvg = validAverages.length > 0 ? Math.max(...validAverages) : 0;
    const minAvg = validAverages.length > 0 ? Math.min(...validAverages) : 0;

    // Subjects details for this student
    const myGrades = gList.filter(g => g.student_id === studentId && g.term === term);
    let mySubjectsDetails = subList.map(sub => {
      const subGrades = myGrades.filter(g => g.subject_id === sub.id);
      if (subGrades.length === 0) return null;

      const devoirs = subGrades.filter(g => g.grade_type !== 'composition');
      const comp = subGrades.find(g => g.grade_type === 'composition');

      const devoirsAvg = devoirs.length > 0
        ? devoirs.reduce((sum, g) => sum + (Number(g.score) / (Number(g.max_score) || 20)) * 20, 0) / devoirs.length
        : 10;
      const compScore = comp ? (Number(comp.score) / (Number(comp.max_score) || 20)) * 20 : null;

      let subjectAvg = devoirsAvg;
      if (compScore !== null) {
        subjectAvg = devoirs.length > 0 ? (devoirsAvg * 2 + compScore) / 3 : compScore;
      }

      const coeff = Number(subGrades[0]?.coefficient) || 1;
      return {
        name: sub.name,
        devoirsAvg: parseFloat(devoirsAvg.toFixed(2)),
        compScore: compScore !== null ? parseFloat(compScore.toFixed(2)) : null,
        subjectAvg: parseFloat(subjectAvg.toFixed(2)),
        coefficient: coeff,
        weightedScore: parseFloat((subjectAvg * coeff).toFixed(2)),
      };
    }).filter(Boolean) as {
      name: string;
      devoirsAvg: number;
      compScore: number | null;
      subjectAvg: number;
      coefficient: number;
      weightedScore: number;
    }[];

    const hasRealGrades = mySubjectsDetails.length > 0;
    if (!hasRealGrades) {
      mySubjectsDetails = subList.slice(0, 6).map(sub => ({
        name: sub.name,
        devoirsAvg: 0,
        compScore: null,
        subjectAvg: 0,
        coefficient: 1,
        weightedScore: 0,
      }));
    }

    const myAvgObj = studentAverages.find(a => a.studentId === studentId);
    const overallAvg = myAvgObj ? myAvgObj.average : 0;

    return {
      hasRealGrades,
      subjects: mySubjectsDetails,
      overallAverage: overallAvg,
      rank: myRank,
      totalStudents: classStudents.length || 1,
      classAverage: classAvg,
      maxAverage: maxAvg,
      minAverage: minAvg,
    };
  }

  // Real financial resolution for selected student
  const studentResolvedFinance = useMemo(() => {
    if (!currentSelectedStudent) return null;
    return resolveStudentFinance({
      student: currentSelectedStudent,
      plans: paymentPlans,
      studentFees,
      studentInstallments,
      tuitionPayments: payments,
      canteenPayments,
      classes,
    });
  }, [currentSelectedStudent, paymentPlans, studentFees, studentInstallments, payments, canteenPayments, classes]);

  // Real report card data for selected student
  const studentReportCardData = useMemo(() => {
    if (!currentSelectedStudent || !generatorClassId) return null;
    return computeStudentReportCardData(currentSelectedStudent.id, generatorClassId, paramTerm);
  }, [currentSelectedStudent, generatorClassId, paramTerm, grades, subjects]);

  // Real supplies list for selected class
  const classRealSupplies = useMemo(() => {
    return schoolSupplies.filter(
      s => s.class_id === generatorClassId || (!s.class_id && s.level_id === currentSelectedClass?.level_id)
    );
  }, [schoolSupplies, generatorClassId, currentSelectedClass]);

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

    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);

    if (!uploadTitle) {
      const typeLabel = VAULT_DOC_TYPES.find(t => t.id === uploadDocType)?.label || 'Document';
      let personName = '';
      if (uploadEntityType === 'student') {
        const stud = students.find(s => s.id === uploadEntityId);
        if (stud) personName = ` - ${stud.last_name} ${stud.first_name}`;
      } else if (uploadEntityType === 'teacher') {
        const emp = unifiedStaff.find(item => item.id === uploadEntityId);
        if (emp) personName = ` - ${emp.last_name} ${emp.first_name}`;
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

  // Build HTML for currently selected template with REAL DATA
  function generateCurrentHtml(): { html: string; title: string; baseFileName: string; entityType: string; entityId: string } | null {
    if (!school) return null;

    const academicYearName = academicYear?.name || '2026-2027';
    const className = currentSelectedClass?.name || 'Classe non assignée';

    // 1. Attestation de scolarité & Certificat de fréquentation
    if (selectedTemplateId === 'school_certificate' || selectedTemplateId === 'attendance_certificate') {
      if (!currentSelectedStudent) return null;
      const isAttestation = selectedTemplateId === 'school_certificate';
      const title = isAttestation
        ? `Attestation de Scolarité - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`
        : `Certificat de Fréquentation - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `${isAttestation ? 'attestation' : 'frequentation'}_${currentSelectedStudent.matricule}`;

      const html = buildSchoolCertificateHtml({
        school,
        certificateType: isAttestation ? 'attestation_scolarite' : 'certificat_frequentation',
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          date_of_birth: paramBirthDate || currentSelectedStudent.date_of_birth,
          place_of_birth: paramBirthPlace || currentSelectedStudent.birth_place,
          gender: currentSelectedStudent.sex,
          photo_url: currentSelectedStudent.photo_url,
        },
        className,
        academicYearName,
        city: paramCity,
        directorName: paramDirectorName,
        purpose: paramPurpose,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    // 2. Convocation de Parent / Tuteur
    if (selectedTemplateId === 'parent_summons') {
      if (!currentSelectedStudent) return null;
      const parentName = paramParentName || 'Parent / Tuteur';
      const parentPhone = paramParentPhone || '';
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

    // 3. Diplôme de Réussite & Tableau d'Honneur
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

    // 4. Carte d'Identité Scolaire
    if (selectedTemplateId === 'student_card') {
      if (!currentSelectedStudent) return null;
      const title = `Carte Scolaire - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `carte_scolaire_${currentSelectedStudent.matricule}`;

      const html = buildStudentCardHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
          photo_url: currentSelectedStudent.photo_url,
          date_of_birth: paramBirthDate || currentSelectedStudent.date_of_birth,
          birth_place: paramBirthPlace || currentSelectedStudent.birth_place,
          sex: currentSelectedStudent.sex,
        } as any,
        className,
        academicYearName,
        primaryGuardian: paramParentName || undefined,
        primaryGuardianPhone: paramParentPhone || undefined,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    // 5. Feuille d'Appel / Registre de Classe
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

    // 6. Bulletin Scolaire Trimestriel (Real Grades)
    if (selectedTemplateId === 'report_card') {
      if (!currentSelectedStudent) return null;
      const title = `Bulletin Scolaire - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `bulletin_${currentSelectedStudent.matricule}`;

      const rc = studentReportCardData || computeStudentReportCardData(currentSelectedStudent.id, generatorClassId, paramTerm);

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
        subjects: rc.subjects,
        overallAverage: rc.overallAverage,
        rank: rc.rank,
        totalStudents: rc.totalStudents,
        classAverage: rc.classAverage,
        maxAverage: rc.maxAverage,
        minAverage: rc.minAverage,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    // 7. Bulletin de Salaire (Real Teacher / Staff Payroll)
    if (selectedTemplateId === 'payslip') {
      const emp = currentSelectedStaff;
      const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Personnel';
      const title = `Bulletin de Salaire - ${name}`;
      const baseFileName = `bulletin_paie_${emp?.matricule || 'personnel'}`;

      const baseSalaryNum = Number(salaryBase) || 0;
      const sursalaireNum = Number(salarySursalaire) || 0;
      const transportNum = Number(salaryTransport) || 0;
      const ancienneteNum = Number(salaryAnciennete) || 0;
      const primesNum = Number(salaryAutresPrimes) || 0;
      const deductionsNum = Number(salaryDeductions) || 0;
      const netPayNum = (baseSalaryNum + sursalaireNum + transportNum + ancienneteNum + primesNum) - deductionsNum;

      const dynamicPayroll = {
        month: payrollMonth,
        year: payrollYear,
        base_salary: baseSalaryNum,
        bonuses: sursalaireNum + transportNum + ancienneteNum + primesNum,
        deductions: deductionsNum,
        net_salary: netPayNum,
        details: {
          sursalaire: sursalaireNum,
          transport: transportNum,
          anciennete: ancienneteNum,
          autres_primes: primesNum,
          cr: Math.round(deductionsNum * 0.4),
          its: Math.round(deductionsNum * 0.6),
        },
      };

      const html = buildPayslipHtml({
        school,
        payroll: dynamicPayroll,
        person: emp || {
          first_name: 'Personnel',
          last_name: 'Établissement',
          matricule: 'PERS-001',
          specialty: 'Administration',
        },
      });

      return { html, title, baseFileName, entityType: emp?.source || 'teacher', entityId: emp?.id || school.id };
    }

    // 7.1. Attestation de Travail (En cours d'emploi)
    if (selectedTemplateId === 'work_attestation') {
      const emp = currentSelectedStaff;
      if (!emp) return null;
      const title = `Attestation de Travail - ${emp.last_name} ${emp.first_name}`;
      const baseFileName = `attestation_travail_${emp.matricule || 'personnel'}`;

      const html = buildWorkAttestationHtml({
        school,
        employee: {
          first_name: emp.first_name,
          last_name: emp.last_name,
          matricule: emp.matricule,
          position: paramStaffPosition || emp.position,
          department: paramStaffDepartment || emp.department,
          contract_type: paramStaffContractType || emp.contract_type,
          hire_date: paramStaffHireDate || emp.hire_date,
          date_of_birth: emp.date_of_birth,
          phone: emp.phone,
          sex: emp.sex,
        },
        city: paramCity,
        directorName: paramDirectorName,
        purpose: paramStaffAttestationPurpose,
      });

      return { html, title, baseFileName, entityType: emp.source, entityId: emp.id };
    }

    // 7.2. Certificat de Travail (Fin de contrat / Départ)
    if (selectedTemplateId === 'work_certificate') {
      const emp = currentSelectedStaff;
      if (!emp) return null;
      const title = `Certificat de Travail - ${emp.last_name} ${emp.first_name}`;
      const baseFileName = `certificat_travail_${emp.matricule || 'personnel'}`;

      const html = buildWorkCertificateHtml({
        school,
        employee: {
          first_name: emp.first_name,
          last_name: emp.last_name,
          matricule: emp.matricule,
          position: paramStaffPosition || emp.position,
          department: paramStaffDepartment || emp.department,
          contract_type: paramStaffContractType || emp.contract_type,
          hire_date: paramStaffHireDate || emp.hire_date,
          end_date: paramStaffEndDate,
          date_of_birth: emp.date_of_birth,
          phone: emp.phone,
          cni_number: paramStaffCni,
          sex: emp.sex,
        },
        city: paramCity,
        directorName: paramDirectorName,
        reason: paramStaffDepartureReason,
      });

      return { html, title, baseFileName, entityType: emp.source, entityId: emp.id };
    }

    // 7.3. Ordre de Mission Officiel
    if (selectedTemplateId === 'mission_order') {
      const emp = currentSelectedStaff;
      if (!emp) return null;
      const title = `Ordre de Mission - ${emp.last_name} ${emp.first_name}`;
      const baseFileName = `ordre_mission_${emp.matricule || 'personnel'}`;

      const html = buildMissionOrderHtml({
        school,
        employee: {
          first_name: emp.first_name,
          last_name: emp.last_name,
          matricule: emp.matricule,
          position: paramStaffPosition || emp.position,
          department: paramStaffDepartment || emp.department,
          phone: emp.phone,
          sex: emp.sex,
        },
        city: paramCity,
        directorName: paramDirectorName,
        missionDestination: paramMissionDestination,
        missionPurpose: paramMissionPurpose,
        startDate: paramMissionStartDate,
        endDate: paramMissionEndDate,
        transportMode: paramMissionTransport,
        expenseCoverage: paramMissionExpenseCoverage,
      });

      return { html, title, baseFileName, entityType: emp.source, entityId: emp.id };
    }

    // 7.4. Lettre de Recommandation Professionnelle
    if (selectedTemplateId === 'recommendation_letter') {
      const emp = currentSelectedStaff;
      if (!emp) return null;
      const title = `Lettre de Recommandation - ${emp.last_name} ${emp.first_name}`;
      const baseFileName = `recommandation_${emp.matricule || 'personnel'}`;

      const html = buildRecommendationLetterHtml({
        school,
        employee: {
          first_name: emp.first_name,
          last_name: emp.last_name,
          matricule: emp.matricule,
          position: paramStaffPosition || emp.position,
          department: paramStaffDepartment || emp.department,
          hire_date: paramStaffHireDate || emp.hire_date,
          end_date: paramStaffEndDate,
          sex: emp.sex,
        },
        city: paramCity,
        directorName: paramDirectorName,
        recipient: paramRecRecipient,
        qualities: paramRecQualities,
      });

      return { html, title, baseFileName, entityType: emp.source, entityId: emp.id };
    }

    // 8. Relevé Financier Élève (Real Finance & Payments)
    if (selectedTemplateId === 'account_statement') {
      if (!currentSelectedStudent) return null;
      const title = `Relevé Financier - ${currentSelectedStudent.last_name} ${currentSelectedStudent.first_name}`;
      const baseFileName = `releve_compte_${currentSelectedStudent.matricule}`;

      const studentTuition = payments.filter(p => p.student_id === currentSelectedStudent.id);
      const studentCanteen = canteenPayments.filter(p => p.student_id === currentSelectedStudent.id);

      const realHistory = [
        ...studentTuition.map(p => ({
          receipt_number: p.receipt_number || 'REC-XXXX',
          payment_date: p.payment_date,
          payment_method: p.payment_method || 'Espèces',
          amount: Number(p.amount) || 0,
          is_canteen: false,
          description: 'Scolarité annuelle',
        })),
        ...studentCanteen.map(p => ({
          receipt_number: p.receipt_number || 'REC-CANTINE',
          payment_date: p.payment_date,
          payment_method: p.payment_method || 'Mobile Money',
          amount: Number(p.amount) || 0,
          is_canteen: true,
          description: `Cantine scolaire - Trimestre ${p.trimester || 1}`,
        })),
      ].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

      const resFin = studentResolvedFinance || {
        planName: 'Tarif Standard',
        totalExpected: 0,
        totalPaid: 0,
        remaining: 0,
        schedule: [],
      };

      const html = buildStudentAccountStatementHtml({
        school,
        student: {
          first_name: currentSelectedStudent.first_name,
          last_name: currentSelectedStudent.last_name,
          matricule: currentSelectedStudent.matricule,
        },
        className,
        academicYearName,
        planName: resFin.planName,
        totalExpected: resFin.totalExpected,
        totalPaid: resFin.totalPaid,
        remaining: resFin.remaining,
        installments: resFin.schedule,
        paymentHistory: realHistory,
      });

      return { html, title, baseFileName, entityType: 'student', entityId: currentSelectedStudent.id };
    }

    // 9. Liste des Fournitures Scolaires (Real Supplies)
    if (selectedTemplateId === 'supply_list') {
      const title = `Liste des Fournitures - ${className}`;
      const baseFileName = `fournitures_${className.replace(/\s+/g, '_')}`;

      const formattedSupplies = classRealSupplies.map(s => ({
        item_name: s.item_name,
        category: (s.category || 'autre') as any,
        quantity: Number(s.quantity) || 1,
        unit_price: Number(s.unit_price) || 0,
        is_mandatory: s.is_mandatory ?? true,
        notes: s.notes,
      }));

      const html = buildClassSupplyListHtml({
        school,
        className,
        academicYearName,
        items: formattedSupplies,
      });

      return { html, title, baseFileName, entityType: 'class', entityId: currentSelectedClass?.id || school.id };
    }

    return null;
  }

  // Live Print Action
  function handlePrintCurrentDocument() {
    const generated = generateCurrentHtml();
    if (!generated) {
      alert('Veuillez sélectionner un élève ou renseigner les champs requis.');
      return;
    }
    openPrintPreview(generated.html);
  }

  // Download HTML Action
  function handleDownloadCurrentDocument() {
    const generated = generateCurrentHtml();
    if (!generated) {
      alert('Veuillez sélectionner un élève ou renseigner les champs requis.');
      return;
    }
    downloadTextDocument(generated.html, `${generated.baseFileName}.html`);
  }

  // Archive Document Action
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
      if (vaultEntityFilter !== 'all' && doc.entity_type !== vaultEntityFilter) return false;
      if (vaultTypeFilter !== 'all' && doc.document_type !== vaultTypeFilter) return false;
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
    if (doc.entity_type === 'teacher' || doc.entity_type === 'staff') {
      const teacher = teachers.find(t => t.id === doc.entity_id);
      if (teacher) {
        return `Enseignant : ${teacher.last_name} ${teacher.first_name} (Matr: ${teacher.matricule || '-'})`;
      }
      const st = staff.find(s => s.id === doc.entity_id);
      if (st) {
        return `Personnel : ${st.last_name} ${st.first_name} (${st.position || 'Administration'}) - Matr: ${st.matricule || '-'}`;
      }
      return 'Personnel / Enseignant';
    }
    return `Établissement : ${school?.name || 'Direction'}`;
  }

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
              Générez instantanément toutes les pièces officielles avec les <strong>données réelles</strong> de vos élèves et enseignants (notes réelles, versements réels, état civil et salaires réels) et archivez les pièces numérisées.
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
              <p className="text-sm text-slate-500">Sélectionnez le document à générer. Les données réelles du dossier de l'élève ou de l'enseignant s'insèrent automatiquement.</p>
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
                    <span className="text-xs font-medium text-slate-400">Données Réelles</span>
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
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          title="Visualiser"
                        >
                          <Eye size={13} />
                          <span>Voir</span>
                        </button>

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
      {/* MODAL: DOCUMENT GENERATOR STUDIO (REAL DATA SYNCHRONIZED)  */}
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
          {['payslip', 'work_attestation', 'work_certificate', 'mission_order', 'recommendation_letter'].includes(selectedTemplateId) ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Personnel / Enseignant Bénéficiaire
                </label>
                <span className="text-xs text-slate-500 font-medium">
                  {unifiedStaff.length} collaborateur(s) (Enseignants & Administratifs)
                </span>
              </div>
              <select
                value={generatorTeacherId}
                onChange={e => handleGeneratorTeacherChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {unifiedStaff.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.last_name} {emp.first_name} — {emp.position} ({emp.source === 'teacher' ? 'Enseignant' : 'Personnel'}) - Matr: {emp.matricule || '-'}
                  </option>
                ))}
              </select>

              {/* Context Banner: Selected Staff Summary */}
              {currentSelectedStaff && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {currentSelectedStaff.last_name} {currentSelectedStaff.first_name}
                      </span>
                      <span className="ml-1 text-slate-600">
                        • {currentSelectedStaff.position} ({currentSelectedStaff.department})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      Matr: {currentSelectedStaff.matricule || 'N/A'}
                    </span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                      {paramStaffContractType || currentSelectedStaff.contract_type || 'CDI'}
                    </span>
                  </div>
                </div>
              )}
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
                    onChange={e => handleGeneratorStudentChange(e.target.value)}
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

          {/* Context Banner: Selected Student Summary */}
          {currentSelectedStudent && !['payslip', 'work_attestation', 'work_certificate', 'mission_order', 'recommendation_letter'].includes(selectedTemplateId) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50/70 border border-blue-200/60 p-3.5 text-xs text-blue-900">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {currentSelectedStudent.last_name} {currentSelectedStudent.first_name}
                  </span>{' '}
                  • Matricule : <span className="font-mono font-bold text-blue-700">{currentSelectedStudent.matricule}</span>
                  {paramParentName && (
                    <span className="ml-2 text-slate-600">
                      • Tuteur : <strong>{paramParentName}</strong> ({paramParentPhone || 'Sans contact'})
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="rounded-md bg-white px-2 py-1 font-semibold text-blue-800 border border-blue-200">
                  {currentSelectedClass?.name || 'Classe'}
                </span>
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Attestation & Fréquentation */}
          {(selectedTemplateId === 'school_certificate' || selectedTemplateId === 'attendance_certificate') && (
            <div className="space-y-3.5 rounded-xl border border-blue-200/70 bg-blue-50/30 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date de naissance</label>
                  <input
                    type="date"
                    value={paramBirthDate}
                    onChange={e => setParamBirthDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lieu de naissance</label>
                  <input
                    type="text"
                    placeholder="Ex: Abidjan Cocody"
                    value={paramBirthPlace}
                    onChange={e => setParamBirthPlace(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mention spéciale / Objet spécifique (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex : Pour constitution de dossier d'allocations familiales"
                  value={paramPurpose}
                  onChange={e => setParamPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Convocation Parent */}
          {selectedTemplateId === 'parent_summons' && (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom complet du parent / tuteur</label>
                  <input
                    type="text"
                    value={paramParentName}
                    onChange={e => setParamParentName(e.target.value)}
                    placeholder="Ex: M. Kouassi Jean"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone du parent / contact</label>
                  <input
                    type="text"
                    value={paramParentPhone}
                    onChange={e => setParamParentPhone(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

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

          {/* SPECIFIC FIELDS: Diplome & Tableau d'Honneur (Real Calculated Stats) */}
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

              <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-100/60 p-2.5 rounded-lg">
                <Sparkles size={15} />
                <span>
                  {studentReportCardData?.hasRealGrades
                    ? `Moyenne (${studentReportCardData.overallAverage}/20) et Rang (${studentReportCardData.rank}e) extraits directement des notes réelles de l'élève.`
                    : 'Aucune note enregistrée pour ce trimestre dans le menu Évaluations ; vous pouvez renseigner la moyenne manuellement ci-dessus.'}
                </span>
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Bulletin Scolaire (Real Grades Summary) */}
          {selectedTemplateId === 'report_card' && (
            <div className="space-y-3.5">
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

              {/* Real Grades Summary Banner */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    <span className="font-bold text-sm text-indigo-900">Données Réelles du Bulletin</span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">
                    {studentReportCardData?.hasRealGrades
                      ? `${studentReportCardData.subjects.length} matières évaluées`
                      : 'En attente de saisie des notes'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <p className="text-slate-500">Moyenne Élève</p>
                    <p className="font-bold text-base text-indigo-700">
                      {studentReportCardData?.hasRealGrades ? `${studentReportCardData.overallAverage} / 20` : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <p className="text-slate-500">Rang</p>
                    <p className="font-bold text-base text-slate-800">
                      {studentReportCardData?.hasRealGrades ? `${studentReportCardData.rank}e sur ${studentReportCardData.totalStudents}` : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <p className="text-slate-500">Moy. de Classe</p>
                    <p className="font-bold text-base text-slate-800">
                      {studentReportCardData?.hasRealGrades ? `${studentReportCardData.classAverage} / 20` : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <p className="text-slate-500">Note Max / Min</p>
                    <p className="font-bold text-base text-slate-800">
                      {studentReportCardData?.hasRealGrades ? `${studentReportCardData.maxAverage} / ${studentReportCardData.minAverage}` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Bulletin de Salaire (Real Teacher Payroll Form) */}
          {selectedTemplateId === 'payslip' && (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mois</label>
                  <select
                    value={payrollMonth}
                    onChange={e => setPayrollMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {[
                      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                    ].map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Année</label>
                  <input
                    type="number"
                    value={payrollYear}
                    onChange={e => setPayrollYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Salaire de base (FCFA)</label>
                  <input
                    type="number"
                    value={salaryBase}
                    onChange={e => setSalaryBase(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sursalaire (FCFA)</label>
                  <input
                    type="number"
                    value={salarySursalaire}
                    onChange={e => setSalarySursalaire(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transport (FCFA)</label>
                  <input
                    type="number"
                    value={salaryTransport}
                    onChange={e => setSalaryTransport(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ancienneté (FCFA)</label>
                  <input
                    type="number"
                    value={salaryAnciennete}
                    onChange={e => setSalaryAnciennete(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Autres primes (FCFA)</label>
                  <input
                    type="number"
                    value={salaryAutresPrimes}
                    onChange={e => setSalaryAutresPrimes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Retenues & Cotisations (FCFA)</label>
                  <input
                    type="number"
                    value={salaryDeductions}
                    onChange={e => setSalaryDeductions(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Net pay live banner */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Net à Payer Calculé :</span>
                <span className="text-lg font-black text-emerald-700">
                  {formatCurrency((salaryBase + salarySursalaire + salaryTransport + salaryAnciennete + salaryAutresPrimes) - salaryDeductions)}
                </span>
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Attestation de Travail (En cours d'emploi) */}
          {selectedTemplateId === 'work_attestation' && (
            <div className="space-y-3.5 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-teal-950">Attestation de Travail & d'Emploi</span>
                  <p className="text-xs text-teal-800">Certifie que le collaborateur est actuellement en service régulier</p>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-200/80 px-2.5 py-1 rounded-full">Contrat Actif</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fonction / Poste occupé</label>
                  <input
                    type="text"
                    value={paramStaffPosition}
                    onChange={e => setParamStaffPosition(e.target.value)}
                    placeholder="Ex: Professeur de Mathématiques / Économe"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Département / Service</label>
                  <input
                    type="text"
                    value={paramStaffDepartment}
                    onChange={e => setParamStaffDepartment(e.target.value)}
                    placeholder="Ex: Corps Enseignant / Administration"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type de Contrat</label>
                  <select
                    value={paramStaffContractType}
                    onChange={e => setParamStaffContractType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CDI">Contrat à Durée Indéterminée (CDI)</option>
                    <option value="CDD">Contrat à Durée Déterminée (CDD)</option>
                    <option value="Vacataire">Vacataire / Prestation d'heures</option>
                    <option value="Stage">Convention de Stage Professionnel</option>
                    <option value="Prestataire">Prestation de Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date d'embauche / Prise de service</label>
                  <input
                    type="date"
                    value={paramStaffHireDate}
                    onChange={e => setParamStaffHireDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mention spéciale / Objet spécifique (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex : Pour servir et valoir ce que de droit (demande de prêt bancaire, visa, CNPS)"
                  value={paramStaffAttestationPurpose}
                  onChange={e => setParamStaffAttestationPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-teal-100/60 p-2.5 text-xs text-teal-900 border border-teal-200">
                ℹ️ <strong>Usage officiel :</strong> Document standard exigé par les banques, ambassades, consulats et organismes de sécurité sociale pour attester de la situation active du salarié.
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Certificat de Travail (Fin de contrat / Départ) */}
          {selectedTemplateId === 'work_certificate' && (
            <div className="space-y-3.5 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-amber-950">Certificat de Travail (Document Légal Obligatoire)</span>
                  <p className="text-xs text-amber-800">Délivré obligatoirement à la fin de tout contrat de travail selon le Code du Travail</p>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-200/80 px-2.5 py-1 rounded-full">Fin de contrat</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date d'embauche (Début)</label>
                  <input
                    type="date"
                    value={paramStaffHireDate}
                    onChange={e => setParamStaffHireDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date de fin d'emploi (Départ)</label>
                  <input
                    type="date"
                    value={paramStaffEndDate}
                    onChange={e => setParamStaffEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dernière fonction occupée</label>
                  <input
                    type="text"
                    value={paramStaffPosition}
                    onChange={e => setParamStaffPosition(e.target.value)}
                    placeholder="Ex: Professeur Titulaire / Économe"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Département / Service</label>
                  <input
                    type="text"
                    value={paramStaffDepartment}
                    onChange={e => setParamStaffDepartment(e.target.value)}
                    placeholder="Ex: Secondaire Général / Administration"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type de Contrat expiré</label>
                  <select
                    value={paramStaffContractType}
                    onChange={e => setParamStaffContractType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CDI">CDI (Rupture amiable / Démission / Licenciement)</option>
                    <option value="CDD">CDD (Arrivée à échéance)</option>
                    <option value="Vacataire">Vacation / Prestation d'heures</option>
                    <option value="Stage">Fin de stage de perfectionnement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">N° Pièce d'identité / CNI (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: C0123456789 ou Passeport"
                    value={paramStaffCni}
                    onChange={e => setParamStaffCni(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Motif du départ (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex : Fin normale du contrat à durée déterminée / Démission acceptée"
                  value={paramStaffDepartureReason}
                  onChange={e => setParamStaffDepartureReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-amber-100/70 p-2.5 text-xs text-amber-900 border border-amber-200">
                ⚖️ <strong>Formule légale automatique :</strong> Le document certifie formellement que le salarié quitte l'établissement <em>« libre de tout engagement »</em>, avec règlement intégral de ses salaires et indemnités légales de fin de contrat.
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Ordre de Mission Officiel */}
          {selectedTemplateId === 'mission_order' && (
            <div className="space-y-3.5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-blue-950">Ordre de Mission Officiel</span>
                  <p className="text-xs text-blue-800">Autorisation formelle de déplacement professionnel et visas officiels</p>
                </div>
                <span className="text-xs font-bold text-blue-800 bg-blue-200/80 px-2.5 py-1 rounded-full">Déplacement Officiel</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lieu / Destination de la mission</label>
                  <input
                    type="text"
                    value={paramMissionDestination}
                    onChange={e => setParamMissionDestination(e.target.value)}
                    placeholder="Ex: Yamoussoukro, Centre Régional d'Examens"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Objet de la mission</label>
                  <input
                    type="text"
                    value={paramMissionPurpose}
                    onChange={e => setParamMissionPurpose(e.target.value)}
                    placeholder="Ex: Participation aux jurys d'évaluation ministériels"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date de début de mission</label>
                  <input
                    type="date"
                    value={paramMissionStartDate}
                    onChange={e => setParamMissionStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date de fin de mission</label>
                  <input
                    type="date"
                    value={paramMissionEndDate}
                    onChange={e => setParamMissionEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Moyen de transport</label>
                  <input
                    type="text"
                    value={paramMissionTransport}
                    onChange={e => setParamMissionTransport(e.target.value)}
                    placeholder="Ex: Véhicule de service / Ligne régulière de car"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prise en charge financière</label>
                  <input
                    type="text"
                    value={paramMissionExpenseCoverage}
                    onChange={e => setParamMissionExpenseCoverage(e.target.value)}
                    placeholder="Ex: Frais de séjour et transport pris en charge par l'école"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="text-xs text-blue-800 bg-blue-100/50 p-2.5 rounded-lg border border-blue-200">
                ℹ️ Cet ordre de mission officiel comporte les cadres réservés aux visas de départ et d'arrivée requis pour les contrôles routiers et administratifs.
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Lettre de Recommandation Professionnelle */}
          {selectedTemplateId === 'recommendation_letter' && (
            <div className="space-y-3.5 rounded-xl border border-purple-200 bg-purple-50/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-purple-950">Lettre de Recommandation Professionnelle</span>
                  <p className="text-xs text-purple-800">Émise par la Direction pour valoriser le parcours et les compétences de l'employé</p>
                </div>
                <span className="text-xs font-bold text-purple-800 bg-purple-200/80 px-2.5 py-1 rounded-full">Recommandation</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destinataire (À l'attention de)</label>
                <input
                  type="text"
                  value={paramRecRecipient}
                  onChange={e => setParamRecRecipient(e.target.value)}
                  placeholder="Ex: À qui de droit / Direction des Ressources Humaines"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Appréciations et qualités professionnelles mises en avant</label>
                <textarea
                  rows={3}
                  value={paramRecQualities}
                  onChange={e => setParamRecQualities(e.target.value)}
                  placeholder="Ex: de remarquables qualités pédagogiques, une disponibilité sans faille et une rigueur professionnelle exemplaire."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Relevé Financier (Real Payments & Balances) */}
          {selectedTemplateId === 'account_statement' && (
            <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-cyan-900">Situation Financière Réelle de l'Élève</span>
                <span className="text-xs font-semibold text-cyan-700">
                  Plan : {studentResolvedFinance?.planName || 'Standard'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-cyan-100">
                  <p className="text-slate-500">Total Attendu</p>
                  <p className="font-bold text-base text-slate-900">
                    {formatCurrency(studentResolvedFinance?.totalExpected || 0)}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-cyan-100">
                  <p className="text-slate-500">Déjà Réglé</p>
                  <p className="font-bold text-base text-emerald-600">
                    {formatCurrency(studentResolvedFinance?.totalPaid || 0)}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-cyan-100">
                  <p className="text-slate-500">Solde Restant</p>
                  <p className="font-bold text-base text-rose-600">
                    {formatCurrency(studentResolvedFinance?.remaining || 0)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-cyan-800 bg-white/70 p-2.5 rounded-lg border border-cyan-200">
                Tous les reçus réels ({payments.filter(p => p.student_id === generatorStudentId).length} paiement(s) de scolarité et{' '}
                {canteenPayments.filter(p => p.student_id === generatorStudentId).length} versement(s) cantine) seront intégrés dans le relevé.
              </div>
            </div>
          )}

          {/* SPECIFIC FIELDS: Fournitures Scolaires */}
          {selectedTemplateId === 'supply_list' && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 text-xs text-teal-900">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Fournitures enregistrées pour {currentSelectedClass?.name}</span>
                <span className="font-semibold">{classRealSupplies.length} article(s)</span>
              </div>
              <p className="mt-1 text-slate-600">
                {classRealSupplies.length > 0
                  ? `La liste et le budget estimatif seront générés à partir des ${classRealSupplies.length} manuels et fournitures réels de cette classe.`
                  : 'Aucune fourniture n’est encore configurée pour cette classe dans la base de données. Vous pouvez les configurer dans la gestion des fournitures.'}
              </p>
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
                  if (unifiedStaff.length > 0) setUploadEntityId(unifiedStaff[0].id);
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sélectionner le collaborateur (Enseignant / Personnel)</label>
              <select
                value={uploadEntityId}
                onChange={e => setUploadEntityId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                {unifiedStaff.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.last_name} {emp.first_name} — {emp.position} ({emp.source === 'teacher' ? 'Enseignant' : 'Personnel'}) - Matr: {emp.matricule || '-'}
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
                  } else if (uploadEntityType === 'teacher') {
                    const emp = unifiedStaff.find(item => item.id === uploadEntityId);
                    if (emp) suffix = ` - ${emp.last_name} ${emp.first_name}`;
                  }
                  setUploadTitle(`${typeLabel(e.target.value)}${suffix}`);
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

  function typeLabel(id: string) {
    return VAULT_DOC_TYPES.find(v => v.id === id)?.label || 'Document';
  }
}
