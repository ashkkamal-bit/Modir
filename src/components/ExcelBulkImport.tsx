import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  Employee,
  Program,
  School,
  EmployeeProgram,
  ExecutionStatus,
  EducationalGrade,
  STANDARD_ROLES,
  StandardStaffRole,
  ProgramSection,
  PROGRAM_SECTIONS,
  ProgramScope,
  ProgramCoefficient,
  DocumentationPlatform,
} from '../types';
import { normalizePersianText } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate, padZero } from '../utils/jalali';
import { safeDownloadWorkbook, safeDownloadCsv } from '../utils/excelExport';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  UserCheck,
  UserPlus,
  Users,
  Building,
  GraduationCap,
  Briefcase,
  Clock,
  Sparkles,
  BookOpen,
  BookPlus,
  Award,
  FileCheck,
  Eye,
  Info,
  Search,
  Filter,
  Plus,
  Calendar,
  FileText,
  Copy,
  ExternalLink,
  ChevronDown,
  CheckSquare,
  Square,
  X,
  Target,
  Send,
  HelpCircle,
} from 'lucide-react';

interface ExcelBulkImportProps {
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
  onNavigateToTab?: (tab: string) => void;
  initialMode?: 'employees' | 'tasks' | 'per_program' | 'programs';
  initialProgramId?: string;
}

interface ParsedEmployeeRow {
  rowIdx: number;
  fullName: string;
  nationalId: string;
  personnelCode: string;
  employeeCode: string;
  schoolName: string;
  grade: EducationalGrade;
  role: string;
  experienceYears: string | number;
  phone: string;
  notes: string;
  isExisting: boolean;
  matchedEmployeeId?: string;
  willCreateSchool: boolean;
  assignedCode: string;
  isValid: boolean;
  validationError?: string;
}

interface ParsedTaskStatusRow {
  rowIdx: number;
  rawIdentifier: string;
  fullName: string;
  programTitleOrCode: string;
  statusText: string;
  executionDate: string;
  platform: string;
  notes: string;
  matchedEmployee?: Employee;
  matchedProgram?: Program;
  resolvedStatus: ExecutionStatus;
  statusMatchReason: string;
  isDuplicate: boolean;
  isValid: boolean;
}

interface ParsedNewProgramRow {
  rowIdx: number;
  code: string;
  title: string;
  section: ProgramSection;
  scope: ProgramScope;
  coefficient: ProgramCoefficient;
  deadline: string;
  startDate: string;
  axis: string;
  description: string;
  isExisting: boolean;
  matchedProgramId?: string;
  isValid: boolean;
  validationError?: string;
}

interface ParsedPerProgramRow {
  rowIdx: number;
  rawIdentifier: string;
  fullName: string;
  schoolName: string;
  statusText: string;
  executionDate: string;
  platform: string;
  notes: string;
  matchedEmployee?: Employee;
  resolvedStatus: ExecutionStatus;
  isValid: boolean;
}

export const ExcelBulkImport: React.FC<ExcelBulkImportProps> = ({
  db,
  onUpdateDatabase,
  onNavigateToTab,
  initialMode = 'employees',
  initialProgramId,
}) => {
  // 4 Modes:
  // 1. 'employees' = بارگذاری مشخصات همکاران
  // 2. 'tasks' = ثبت گروهی وضعیت اجرای تکالیف
  // 3. 'per_program' = ورود گروه هر طرح و برنامه (اضافه کردن گروهی بر اساس هر طرح)
  // 4. 'programs' = ورود گروهی طرح‌ها و برنامه‌ها
  const [activeImportTarget, setActiveImportTarget] = useState<'employees' | 'tasks' | 'per_program' | 'programs'>(
    initialMode,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const perProgramFileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);

  // Toast message for downloads and user actions
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [showTaskTemplateModal, setShowTaskTemplateModal] = useState(false);

  // 1. Employee Import specific state
  const [employeeColumnMap, setEmployeeColumnMap] = useState({
    nationalId: '',
    personnelCode: '',
    fullName: '',
    schoolName: '',
    grade: '',
    role: '',
    experienceYears: '',
    employeeCode: '',
    phone: '',
    notes: '',
  });
  const [parsedEmployeeRows, setParsedEmployeeRows] = useState<ParsedEmployeeRow[]>([]);
  const [overwriteExistingEmployees, setOverwriteExistingEmployees] = useState(true);

  // 2. Task Status Import specific state
  const [targetProgramId, setTargetProgramId] = useState<string>('use_file_column');
  const [taskColumnMap, setTaskColumnMap] = useState({
    employeeCode: '',
    personnelCode: '',
    nationalId: '',
    fullName: '',
    programCodeOrTitle: '',
    status: '',
    date: '',
    platform: '',
    notes: '',
  });
  const [parsedTaskRows, setParsedTaskRows] = useState<ParsedTaskStatusRow[]>([]);

  // 3. Per Program Group Import (ورود گروه هر طرح و برنامه)
  const [selectedProgramIdForBulk, setSelectedProgramIdForBulk] = useState<string>(
    initialProgramId || db.programs[0]?.id || '',
  );
  const [perProgramSectionFilter, setPerProgramSectionFilter] = useState<string>('all');
  const [perProgramSearchTerm, setPerProgramSearchTerm] = useState<string>('');
  const [perProgramMode, setPerProgramMode] = useState<'excel' | 'direct' | 'quick_add'>('excel');

  // Per Program Excel Upload State
  const [perProgramColumnMap, setPerProgramColumnMap] = useState({
    employeeCode: '',
    personnelCode: '',
    nationalId: '',
    fullName: '',
    status: '',
    date: '',
    platform: '',
    notes: '',
  });
  const [parsedPerProgramRows, setParsedPerProgramRows] = useState<ParsedPerProgramRow[]>([]);

  // Per Program Direct Entry State
  const [directGradeFilter, setDirectGradeFilter] = useState<string>('all');
  const [directSearchQuery, setDirectSearchQuery] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkStatusToApply, setBulkStatusToApply] = useState<ExecutionStatus>('done');
  const [bulkDateToApply, setBulkDateToApply] = useState<string>(getCurrentJalaliDate());
  const [bulkPlatformToApply, setBulkPlatformToApply] = useState<DocumentationPlatform>('ایتا');
  const [bulkNotesToApply, setBulkNotesToApply] = useState<string>('ثبت گروهی در کارتابل طرح');
  const [individualStatuses, setIndividualStatuses] = useState<{ [empId: string]: ExecutionStatus }>({});

  // Quick Add Program Form State
  const [quickProgramCode, setQuickProgramCode] = useState<string>('');
  const [quickProgramTitle, setQuickProgramTitle] = useState<string>('');
  const [quickProgramSection, setQuickProgramSection] = useState<ProgramSection>('پرورشی');
  const [quickProgramScope, setQuickProgramScope] = useState<ProgramScope>('همگانی');
  const [quickProgramCoefficient, setQuickProgramCoefficient] = useState<ProgramCoefficient>(1);
  const [quickProgramDeadline, setQuickProgramDeadline] = useState<string>('1403/10/30');
  const [quickProgramDescription, setQuickProgramDescription] = useState<string>('');

  // 4. New Programs Definition Import specific state
  const [newProgramColumnMap, setNewProgramColumnMap] = useState({
    code: '',
    title: '',
    section: '',
    scope: '',
    coefficient: '',
    deadline: '',
    startDate: '',
    axis: '',
    description: '',
  });
  const [parsedNewProgramRows, setParsedNewProgramRows] = useState<ParsedNewProgramRow[]>([]);
  const [overwriteExistingPrograms, setOverwriteExistingPrograms] = useState(true);
  const [autoAssignToEmployees, setAutoAssignToEmployees] = useState(true);

  // Shared state
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    details?: { [key: string]: number | string };
  } | null>(null);

  // Ensure selected program exists
  useEffect(() => {
    if (db.programs.length > 0 && !db.programs.some((p) => p.id === selectedProgramIdForBulk)) {
      setSelectedProgramIdForBulk(db.programs[0].id);
    }
  }, [db.programs, selectedProgramIdForBulk]);

  // Selected Program object
  const activeProgram = db.programs.find((p) => p.id === selectedProgramIdForBulk) || db.programs[0];

  // Helper toast notification
  const triggerToast = (msg: string) => {
    setDownloadToast(msg);
    setTimeout(() => {
      setDownloadToast((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  // ==========================================
  // AUTO-DETECTION FUNCTIONS
  // ==========================================

  const autoDetectEmployeeColumns = (headers: string[]) => {
    const map = {
      nationalId: '',
      personnelCode: '',
      fullName: '',
      schoolName: '',
      grade: '',
      role: '',
      experienceYears: '',
      employeeCode: '',
      phone: '',
      notes: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی') || norm.includes('national')) {
        map.nationalId = h;
      } else if (norm.includes('پرسنلی') || norm.includes('استخدامی') || norm.includes('personnel')) {
        map.personnelCode = h;
      } else if (norm.includes('نام') && (norm.includes('خانوادگی') || norm.includes('همکار') || norm === 'نام')) {
        map.fullName = h;
      } else if (norm.includes('آموزشگاه') || norm.includes('مدرسه') || norm.includes('واحد آموزشی') || norm.includes('school')) {
        map.schoolName = h;
      } else if (norm.includes('مقطع') || norm.includes('دوره') || norm.includes('پایه') || norm.includes('grade')) {
        map.grade = h;
      } else if (norm.includes('سمت') || norm.includes('پست') || norm.includes('نقش') || norm.includes('شغل') || norm.includes('role')) {
        map.role = h;
      } else if (norm.includes('سابقه') || norm.includes('سنوات') || norm.includes('تجربه') || norm.includes('experience')) {
        map.experienceYears = h;
      } else if ((norm.includes('کد') && norm.includes('کارتابل')) || norm.includes('کد دو رقمی') || norm === 'کد') {
        map.employeeCode = h;
      } else if (norm.includes('همراه') || norm.includes('موبایل') || norm.includes('تلفن') || norm.includes('phone')) {
        map.phone = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('سوابق')) {
        map.notes = h;
      }
    });

    return map;
  };

  const autoDetectTaskColumns = (headers: string[]) => {
    const map = {
      employeeCode: '',
      personnelCode: '',
      nationalId: '',
      fullName: '',
      programCodeOrTitle: '',
      status: '',
      date: '',
      platform: '',
      notes: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی')) {
        map.nationalId = h;
      } else if (norm.includes('پرسنلی') || norm.includes('استخدامی')) {
        map.personnelCode = h;
      } else if ((norm.includes('کد') && norm.includes('همکار')) || norm.includes('کد اختصاصی') || norm.includes('کد دو رقمی') || norm === 'کد') {
        map.employeeCode = h;
      } else if (norm.includes('نام') && (norm.includes('خانوادگی') || norm.includes('همکار') || norm === 'نام')) {
        map.fullName = h;
      } else if (norm.includes('طرح') || norm.includes('برنامه') || norm.includes('فعالیت')) {
        map.programCodeOrTitle = h;
      } else if (norm.includes('وضعیت') || norm.includes('نتیجه') || norm.includes('اجرا') || norm.includes('عملکرد')) {
        map.status = h;
      } else if (norm.includes('تاریخ') || norm.includes('زمان')) {
        map.date = h;
      } else if (norm.includes('بستر') || norm.includes('پلتفرم') || norm.includes('ارسال') || norm.includes('ایتا') || norm.includes('شاد')) {
        map.platform = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('مستند')) {
        map.notes = h;
      }
    });

    return map;
  };

  const autoDetectPerProgramColumns = (headers: string[]) => {
    const map = {
      employeeCode: '',
      personnelCode: '',
      nationalId: '',
      fullName: '',
      status: '',
      date: '',
      platform: '',
      notes: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی')) {
        map.nationalId = h;
      } else if (norm.includes('پرسنلی') || norm.includes('استخدامی')) {
        map.personnelCode = h;
      } else if ((norm.includes('کد') && norm.includes('همکار')) || norm.includes('کد دو رقمی') || norm === 'کد') {
        map.employeeCode = h;
      } else if (norm.includes('نام') && (norm.includes('خانوادگی') || norm.includes('همکار') || norm === 'نام')) {
        map.fullName = h;
      } else if (norm.includes('وضعیت') || norm.includes('اجرا') || norm.includes('عملکرد') || norm.includes('نتیجه')) {
        map.status = h;
      } else if (norm.includes('تاریخ') || norm.includes('زمان')) {
        map.date = h;
      } else if (norm.includes('بستر') || norm.includes('پلتفرم') || norm.includes('ارسال') || norm.includes('ایتا') || norm.includes('شاد')) {
        map.platform = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('بازخورد')) {
        map.notes = h;
      }
    });

    return map;
  };

  const autoDetectNewProgramColumns = (headers: string[]) => {
    const map = {
      code: '',
      title: '',
      section: '',
      scope: '',
      coefficient: '',
      deadline: '',
      startDate: '',
      axis: '',
      description: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if ((norm.includes('کد') && norm.includes('طرح')) || norm.includes('شناسه') || norm === 'کد') {
        map.code = h;
      } else if (norm.includes('عنوان') || norm.includes('نام طرح') || norm.includes('نام برنامه') || norm === 'طرح' || norm === 'برنامه') {
        map.title = h;
      } else if (norm.includes('بخش') || norm.includes('حوزه') || norm.includes('معاونت') || norm.includes('قسمت')) {
        map.section = h;
      } else if (norm.includes('شمول') || norm.includes('دامنه') || norm.includes('نوع') || norm.includes('دامنه شمول')) {
        map.scope = h;
      } else if (norm.includes('ضریب') || norm.includes('وزن') || norm.includes('اهمیت') || norm.includes('امتیاز')) {
        map.coefficient = h;
      } else if (norm.includes('مهلت') || norm.includes('پایان') || (norm.includes('تاریخ') && norm.includes('اجرا'))) {
        map.deadline = h;
      } else if (norm.includes('شروع') || norm.includes('ابتدای')) {
        map.startDate = h;
      } else if (norm.includes('محور') || norm.includes('موضوع') || norm.includes('هدف')) {
        map.axis = h;
      } else if (norm.includes('توضیح') || norm.includes('شرح') || norm.includes('دستورالعمل')) {
        map.description = h;
      }
    });

    return map;
  };

  // Helper normalizers
  const normalizeGrade = (raw: string): EducationalGrade => {
    const n = normalizePersianText(raw);
    if (n.includes('ابتدایی') && (n.includes('یک') || n.includes('اول'))) return 'ابتدایی دوره اول';
    if (n.includes('ابتدایی') && (n.includes('دو') || n.includes('دوم'))) return 'ابتدایی دوره دوم';
    if (n.includes('ابتدایی')) return 'ابتدایی دوره دوم';
    if (n.includes('متوسطه اول') || n.includes('راهنمایی')) return 'متوسطه اول';
    if (n.includes('هنرستان') || n.includes('فنی') || n.includes('کاردانش'))
      return 'هنرستان فنی و حرفه‌ای و کاردانش';
    if (n.includes('متوسطه دوم') || n.includes('دبیرستان')) return 'متوسطه دوم نظری';
    return 'مجتمع آموزشی و پرورشی';
  };

  const normalizeRole = (raw: string): string => {
    const n = normalizePersianText(raw);
    if (n.includes('معاون') && n.includes('پرورشی')) return 'معاون پرورشی';
    if (n.includes('مربی') && n.includes('پرورشی')) return 'مربی پرورشی';
    if (n.includes('مشاور')) return 'مشاور مدرسه';
    if (n.includes('مدیر')) return 'مدیر مدرسه';
    if (n.includes('آموزگار')) return 'آموزگار';
    if (n.includes('دبیر')) return 'دبیر';
    if (n.includes('معاون آموزشی')) return 'معاون آموزشی';
    if (n.includes('تربیت بدنی') || n.includes('ورزش')) return 'دبیر تربیت بدنی';
    return raw || 'سایر';
  };

  const normalizeSection = (raw: string): ProgramSection => {
    const n = normalizePersianText(raw);
    if (n.includes('پرورشی') || n.includes('فرهنگی') || n.includes('قرآن')) return 'پرورشی';
    if (n.includes('ابتدایی')) return 'آموزش ابتدایی';
    if (n.includes('متوسطه اول') || n.includes('راهنمایی')) return 'آموزش متوسطه اول';
    if (n.includes('متوسطه دوم') || n.includes('دبیرستان') || n.includes('هنرستان')) return 'آموزش متوسطه دوم';
    if (n.includes('بدنی') || n.includes('ورزش') || n.includes('سلامت')) return 'تربیت بدنی';
    return 'پرورشی';
  };

  const normalizeScope = (raw: string): ProgramScope => {
    const n = normalizePersianText(raw);
    if (n.includes('اختصاصی') || n.includes('ویژه')) return 'اختصاصی';
    return 'همگانی';
  };

  const normalizeCoefficient = (raw: string | number): ProgramCoefficient => {
    const s = String(raw).trim();
    if (s.includes('3') || s.includes('۳')) return 3;
    if (s.includes('2') || s.includes('۲')) return 2;
    return 1;
  };

  const parseExecutionStatus = (raw: string): { status: ExecutionStatus; reason: string } => {
    const n = normalizePersianText(raw);
    if (n === 'done' || n === 'انجام شده' || n === 'انجام' || n === 'کامل' || n === 'تایید' || n === 'موفق') {
      return { status: 'done', reason: 'تشخیص به‌موقع (امتیاز کامل)' };
    }
    if (n === 'late' || n === 'دیر انجام شده' || n === 'دیر' || n === 'با تاخیر' || n === 'تاخیر') {
      return { status: 'late', reason: 'تشخیص با تاخیر (۶۰٪ امتیاز)' };
    }
    return { status: 'not_done', reason: 'عدم اجرا (صفر امتیاز)' };
  };

  // ==========================================
  // FILE READING & SHEET CHANGE
  // ==========================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFormErrorMessage(null);
    setExecutionResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          loadSheetData(wb, firstSheet);
        }
      } catch (err: any) {
        console.error('Error reading excel file:', err);
        setFormErrorMessage('خطا در خواندن فایل اکسل. لطفاً از سالم بودن فایل مطمئن شوید.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!json || json.length === 0) {
      setFormErrorMessage('کاربرگ انتخاب‌شده فاقد اطلاعات است.');
      return;
    }

    const headers = (json[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
    const rows = json.slice(1).filter((r) => r.some((c) => c !== undefined && c !== null && String(c).trim() !== ''));

    setRawHeaders(headers);
    setRawDataRows(rows);

    if (activeImportTarget === 'employees') {
      setEmployeeColumnMap(autoDetectEmployeeColumns(headers));
    } else if (activeImportTarget === 'tasks') {
      setTaskColumnMap(autoDetectTaskColumns(headers));
    } else if (activeImportTarget === 'per_program') {
      setPerProgramColumnMap(autoDetectPerProgramColumns(headers));
    } else if (activeImportTarget === 'programs') {
      setNewProgramColumnMap(autoDetectNewProgramColumns(headers));
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbook) {
      loadSheetData(workbook, newSheet);
    }
  };

  // ==========================================
  // 1. ANALYZE & COMMIT EMPLOYEES IMPORT
  // ==========================================
  const analyzeEmployeeImport = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);

    const existingByNatId = new Map<string, Employee>();
    const existingByPersonnel = new Map<string, Employee>();
    const existingCodes = new Set<string>();

    db.employees.forEach((emp) => {
      if (emp.nationalId) existingByNatId.set(emp.nationalId.trim(), emp);
      if (emp.personnelCode) existingByPersonnel.set(emp.personnelCode.trim(), emp);
      if (emp.code) existingCodes.add(emp.code.trim());
    });

    let nextCodeNum = db.employees.length + 1;
    const generateNextCode = () => {
      while (existingCodes.has(String(nextCodeNum).padStart(2, '0'))) {
        nextCodeNum++;
      }
      const code = String(nextCodeNum).padStart(2, '0');
      existingCodes.add(code);
      return code;
    };

    const parsed: ParsedEmployeeRow[] = [];

    rawDataRows.forEach((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const cIdx = rawHeaders.indexOf(col);
        return cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
      };

      const nationalId = getVal(employeeColumnMap.nationalId);
      const personnelCode = getVal(employeeColumnMap.personnelCode);
      const fullName = getVal(employeeColumnMap.fullName);
      const schoolName = getVal(employeeColumnMap.schoolName);
      const gradeRaw = getVal(employeeColumnMap.grade);
      const roleRaw = getVal(employeeColumnMap.role);
      const expRaw = getVal(employeeColumnMap.experienceYears);
      const phone = getVal(employeeColumnMap.phone);
      const notes = getVal(employeeColumnMap.notes);

      if (!fullName && !nationalId && !personnelCode) {
        return;
      }

      const matchedEmp =
        (nationalId ? existingByNatId.get(nationalId) : null) ||
        (personnelCode ? existingByPersonnel.get(personnelCode) : null);

      const isExisting = Boolean(matchedEmp);
      const assignedCode = matchedEmp ? matchedEmp.code : generateNextCode();
      const schoolExists = schoolName
        ? db.schools.some((s) => normalizePersianText(s.name) === normalizePersianText(schoolName))
        : false;

      parsed.push({
        rowIdx: idx + 2,
        fullName: fullName || matchedEmp?.fullName || 'نامشخص',
        nationalId: nationalId || matchedEmp?.nationalId || '',
        personnelCode: personnelCode || matchedEmp?.personnelCode || '',
        employeeCode: assignedCode,
        schoolName: schoolName || matchedEmp?.schoolName || 'آموزشگاه نامشخص',
        grade: gradeRaw ? normalizeGrade(gradeRaw) : matchedEmp?.grade || 'ابتدایی دوره دوم',
        role: roleRaw ? normalizeRole(roleRaw) : matchedEmp?.role || 'سایر',
        experienceYears: expRaw !== '' ? expRaw : matchedEmp?.experienceYears || 0,
        phone: phone || matchedEmp?.phone || '',
        notes: notes || matchedEmp?.notes || '',
        isExisting,
        matchedEmployeeId: matchedEmp?.id,
        willCreateSchool: Boolean(schoolName && !schoolExists),
        assignedCode,
        isValid: Boolean(fullName),
      });
    });

    setParsedEmployeeRows(parsed);
    setIsProcessing(false);
  };

  const handleCommitEmployeeImport = () => {
    if (parsedEmployeeRows.length === 0) return;
    const validRows = parsedEmployeeRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setFormErrorMessage('هیچ ردیف معتبری برای ثبت پیدا نشد.');
      return;
    }

    let updatedEmployees = [...db.employees];
    let updatedSchools = [...db.schools];
    let updatedAssignments = [...db.employeePrograms];

    let createdCount = 0;
    let updatedCount = 0;
    let newSchoolsCount = 0;

    validRows.forEach((row) => {
      let schoolId = '';
      const existingSchool = updatedSchools.find(
        (s) => normalizePersianText(s.name) === normalizePersianText(row.schoolName),
      );

      if (existingSchool) {
        schoolId = existingSchool.id;
      } else if (row.schoolName) {
        const newSchoolId = `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        updatedSchools.push({
          id: newSchoolId,
          code: `SCH-${String(updatedSchools.length + 1).padStart(3, '0')}`,
          name: row.schoolName,
          grade: row.grade,
          gender: 'مختلط',
        });
        schoolId = newSchoolId;
        newSchoolsCount++;
      }

      if (row.isExisting && row.matchedEmployeeId && overwriteExistingEmployees) {
        const idx = updatedEmployees.findIndex((e) => e.id === row.matchedEmployeeId);
        if (idx !== -1) {
          const current = updatedEmployees[idx];
          updatedEmployees[idx] = {
            ...current,
            fullName: row.fullName || current.fullName,
            nationalId: row.nationalId || current.nationalId,
            personnelCode: row.personnelCode || current.personnelCode,
            schoolName: row.schoolName || current.schoolName,
            schoolId: schoolId || current.schoolId,
            grade: row.grade || current.grade,
            role: (row.role as StandardStaffRole) || current.role,
            experienceYears: Number(row.experienceYears) || current.experienceYears,
            phone: row.phone || current.phone,
            notes: row.notes || current.notes,
          };
          updatedCount++;
        }
      } else if (!row.isExisting) {
        const newEmpId = `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newEmp: Employee = {
          id: newEmpId,
          code: row.assignedCode,
          fullName: row.fullName,
          nationalId: row.nationalId,
          personnelCode: row.personnelCode,
          schoolName: row.schoolName,
          schoolId,
          grade: row.grade,
          role: (row.role as StandardStaffRole) || 'سایر',
          experienceYears: Number(row.experienceYears) || 0,
          phone: row.phone,
          notes: row.notes,
          createdAt: getCurrentJalaliDate(),
        };
        updatedEmployees.push(newEmp);
        createdCount++;

        // Auto-assign existing programs
        db.programs.forEach((prg) => {
          updatedAssignments.push({
            id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            employeeId: newEmpId,
            employeeCode: newEmp.code,
            programId: prg.id,
            status: 'not_done',
            isManualOverride: false,
            updatedAt: getCurrentJalaliDate(),
          });
        });
      }
    });

    onUpdateDatabase({
      ...db,
      employees: updatedEmployees,
      schools: updatedSchools,
      employeePrograms: updatedAssignments,
    });

    setExecutionResult({
      success: true,
      title: 'ورود گروهی همکاران با موفقیت انجام شد',
      message: `${toPersianDigits(createdCount)} همکار جدید افزوده شد و اطلاعات ${toPersianDigits(updatedCount)} همکار موجود به‌روزرسانی گردید.`,
      details: {
        'همکاران جدید': createdCount,
        'همکاران به‌روزرسانی‌شده': updatedCount,
        'مدارس جدید ایجاد شده': newSchoolsCount,
        'مجموع پرسنل سامانه': updatedEmployees.length,
      },
    });

    setParsedEmployeeRows([]);
  };

  // ==========================================
  // 2. ANALYZE & COMMIT TASK STATUSES IMPORT
  // ==========================================
  const analyzeTaskStatusImport = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);

    const empByCode = new Map<string, Employee>();
    const empByPersonnel = new Map<string, Employee>();
    const empByNatId = new Map<string, Employee>();
    const empByName = new Map<string, Employee>();

    db.employees.forEach((emp) => {
      if (emp.code) empByCode.set(emp.code.trim().padStart(2, '0'), emp);
      if (emp.personnelCode) empByPersonnel.set(emp.personnelCode.trim(), emp);
      if (emp.nationalId) empByNatId.set(emp.nationalId.trim(), emp);
      if (emp.fullName) empByName.set(normalizePersianText(emp.fullName), emp);
    });

    const prgByCode = new Map<string, Program>();
    const prgByTitle = new Map<string, Program>();

    db.programs.forEach((p) => {
      if (p.code) prgByCode.set(p.code.trim().toUpperCase(), p);
      if (p.title) prgByTitle.set(normalizePersianText(p.title), p);
    });

    const fixedTargetProgram =
      targetProgramId !== 'use_file_column' ? db.programs.find((p) => p.id === targetProgramId) : null;

    const parsed: ParsedTaskStatusRow[] = [];

    rawDataRows.forEach((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const cIdx = rawHeaders.indexOf(col);
        return cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
      };

      const empCodeRaw = getVal(taskColumnMap.employeeCode);
      const personnelRaw = getVal(taskColumnMap.personnelCode);
      const natIdRaw = getVal(taskColumnMap.nationalId);
      const fullName = getVal(taskColumnMap.fullName);
      const prgCodeOrTitle = getVal(taskColumnMap.programCodeOrTitle);
      const statusText = getVal(taskColumnMap.status);
      const execDate = getVal(taskColumnMap.date);
      const platform = getVal(taskColumnMap.platform);
      const notes = getVal(taskColumnMap.notes);

      if (!statusText && !empCodeRaw && !fullName) {
        return;
      }

      // Match employee
      let matchedEmp: Employee | undefined = undefined;
      if (empCodeRaw) {
        matchedEmp = empByCode.get(empCodeRaw.padStart(2, '0')) || empByCode.get(empCodeRaw);
      }
      if (!matchedEmp && personnelRaw) {
        matchedEmp = empByPersonnel.get(personnelRaw);
      }
      if (!matchedEmp && natIdRaw) {
        matchedEmp = empByNatId.get(natIdRaw);
      }
      if (!matchedEmp && fullName) {
        matchedEmp = empByName.get(normalizePersianText(fullName));
      }

      // Match program
      let matchedPrg = fixedTargetProgram;
      if (!matchedPrg && prgCodeOrTitle) {
        matchedPrg =
          prgByCode.get(prgCodeOrTitle.toUpperCase()) || prgByTitle.get(normalizePersianText(prgCodeOrTitle));
      }

      const { status: resolvedStatus, reason: statusMatchReason } = parseExecutionStatus(statusText);

      parsed.push({
        rowIdx: idx + 2,
        rawIdentifier: empCodeRaw || personnelRaw || natIdRaw || fullName || 'نامشخص',
        fullName: fullName || matchedEmp?.fullName || '',
        programTitleOrCode: fixedTargetProgram?.title || prgCodeOrTitle || 'نامشخص',
        statusText,
        executionDate: execDate,
        platform: platform || 'ایتا',
        notes,
        matchedEmployee: matchedEmp,
        matchedProgram: matchedPrg || undefined,
        resolvedStatus,
        statusMatchReason,
        isDuplicate: false,
        isValid: Boolean(matchedEmp && matchedPrg),
      });
    });

    setParsedTaskRows(parsed);
    setIsProcessing(false);
  };

  const handleCommitTaskStatusImport = () => {
    if (parsedTaskRows.length === 0) return;
    const validRows = parsedTaskRows.filter((r) => r.isValid && r.matchedEmployee && r.matchedProgram);
    if (validRows.length === 0) {
      setFormErrorMessage('هیچ ردیف معتبری که هم همکار و هم طرح آن تطبیق داده شده باشد یافت نشد.');
      return;
    }

    let updatedAssignments = [...db.employeePrograms];
    let updatedCount = 0;
    let createdCount = 0;

    validRows.forEach((row) => {
      const emp = row.matchedEmployee!;
      const prg = row.matchedProgram!;
      const subDate = row.executionDate || getCurrentJalaliDate();
      const platform = (row.platform as DocumentationPlatform) || 'ایتا';

      const existingIdx = updatedAssignments.findIndex(
        (ep) => ep.employeeId === emp.id && ep.programId === prg.id,
      );

      if (existingIdx !== -1) {
        updatedAssignments[existingIdx] = {
          ...updatedAssignments[existingIdx],
          status: row.resolvedStatus,
          actualDate: subDate,
          executionDate: subDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          submissionPlatform: platform,
          documentationPlatform: platform,
          notes: row.notes || updatedAssignments[existingIdx].notes,
          updatedAt: getCurrentJalaliDate(),
        };
        updatedCount++;
      } else {
        updatedAssignments.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          programId: prg.id,
          status: row.resolvedStatus,
          isManualOverride: false,
          actualDate: subDate,
          executionDate: subDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          submissionPlatform: platform,
          documentationPlatform: platform,
          notes: row.notes || 'ثبت وضعیت از اکسل',
          updatedAt: getCurrentJalaliDate(),
        });
        createdCount++;
      }
    });

    onUpdateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });

    setExecutionResult({
      success: true,
      title: 'وضعیت تکالیف با موفقیت در سامانه ثبت شد',
      message: `${toPersianDigits(updatedCount + createdCount)} تکلیف در پرونده همکاران به‌روزرسانی گردید.`,
      details: {
        'تکالیف به‌روزرسانی‌شده': updatedCount,
        'تکالیف جدید ایجاد شده': createdCount,
        'مجموع تکالیف فعال': updatedAssignments.length,
      },
    });

    setParsedTaskRows([]);
  };

  // ==========================================
  // 3. ANALYZE & COMMIT FOR PER-PROGRAM MODE
  // ==========================================
  const analyzePerProgramImport = () => {
    if (rawDataRows.length === 0 || !activeProgram) return;
    setIsProcessing(true);

    const empByCode = new Map<string, Employee>();
    const empByPersonnel = new Map<string, Employee>();
    const empByNatId = new Map<string, Employee>();
    const empByName = new Map<string, Employee>();

    db.employees.forEach((emp) => {
      if (emp.code) empByCode.set(emp.code.trim().padStart(2, '0'), emp);
      if (emp.personnelCode) empByPersonnel.set(emp.personnelCode.trim(), emp);
      if (emp.nationalId) empByNatId.set(emp.nationalId.trim(), emp);
      if (emp.fullName) empByName.set(normalizePersianText(emp.fullName), emp);
    });

    const parsed: ParsedPerProgramRow[] = [];

    rawDataRows.forEach((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const cIdx = rawHeaders.indexOf(col);
        return cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
      };

      const empCodeRaw = getVal(perProgramColumnMap.employeeCode);
      const personnelRaw = getVal(perProgramColumnMap.personnelCode);
      const natIdRaw = getVal(perProgramColumnMap.nationalId);
      const fullName = getVal(perProgramColumnMap.fullName);
      const statusText = getVal(perProgramColumnMap.status);
      const execDate = getVal(perProgramColumnMap.date);
      const platform = getVal(perProgramColumnMap.platform);
      const notes = getVal(perProgramColumnMap.notes);

      if (!statusText && !empCodeRaw && !fullName) {
        return;
      }

      // Match employee
      let matchedEmp: Employee | undefined = undefined;
      if (empCodeRaw) {
        matchedEmp = empByCode.get(empCodeRaw.padStart(2, '0')) || empByCode.get(empCodeRaw);
      }
      if (!matchedEmp && personnelRaw) {
        matchedEmp = empByPersonnel.get(personnelRaw);
      }
      if (!matchedEmp && natIdRaw) {
        matchedEmp = empByNatId.get(natIdRaw);
      }
      if (!matchedEmp && fullName) {
        matchedEmp = empByName.get(normalizePersianText(fullName));
      }

      const { status: resolvedStatus } = parseExecutionStatus(statusText);

      parsed.push({
        rowIdx: idx + 2,
        rawIdentifier: empCodeRaw || personnelRaw || natIdRaw || fullName || 'نامشخص',
        fullName: fullName || matchedEmp?.fullName || '',
        schoolName: matchedEmp?.schoolName || '---',
        statusText,
        executionDate: execDate || getCurrentJalaliDate(),
        platform: platform || 'ایتا',
        notes,
        matchedEmployee: matchedEmp,
        resolvedStatus,
        isValid: Boolean(matchedEmp),
      });
    });

    setParsedPerProgramRows(parsed);
    setIsProcessing(false);
  };

  const handleCommitPerProgramExcelImport = () => {
    if (!activeProgram || parsedPerProgramRows.length === 0) return;
    const validRows = parsedPerProgramRows.filter((r) => r.isValid && r.matchedEmployee);
    if (validRows.length === 0) {
      setFormErrorMessage('هیچ همکاری جهت ثبت وضعیت این طرح تطبیق داده نشد.');
      return;
    }

    let updatedAssignments = [...db.employeePrograms];
    let updatedCount = 0;
    let createdCount = 0;

    validRows.forEach((row) => {
      const emp = row.matchedEmployee!;
      const subDate = row.executionDate || getCurrentJalaliDate();
      const platform = (row.platform as DocumentationPlatform) || 'ایتا';

      const existingIdx = updatedAssignments.findIndex(
        (ep) => ep.employeeId === emp.id && ep.programId === activeProgram.id,
      );

      if (existingIdx !== -1) {
        updatedAssignments[existingIdx] = {
          ...updatedAssignments[existingIdx],
          status: row.resolvedStatus,
          actualDate: subDate,
          executionDate: subDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          submissionPlatform: platform,
          documentationPlatform: platform,
          notes: row.notes || updatedAssignments[existingIdx].notes,
          updatedAt: getCurrentJalaliDate(),
        };
        updatedCount++;
      } else {
        updatedAssignments.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          programId: activeProgram.id,
          status: row.resolvedStatus,
          isManualOverride: false,
          actualDate: subDate,
          executionDate: subDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          submissionPlatform: platform,
          documentationPlatform: platform,
          notes: row.notes || `ثبت گروهی طرح ${activeProgram.title}`,
          updatedAt: getCurrentJalaliDate(),
        });
        createdCount++;
      }
    });

    onUpdateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });

    setExecutionResult({
      success: true,
      title: `ثبت گروهی طرح «${activeProgram.title}» انجام شد`,
      message: `عملکرد و وضعیت این طرح برای ${toPersianDigits(validRows.length)} همکار در سامانه ذخیره گردید.`,
      details: {
        'طرح هدف': activeProgram.title,
        'تکالیف به‌روزرسانی‌شده': updatedCount,
        'تکالیف جدید ایجاد شده': createdCount,
        'کل همکاران ثبت‌شده': validRows.length,
      },
    });

    setParsedPerProgramRows([]);
  };

  // Direct In-App Batch Entry for a Program
  const handleDirectBatchCommit = () => {
    if (!activeProgram) return;
    if (selectedEmployeeIds.length === 0) {
      setFormErrorMessage('لطفاً حداقل یک همکار را از لیست زیر انتخاب کنید.');
      return;
    }

    let updatedAssignments = [...db.employeePrograms];
    let createdCount = 0;
    let updatedCount = 0;

    selectedEmployeeIds.forEach((empId) => {
      const emp = db.employees.find((e) => e.id === empId);
      if (!emp) return;

      const rowStatus = individualStatuses[empId] || bulkStatusToApply;
      const existingIdx = updatedAssignments.findIndex(
        (ep) => ep.employeeId === emp.id && ep.programId === activeProgram.id,
      );

      if (existingIdx !== -1) {
        updatedAssignments[existingIdx] = {
          ...updatedAssignments[existingIdx],
          status: rowStatus,
          actualDate: bulkDateToApply,
          executionDate: bulkDateToApply,
          submissionDate: bulkDateToApply,
          docSubmissionDate: bulkDateToApply,
          submissionPlatform: bulkPlatformToApply,
          documentationPlatform: bulkPlatformToApply,
          notes: bulkNotesToApply,
          updatedAt: getCurrentJalaliDate(),
        };
        updatedCount++;
      } else {
        updatedAssignments.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          programId: activeProgram.id,
          status: rowStatus,
          isManualOverride: false,
          actualDate: bulkDateToApply,
          executionDate: bulkDateToApply,
          submissionDate: bulkDateToApply,
          docSubmissionDate: bulkDateToApply,
          submissionPlatform: bulkPlatformToApply,
          documentationPlatform: bulkPlatformToApply,
          notes: bulkNotesToApply,
          updatedAt: getCurrentJalaliDate(),
        });
        createdCount++;
      }
    });

    onUpdateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });

    setExecutionResult({
      success: true,
      title: `تخصیص و ثبت گروهی طرح «${activeProgram.title}» با موفقیت انجام شد`,
      message: `این طرح برای ${toPersianDigits(selectedEmployeeIds.length)} همکار با وضعیت انتخاب‌شده ثبت شد.`,
      details: {
        'طرح منتخب': activeProgram.title,
        'تعداد همکاران ثبت شده': selectedEmployeeIds.length,
        'وضعیت اعمال‌شده':
          bulkStatusToApply === 'done'
            ? 'انجام شده (کامل)'
            : bulkStatusToApply === 'late'
            ? 'دیر انجام شده'
            : 'انجام نشده',
        'بستر مستندات': bulkPlatformToApply,
      },
    });

    setSelectedEmployeeIds([]);
  };

  // Quick Add New Program Handler
  const handleCreateQuickProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProgramTitle.trim()) {
      setFormErrorMessage('لطفاً عنوان طرح را وارد نمایید.');
      return;
    }

    const code = quickProgramCode.trim() || `PRG-${String(db.programs.length + 1).padStart(2, '0')}`;
    const newPrg: Program = {
      id: `prg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      title: quickProgramTitle.trim(),
      section: quickProgramSection,
      scope: quickProgramScope,
      coefficient: quickProgramCoefficient,
      deadline: quickProgramDeadline || '1403/10/30',
      startDate: '1403/07/01',
      axis: quickProgramSection,
      description: quickProgramDescription.trim(),
      isActive: true,
      createdAt: getCurrentJalaliDate(),
    };

    onUpdateDatabase({
      ...db,
      programs: [...db.programs, newPrg],
    });

    setSelectedProgramIdForBulk(newPrg.id);
    setPerProgramMode('excel');
    triggerToast(`طرح «${newPrg.title}» با موفقیت تعریف شد و انتخاب گردید.`);

    // Reset quick form
    setQuickProgramTitle('');
    setQuickProgramCode('');
    setQuickProgramDescription('');
  };

  // ==========================================
  // 4. ANALYZE & COMMIT NEW PROGRAMS IMPORT
  // ==========================================
  const analyzeNewProgramImport = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);

    const existingByCode = new Map<string, Program>();
    const existingByTitle = new Map<string, Program>();

    db.programs.forEach((p) => {
      existingByCode.set(p.code.trim().toUpperCase(), p);
      existingByTitle.set(normalizePersianText(p.title), p);
    });

    let nextCodeNum = db.programs.length + 1;
    const generateNextCode = () => {
      while (existingByCode.has(`PRG-${String(nextCodeNum).padStart(2, '0')}`)) {
        nextCodeNum++;
      }
      return `PRG-${String(nextCodeNum).padStart(2, '0')}`;
    };

    const parsed: ParsedNewProgramRow[] = [];

    rawDataRows.forEach((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const cIdx = rawHeaders.indexOf(col);
        return cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
      };

      const title = getVal(newProgramColumnMap.title);
      let codeRaw = getVal(newProgramColumnMap.code).toUpperCase();
      const sectionRaw = getVal(newProgramColumnMap.section);
      const scopeRaw = getVal(newProgramColumnMap.scope);
      const coeffRaw = getVal(newProgramColumnMap.coefficient);
      const deadlineRaw = getVal(newProgramColumnMap.deadline);
      const startRaw = getVal(newProgramColumnMap.startDate);
      const axis = getVal(newProgramColumnMap.axis);
      const description = getVal(newProgramColumnMap.description);

      if (!title && !codeRaw) {
        return;
      }

      if (!codeRaw) {
        codeRaw = generateNextCode();
      }

      const matchedPrg = existingByCode.get(codeRaw) || existingByTitle.get(normalizePersianText(title));
      const isExisting = Boolean(matchedPrg);

      const section = normalizeSection(sectionRaw || matchedPrg?.section || '');
      const scope = normalizeScope(scopeRaw || matchedPrg?.scope || 'همگانی');
      const coefficient = normalizeCoefficient(coeffRaw || matchedPrg?.coefficient || 1);
      const deadline = deadlineRaw || matchedPrg?.deadline || '1403/09/30';
      const startDate = startRaw || matchedPrg?.startDate || '1403/07/01';

      parsed.push({
        rowIdx: idx + 2,
        code: codeRaw,
        title: title || matchedPrg?.title || 'طرح بدون عنوان',
        section,
        scope,
        coefficient,
        deadline,
        startDate,
        axis: axis || matchedPrg?.axis || section,
        description: description || matchedPrg?.description || '',
        isExisting,
        matchedProgramId: matchedPrg?.id,
        isValid: Boolean(title),
      });
    });

    setParsedNewProgramRows(parsed);
    setIsProcessing(false);
  };

  const handleCommitNewProgramsImport = () => {
    if (parsedNewProgramRows.length === 0) return;
    const validRows = parsedNewProgramRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setFormErrorMessage('هیچ ردیفی با عنوان معتبر جهت ثبت طرح یافت نشد.');
      return;
    }

    let updatedPrograms = [...db.programs];
    let createdCount = 0;
    let updatedCount = 0;
    const newlyCreatedPrograms: Program[] = [];

    validRows.forEach((row) => {
      if (row.isExisting && row.matchedProgramId && overwriteExistingPrograms) {
        const prgIdx = updatedPrograms.findIndex((p) => p.id === row.matchedProgramId);
        if (prgIdx !== -1) {
          const current = updatedPrograms[prgIdx];
          updatedPrograms[prgIdx] = {
            ...current,
            code: row.code || current.code,
            title: row.title || current.title,
            section: row.section || current.section,
            scope: row.scope || current.scope,
            coefficient: row.coefficient || current.coefficient,
            deadline: row.deadline || current.deadline,
            startDate: row.startDate || current.startDate,
            axis: row.axis || current.axis,
            description: row.description || current.description,
          };
          updatedCount++;
        }
      } else if (!row.isExisting) {
        const newPrg: Program = {
          id: `prg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          code: row.code,
          title: row.title,
          section: row.section,
          scope: row.scope,
          coefficient: row.coefficient,
          deadline: row.deadline,
          startDate: row.startDate,
          axis: row.axis,
          description: row.description,
          isActive: true,
          createdAt: getCurrentJalaliDate(),
        };
        updatedPrograms.push(newPrg);
        newlyCreatedPrograms.push(newPrg);
        createdCount++;
      }
    });

    // Auto-assign newly created general programs to all employees if requested
    let updatedEmployeePrograms = [...db.employeePrograms];
    let autoAssignedCount = 0;

    if (autoAssignToEmployees && newlyCreatedPrograms.length > 0) {
      const generalNewPrograms = newlyCreatedPrograms.filter((p) => p.scope === 'همگانی');

      generalNewPrograms.forEach((prg) => {
        db.employees.forEach((emp) => {
          const alreadyAssigned = updatedEmployeePrograms.some(
            (ep) => ep.employeeId === emp.id && ep.programId === prg.id,
          );
          if (!alreadyAssigned) {
            updatedEmployeePrograms.push({
              id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              employeeId: emp.id,
              employeeCode: emp.code,
              programId: prg.id,
              status: 'not_done',
              isManualOverride: false,
              updatedAt: getCurrentJalaliDate(),
            });
            autoAssignedCount++;
          }
        });
      });
    }

    onUpdateDatabase({
      ...db,
      programs: updatedPrograms,
      employeePrograms: updatedEmployeePrograms,
    });

    setExecutionResult({
      success: true,
      title: 'ورود گروهی طرح‌ها و برنامه‌ها با موفقیت انجام شد',
      message: `${toPersianDigits(createdCount)} طرح جدید ثبت شد و ${toPersianDigits(updatedCount)} طرح موجود به‌روزرسانی گردید.`,
      details: {
        'طرح‌های جدید اضافه شده': createdCount,
        'طرح‌های به‌روزرسانی‌شده': updatedCount,
        'تخصیص‌های خودکار ایجاد شده برای همکاران': autoAssignedCount,
        'مجموع طرح‌های ۵ حوزه سامانه': updatedPrograms.length,
      },
    });

    setParsedNewProgramRows([]);
  };

  // ==========================================
  // DOWNLOAD TEMPLATES (RELIABLE SAFE DOWNLOADS)
  // ==========================================

  // 1. Template for Employees
  const handleDownloadEmployeeSampleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      const sampleHeaders = [
        'کد ملی',
        'کد پرسنلی',
        'نام و نام خانوادگی',
        'نام آموزشگاه',
        'مقطع تحصیلی',
        'سمت سازمانی',
        'سابقه خدمت (سال)',
        'شماره تماس',
        'توضیحات و سوابق',
      ];

      const sampleData = [
        sampleHeaders,
        [
          '1289456123',
          '201001',
          'حسین صادقی',
          'دبیرستان شهید بهشتی',
          'متوسطه اول',
          'معاون پرورشی',
          '15',
          '09131112233',
          'همکار با سابقه، مسئول برگزاری مسابقات',
        ],
        [
          '1287349102',
          '201002',
          'زهره کریمی',
          'دبیرستان فرزانگان',
          'متوسطه دوم نظری',
          'معاون پرورشی',
          '12',
          '09132223344',
          'پیگیر و منظم در ارسال گزارش‌ها',
        ],
        [
          '1290123456',
          '201003',
          'رضا مرادی',
          'دبستان انقلاب اسلامی',
          'ابتدایی دوره دوم',
          'آموزگار',
          '8',
          '09133334455',
          'آموزگار توانمند پایه پنجم',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 16 },
        { wch: 14 },
        { wch: 24 },
        { wch: 30 },
        { wch: 22 },
        { wch: 20 },
        { wch: 18 },
        { wch: 16 },
        { wch: 35 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'مشخصات همکاران');
      const ok = safeDownloadWorkbook(wb, 'الگوی_اکسل_مشخصات_همکاران_ناحیه۶.xlsx');
      if (ok) triggerToast('فایل اکسل الگوی مشخصات همکاران با موفقیت دانلود شد.');
    } catch (err) {
      console.error(err);
      setFormErrorMessage('خطا در دانلود الگوی اکسل همکاران.');
    }
  };

  // 2. Template for Task / Execution Status (FIXED & 100% RELIABLE!)
  const handleDownloadTaskStatusSampleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Main Status Registration Sheet
      const taskHeaders = [
        'کد اختصاصی همکار (دو رقمی)',
        'کد پرسنلی',
        'کد ملی',
        'نام و نام خانوادگی همکار',
        'نام آموزشگاه',
        'کد یا عنوان طرح',
        'وضعیت اجرا',
        'تاریخ اجرا (شمسی)',
        'بستر ارسال مستندات',
        'توضیحات و بازخورد',
      ];

      const sampleTaskRows = [
        taskHeaders,
        [
          '01',
          '201001',
          '1289456123',
          'حسین صادقی',
          'دبیرستان شهید بهشتی',
          'مسابقات قرآن، عترت و نماز',
          'انجام شده',
          '1403/09/20',
          'ایتا',
          'برگزاری باشکوه مرحله آموزشگاهی با ۸۵ نفر شرکت‌کننده',
        ],
        [
          '02',
          '201002',
          '1287349102',
          'زهره کریمی',
          'دبیرستان فرزانگان',
          'جشنواره نوجوان خوارزمی',
          'دیر انجام شده',
          '1403/10/12',
          'شاد',
          'ارسال مستندات با ۲ روز تاخیر به دلیل مشکلات سامانه',
        ],
        [
          '03',
          '201003',
          '1290123456',
          'رضا مرادی',
          'دبستان انقلاب اسلامی',
          'ارزشیابی توصیفی و خواندن و نوشتن',
          'انجام شده',
          '1403/09/25',
          'اتوماسیون',
          'ثبت کامل دفاتر ارزیابی کلاسی پایه پنجم',
        ],
        [
          '04',
          '201004',
          '1278912345',
          'الهام سعیدی',
          'هنرستان فنی دخترانه کوثر',
          'المپیاد ورزشی درون‌مدرسه‌ای',
          'انجام نشده',
          '',
          '',
          'عدم برگزاری به دلیل تعمیرات سالن ورزشی',
        ],
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(sampleTaskRows);
      ws1['!cols'] = [
        { wch: 24 },
        { wch: 14 },
        { wch: 16 },
        { wch: 22 },
        { wch: 26 },
        { wch: 32 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 45 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'ثبت وضعیت تکالیف طرح‌ها');

      // Sheet 2: Guide of Active Programs
      const programHeaders = [
        'کد طرح',
        'عنوان طرح و برنامه',
        'حوزه تخصصی',
        'نوع شمول',
        'ضریب اهمیت',
        'مهلت اجرا (شمسی)',
      ];

      const programList = [
        programHeaders,
        ...db.programs.map((p) => [
          p.code,
          p.title,
          p.section || 'پرورشی',
          p.scope || 'همگانی',
          p.coefficient || 1,
          p.deadline || '1403/09/30',
        ]),
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(programList);
      ws2['!cols'] = [
        { wch: 12 },
        { wch: 35 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'عناوین و کدهای طرح‌های سامانه');

      // Sheet 3: Valid Status Values Guide
      const statusGuide = [
        ['مقدار وضعیت در ستون', 'معادل در سامانه', 'امتیاز مکتسبه', 'توضیحات'],
        ['انجام شده', 'done', '۱۰۰ × ضریب طرح (۱۰۰، ۲۰۰ یا ۳۰۰)', 'اجرا و ارسال به‌موقع مستندات قبل از مهلت'],
        ['دیر انجام شده', 'late', '۶۰ × ضریب طرح (۶۰، ۱۲۰ یا ۱۸۰)', 'اجرا یا ارسال مستندات با تاخیر پس از مهلت'],
        ['انجام نشده', 'not_done', 'صفر امتیاز', 'عدم اجرا یا عدم ارسال مستندات طرح'],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(statusGuide);
      ws3['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'راهنمای مقادیر مجاز وضعیت');

      const ok = safeDownloadWorkbook(wb, 'الگوی_اکسل_ثبت_وضعیت_تکالیف_طرح‌ها.xlsx');
      if (ok) {
        triggerToast('فایل اکسل الگوی تکالیف با موفقیت دانلود شد.');
      }
    } catch (err) {
      console.error(err);
      setFormErrorMessage('خطا در آماده‌سازی فایل الگوی اکسل تکالیف.');
    }
  };

  // CSV Fallback Template for Task Status
  const handleDownloadTaskStatusCsvTemplate = () => {
    try {
      const csvHeaders =
        'کد اختصاصی همکار (دو رقمی),کد پرسنلی,کد ملی,نام و نام خانوادگی همکار,نام آموزشگاه,کد یا عنوان طرح,وضعیت اجرا,تاریخ اجرا (شمسی),بستر ارسال مستندات,توضیحات و بازخورد\n';
      const sampleRows = [
        '01,201001,1289456123,حسین صادقی,دبیرستان شهید بهشتی,مسابقات قرآن، عترت و نماز,انجام شده,1403/09/20,ایتا,برگزاری باشکوه مرحله آموزشگاهی با ۸۵ نفر شرکت‌کننده',
        '02,201002,1287349102,زهره کریمی,دبیرستان فرزانگان,جشنواره نوجوان خوارزمی,دیر انجام شده,1403/10/12,شاد,ارسال مستندات با ۲ روز تاخیر به دلیل مشکلات سامانه',
        '03,201003,1290123456,رضا مرادی,دبستان انقلاب اسلامی,ارزشیابی توصیفی و خواندن و نوشتن,انجام شده,1403/09/25,اتوماسیون,ثبت کامل دفاتر ارزیابی کلاسی پایه پنجم',
        '04,201004,1278912345,الهام سعیدی,هنرستان فنی دخترانه کوثر,المپیاد ورزشی درون‌مدرسه‌ای,انجام نشده,,,عدم برگزاری به دلیل تعمیرات سالن ورزشی',
      ].join('\n');

      const ok = safeDownloadCsv(csvHeaders + sampleRows, 'الگوی_اکسل_ثبت_وضعیت_تکالیف.csv');
      if (ok) triggerToast('فایل متنی CSV الگوی تکالیف دانلود شد.');
    } catch (err) {
      console.error(err);
      setFormErrorMessage('خطا در دانلود نسخه متنی CSV.');
    }
  };

  // Copy Task Template to Clipboard
  const handleCopyTaskTemplateToClipboard = () => {
    const tsvData = [
      [
        'کد اختصاصی همکار (دو رقمی)',
        'کد پرسنلی',
        'کد ملی',
        'نام و نام خانوادگی همکار',
        'نام آموزشگاه',
        'کد یا عنوان طرح',
        'وضعیت اجرا',
        'تاریخ اجرا (شمسی)',
        'بستر ارسال مستندات',
        'توضیحات و بازخورد',
      ].join('\t'),
      ['01', '201001', '1289456123', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'مسابقات قرآن، عترت و نماز', 'انجام شده', '1403/09/20', 'ایتا', 'برگزاری باشکوه'].join('\t'),
      ['02', '201002', '1287349102', 'زهره کریمی', 'دبیرستان فرزانگان', 'جشنواره نوجوان خوارزمی', 'دیر انجام شده', '1403/10/12', 'شاد', 'ارسال با تاخیر'].join('\t'),
      ['03', '201003', '1290123456', 'رضا مرادی', 'دبستان انقلاب اسلامی', 'ارزشیابی توصیفی', 'انجام شده', '1403/09/25', 'اتوماسیون', 'ثبت کامل دفاتر'].join('\t'),
    ].join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(tsvData)
        .then(() => {
          triggerToast('ساختار ستون‌های الگو کپی شد! می‌توانید در اکسل کلید Ctrl+V را بزنید.');
        })
        .catch(() => {
          triggerToast('امکان دسترسی به کلیپ‌بورد فراهم نیست؛ لطفاً فایل الگو را دانلود فرمایید.');
        });
    } else {
      triggerToast('ساختار الگو آماده دانلود است.');
    }
  };

  // 3. Template specifically for Selected Program ("ورود گروه هر طرح و برنامه")
  const handleDownloadPerProgramTemplate = (prefillColleagues = true) => {
    if (!activeProgram) return;
    try {
      const wb = XLSX.utils.book_new();

      const headers = [
        'کد همکار (دو رقمی)',
        'کد پرسنلی',
        'کد ملی',
        'نام و نام خانوادگی همکار',
        'نام آموزشگاه',
        'مقطع تحصیلی',
        'سمت سازمانی',
        'وضعیت اجرا (انجام شده / دیر انجام شده / انجام نشده)',
        'تاریخ اجرا (شمسی مثلاً 1403/09/20)',
        'بستر ارسال مستندات (ایتا / شاد / اتوماسیون / پورتال)',
        'توضیحات و بازخورد عملکرد',
      ];

      const rows: (string | number)[][] = [headers];

      if (prefillColleagues && db.employees.length > 0) {
        // Pre-fill with district colleagues
        db.employees.forEach((emp) => {
          // Look up current status if already assigned
          const existing = db.employeePrograms.find(
            (ep) => ep.employeeId === emp.id && ep.programId === activeProgram.id,
          );
          let currentStatusText = '';
          if (existing) {
            if (existing.status === 'done') currentStatusText = 'انجام شده';
            else if (existing.status === 'late') currentStatusText = 'دیر انجام شده';
            else if (existing.status === 'not_done') currentStatusText = 'انجام نشده';
          }

          rows.push([
            emp.code,
            emp.personnelCode || '',
            emp.nationalId || '',
            emp.fullName,
            emp.schoolName || '',
            emp.grade || '',
            emp.role || '',
            currentStatusText,
            existing?.executionDate || existing?.actualDate || '',
            existing?.documentationPlatform || 'ایتا',
            existing?.notes || '',
          ]);
        });
      } else {
        // Add sample row
        rows.push([
          '01',
          '201001',
          '1289456123',
          'حسین صادقی',
          'دبیرستان شهید بهشتی',
          'متوسطه اول',
          'معاون پرورشی',
          'انجام شده',
          '1403/09/20',
          'ایتا',
          'ثبت عالی و کامل مستندات طرح',
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 20 },
        { wch: 14 },
        { wch: 16 },
        { wch: 24 },
        { wch: 28 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 22 },
        { wch: 26 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, `ثبت عملکرد ${activeProgram.code}`);

      // Guide Sheet about this specific program
      const infoSheet = [
        ['مشخصه طرح', 'مقدار در سامانه'],
        ['کد طرح', activeProgram.code],
        ['عنوان طرح و برنامه', activeProgram.title],
        ['حوزه تخصصی', activeProgram.section || 'پرورشی'],
        ['نوع شمول', activeProgram.scope || 'همگانی'],
        ['ضریب اهمیت طرح', `ضریب ${activeProgram.coefficient || 1}`],
        [
          'نحوه محاسبه امتیاز',
          `انجام شده = ${toPersianDigits((activeProgram.coefficient || 1) * 100)} امتیاز | دیر = ${toPersianDigits(
            (activeProgram.coefficient || 1) * 60,
          )} امتیاز | انجام نشده = ۰`,
        ],
        ['مهلت اجرا', activeProgram.deadline || '1403/10/30'],
        ['توضیحات و دستورالعمل', activeProgram.description || 'ثبت گروهی وضعیت اجرای تکالیف برای کلیه مدارس'],
      ];
      const wsInfo = XLSX.utils.aoa_to_sheet(infoSheet);
      wsInfo['!cols'] = [{ wch: 24 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, 'شناسنامه طرح');

      const safeName = `الگوی_گروهی_${activeProgram.code}_${activeProgram.title.substring(0, 20)}.xlsx`.replace(
        /[\\/:*?"<>|]/g,
        '_',
      );
      const ok = safeDownloadWorkbook(wb, safeName);
      if (ok) triggerToast(`الگوی اکسل اختصاصی برای طرح «${activeProgram.title}» با موفقیت دانلود شد.`);
    } catch (err) {
      console.error(err);
      setFormErrorMessage('خطا در دانلود الگوی اکسل اختصاصی این طرح.');
    }
  };

  // 4. Template for New Programs / Plans Definition
  const handleDownloadProgramDefinitionSampleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      const programHeaders = [
        'کد طرح',
        'عنوان طرح / برنامه',
        'حوزه تخصصی',
        'نوع شمول',
        'ضریب اهمیت',
        'مهلت اجرا (شمسی)',
        'تاریخ شروع (شمسی)',
        'محور فرعی / موضوع',
        'توضیحات و اهداف طرح',
      ];

      const samplePrograms = [
        programHeaders,
        [
          'PRG-01',
          'مسابقات قرآن، عترت و نماز دانش‌آموزی',
          'پرورشی',
          'همگانی',
          '3',
          '1403/09/15',
          '1403/07/15',
          'قرآن و عترت',
          'برگزاری مسابقات حفظ، قرائت، احکام و نهج‌البلاغه در سطوح آموزشگاهی و منطقه‌ای',
        ],
        [
          'PRG-02',
          'ارزشیابی کیفی-توصیفی و طرح ارتقای خواندن',
          'آموزش ابتدایی',
          'همگانی',
          '3',
          '1403/09/20',
          '1403/07/01',
          'آموزش ابتدایی',
          'پایش عملکرد خواندن و نوشتن دانش‌آموزان دوره ابتدایی و ثبت پوشه کار',
        ],
        [
          'PRG-03',
          'جشنواره نوآوری و نوجوان خوارزمی',
          'آموزش متوسطه اول',
          'همگانی',
          '2',
          '1403/10/10',
          '1403/08/01',
          'علمی و پژوهشی',
          'محورهای پژوهش، دست‌سازه، ادبیات و بازارچه کار و فناوری دانش‌آموزی',
        ],
        [
          'PRG-04',
          'آزمون‌های شبه‌نهایی و آمادگی امتحانات نهایی',
          'آموزش متوسطه دوم',
          'همگانی',
          '3',
          '1403/10/30',
          '1403/08/15',
          'آموزش متوسطه دوم',
          'برگزاری آزمون‌های شبیه‌ساز امتحان نهایی پایه‌های دهم، یازدهم و دوازدهم',
        ],
        [
          'PRG-05',
          'المپیاد ورزشی درون‌مدرسه‌ای و کانون‌های پویا',
          'تربیت بدنی',
          'همگانی',
          '2',
          '1403/09/25',
          '1403/07/20',
          'سلامت و تندرستی',
          'فعال‌سازی حیاط پویا و مسابقات ورزشی چندرشته‌ای آموزشگاه',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(samplePrograms);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 38 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 50 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'تعریف طرح‌ها و برنامه‌ها');

      const ok = safeDownloadWorkbook(wb, 'الگوی_اکسل_طرح‌ها_و_برنامه‌ها_ناحیه۶.xlsx');
      if (ok) triggerToast('فایل الگوی اکسل تعریف طرح‌ها و برنامه‌ها دانلود شد.');
    } catch (err) {
      console.error(err);
      setFormErrorMessage('خطا در دانلود الگوی اکسل طرح‌ها.');
    }
  };

  // Filtered Programs for "ورود گروه هر طرح و برنامه"
  const filteredProgramsList = db.programs.filter((p) => {
    const matchSection = perProgramSectionFilter === 'all' || p.section === perProgramSectionFilter;
    const matchSearch =
      !perProgramSearchTerm.trim() ||
      p.title.includes(perProgramSearchTerm.trim()) ||
      p.code.toLowerCase().includes(perProgramSearchTerm.trim().toLowerCase());
    return matchSection && matchSearch;
  });

  // Filtered Employees for Direct Batch Entry
  const filteredEmployeesForDirect = db.employees.filter((emp) => {
    let matchGrade = true;
    if (directGradeFilter === 'primary') matchGrade = emp.grade.includes('ابتدایی');
    else if (directGradeFilter === 'middle') matchGrade = emp.grade.includes('متوسطه اول');
    else if (directGradeFilter === 'high')
      matchGrade = emp.grade.includes('متوسطه دوم') || emp.grade.includes('هنرستان');
    else if (directGradeFilter === 'cultural')
      matchGrade = emp.role.includes('پرورشی') || emp.role.includes('مشاور');

    const matchSearch =
      !directSearchQuery.trim() ||
      emp.fullName.includes(directSearchQuery.trim()) ||
      emp.schoolName.includes(directSearchQuery.trim()) ||
      emp.code.includes(directSearchQuery.trim()) ||
      emp.personnelCode?.includes(directSearchQuery.trim());

    return matchGrade && matchSearch;
  });

  const toggleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployeesForDirect.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployeesForDirect.map((e) => e.id));
    }
  };

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-16">
      {/* Toast Notification Banner */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold leading-normal">{downloadToast}</span>
          <button
            onClick={() => setDownloadToast(null)}
            className="p-1 text-emerald-300 hover:text-white cursor-pointer mr-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Main Header Card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
              📊 {db.settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}
            </span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              مرکز ورود هوشمند و گروهی داده‌ها از Excel
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-600" />
            <span>ورود گروهی اطلاعات از اکسل (همکاران، تکالیف و هر طرح و برنامه)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            امکان بارگذاری گروهی پرونده همکاران، ثبت دسته‌جمعی تکالیف، و اضافه کردن گروهی عملکرد بر اساس هر طرح و برنامه با الگوهای استاندارد.
          </p>
        </div>

        {/* Dynamic Download Template Button depending on Active Mode */}
        {activeImportTarget === 'employees' && (
          <button
            onClick={handleDownloadEmployeeSampleTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>دانلود الگوی اکسل مشخصات همکاران</span>
          </button>
        )}

        {activeImportTarget === 'tasks' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTaskStatusSampleTemplate}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-200" />
              <span>دانلود الگوی اکسل تکالیف طرح‌ها</span>
            </button>
            <button
              onClick={() => setShowTaskTemplateModal(true)}
              className="p-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl border border-blue-200 cursor-pointer"
              title="پیش‌نمایش ستون‌های الگو"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeImportTarget === 'per_program' && activeProgram && (
          <button
            onClick={() => handleDownloadPerProgramTemplate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-purple-200" />
            <span>دانلود الگوی اکسل اختصاصی این طرح</span>
          </button>
        )}

        {activeImportTarget === 'programs' && (
          <button
            onClick={handleDownloadProgramDefinitionSampleTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-200" />
            <span>دانلود الگوی اکسل طرح‌ها و برنامه‌ها</span>
          </button>
        )}
      </div>

      {/* 4 Main Mode Switcher Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('employees');
            setExecutionResult(null);
            setFormErrorMessage(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeImportTarget === 'employees'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>۱. بارگذاری همکاران</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('tasks');
            setExecutionResult(null);
            setFormErrorMessage(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeImportTarget === 'tasks'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4 shrink-0" />
          <span>۲. ثبت گروهی وضعیت تکالیف</span>
        </button>

        {/* NEW REQUESTED MODE: ورود گروه هر طرح و برنامه */}
        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('per_program');
            setExecutionResult(null);
            setFormErrorMessage(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
            activeImportTarget === 'per_program'
              ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-md'
              : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
          }`}
        >
          <Target className="w-4 h-4 shrink-0 text-amber-300" />
          <span>۳. ورود گروه هر طرح و برنامه</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 left-2 animate-ping" />
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('programs');
            setExecutionResult(null);
            setFormErrorMessage(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeImportTarget === 'programs'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BookPlus className="w-4 h-4 shrink-0" />
          <span>۴. ورود گروهی کلیه طرح‌ها</span>
        </button>
      </div>

      {/* Execution Result Banner */}
      {executionResult && (
        <div className="p-6 bg-emerald-50 border-2 border-emerald-400 rounded-3xl shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-emerald-950">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-black text-base">{executionResult.title}</h3>
                <p className="text-xs text-emerald-800 mt-0.5">{executionResult.message}</p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => {
                  if (activeImportTarget === 'employees') onNavigateToTab('employees');
                  else if (activeImportTarget === 'tasks' || activeImportTarget === 'per_program')
                    onNavigateToTab('ranking');
                  else if (activeImportTarget === 'programs') onNavigateToTab('programs');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>
                  {activeImportTarget === 'employees'
                    ? 'مشاهده همکاران ↵'
                    : activeImportTarget === 'programs'
                    ? 'مشاهده لیست طرح‌ها ↵'
                    : 'مشاهده تابلوی رتبه‌بندی ↵'}
                </span>
              </button>
            )}
          </div>

          {executionResult.details && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-xs">
              {Object.entries(executionResult.details).map(([k, v]) => (
                <div key={k} className="p-2.5 bg-white rounded-xl border border-emerald-200">
                  <span className="text-[11px] text-slate-500 block">{k}:</span>
                  <strong className="text-slate-800 font-mono text-sm">{toPersianDigits(v)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {formErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{formErrorMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2 FIX: TASK STATUS EXCEL TEMPLATE CARD (PROMINENT!) */}
      {/* ======================================================== */}
      {activeImportTarget === 'tasks' && (
        <div className="bg-gradient-to-r from-blue-50/90 via-sky-50/80 to-indigo-50/90 border-2 border-blue-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-800 text-base sm:text-lg">
                    الگوی استاندارد اکسل تکالیف و ثبت عملکرد
                  </h3>
                  <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                    فرمت رسمی
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                  فایل الگو شامل ۱۰ ستون (کد همکار، پرسنلی، کد ملی، نام، آموزشگاه، کد یا عنوان طرح، وضعیت اجرا، تاریخ، بستر و توضیحات) و کاربرگ‌های راهنمای طرح‌ها و مقادیر مجاز وضعیت است.
                </p>
              </div>
            </div>

            {/* Template Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTaskStatusSampleTemplate}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer group"
              >
                <Download className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" />
                <span>دریافت فایل اکسل الگو (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTaskStatusCsvTemplate}
                className="flex items-center gap-1.5 px-3.5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="دانلود نسخه کم‌حجم متنی CSV"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>نسخه CSV</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTaskTemplateToClipboard}
                className="flex items-center gap-1.5 px-3.5 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                title="کپی مستقیم ساختار جدول در حافظه جهت چسباندن در اکسل"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>کپی در کلیپ‌بورد</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTaskTemplateModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-3 bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                <Eye className="w-4 h-4 text-sky-700" />
                <span>پیش‌نمایش ستون‌ها</span>
              </button>
            </div>
          </div>

          {/* Quick Guide Strip inside Task Template Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-blue-200 text-xs">
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>انجام شده (کامل)</span>
              </div>
              <p className="text-[11px] text-slate-500">
                در ستون وضعیت بنویسید «انجام شده». امتیاز: ۱۰۰ × ضریب طرح ({toPersianDigits(100)}، {toPersianDigits(200)} یا {toPersianDigits(300)} امتیاز)
              </p>
            </div>

            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-amber-700 font-bold mb-1">
                <Clock className="w-4 h-4" />
                <span>دیر انجام شده (تاخیر)</span>
              </div>
              <p className="text-[11px] text-slate-500">
                در ستون وضعیت بنویسید «دیر انجام شده». امتیاز: ۶۰ × ضریب طرح ({toPersianDigits(60)}، {toPersianDigits(120)} یا {toPersianDigits(180)} امتیاز)
              </p>
            </div>

            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>انجام نشده</span>
              </div>
              <p className="text-[11px] text-slate-500">
                در ستون وضعیت بنویسید «انجام نشده» یا خالی بگذارید. امتیاز این تکلیف صفر منظور می‌گردد.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: NEW REQUESTED SECTION -> ورود گروه هر طرح و برنامه */}
      {/* ======================================================== */}
      {activeImportTarget === 'per_program' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Card for Per-Program Selection */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-purple-200 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Target className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 text-base sm:text-lg">
                      ورود گروه هر طرح و برنامه (اضافه کردن گروهی هر طرح)
                    </h3>
                    <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                      طرح اختصاصی
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    یک طرح و برنامه را انتخاب نمایید؛ سپس می‌توانید با الگوی اکسل اختصاصی همان طرح یا بصورت مستقیم در سامانه، عملکرد کلیه مدارس و همکاران را برای این طرح بصورت گروهی ثبت فرمایید.
                  </p>
                </div>
              </div>

              {/* Quick Tab Switcher inside Per-Program Mode */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => setPerProgramMode('excel')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    perProgramMode === 'excel'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>ورود گروهی با اکسل اختصاصی</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPerProgramMode('direct')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    perProgramMode === 'direct'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>ثبت گروهی مستقیم در سامانه</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPerProgramMode('quick_add')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    perProgramMode === 'quick_add'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تعریف طرح جدید</span>
                </button>
              </div>
            </div>

            {/* Quick Add Program Form (if active) */}
            {perProgramMode === 'quick_add' && (
              <form onSubmit={handleCreateQuickProgram} className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-purple-950 text-sm flex items-center gap-2">
                    <BookPlus className="w-4 h-4 text-purple-700" />
                    <span>تعریف سریع طرح و برنامه جدید و انتخاب فوری برای ورود گروهی</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setPerProgramMode('excel')}
                    className="text-xs text-purple-700 hover:underline cursor-pointer"
                  >
                    انصراف و بازگشت
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-slate-700 block">عنوان طرح / برنامه: *</label>
                    <input
                      type="text"
                      value={quickProgramTitle}
                      onChange={(e) => setQuickProgramTitle(e.target.value)}
                      placeholder="مثلاً: مسابقات سرود و هنرهای آوایی"
                      className="w-full p-2.5 bg-white border border-purple-300 rounded-xl font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">کد طرح (اختیاری):</label>
                    <input
                      type="text"
                      value={quickProgramCode}
                      onChange={(e) => setQuickProgramCode(e.target.value)}
                      placeholder={`PRG-${String(db.programs.length + 1).padStart(2, '0')}`}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">حوزه تخصصی (از ۵ حوزه):</label>
                    <select
                      value={quickProgramSection}
                      onChange={(e) => setQuickProgramSection(e.target.value as ProgramSection)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
                    >
                      {PROGRAM_SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">ضریب اهمیت (وزن طرح):</label>
                    <select
                      value={quickProgramCoefficient}
                      onChange={(e) => setQuickProgramCoefficient(Number(e.target.value) as ProgramCoefficient)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
                    >
                      <option value={1}>ضریب ۱ (عادی - ۱۰۰ امتیاز)</option>
                      <option value={2}>ضریب ۲ (مهم - ۲۰۰ امتیاز)</option>
                      <option value={3}>ضریب ۳ (ویژه - ۳۰۰ امتیاز)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">نوع شمول:</label>
                    <select
                      value={quickProgramScope}
                      onChange={(e) => setQuickProgramScope(e.target.value as ProgramScope)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                    >
                      <option value="همگانی">همگانی (شامل کلیه مدارس)</option>
                      <option value="اختصاصی">اختصاصی (شامل مدارس منتخب)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">مهلت اجرا (شمسی):</label>
                    <input
                      type="text"
                      value={quickProgramDeadline}
                      onChange={(e) => setQuickProgramDeadline(e.target.value)}
                      placeholder="1403/10/30"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center font-bold"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-3">
                    <label className="font-bold text-slate-700 block">توضیحات و اهداف اجرایی طرح:</label>
                    <input
                      type="text"
                      value={quickProgramDescription}
                      onChange={(e) => setQuickProgramDescription(e.target.value)}
                      placeholder="توضیح کوتاه در مورد دستورالعمل و نحوه ثبت عملکرد"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>ثبت این طرح و ورود به بخش ثبت گروهی</span>
                  </button>
                </div>
              </form>
            )}

            {/* Program Selection Controls */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-purple-600" />
                  <span>انتخاب طرح هدف از ۵ حوزه تخصصی:</span>
                </span>

                {/* 5 Section Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPerProgramSectionFilter('all')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                      perProgramSectionFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    همه حوزه‌ها ({toPersianDigits(db.programs.length)})
                  </button>
                  {PROGRAM_SECTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setPerProgramSectionFilter(sec)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                        perProgramSectionFilter === sec
                          ? 'bg-purple-700 text-white'
                          : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 relative">
                  <select
                    value={selectedProgramIdForBulk}
                    onChange={(e) => {
                      setSelectedProgramIdForBulk(e.target.value);
                      setParsedPerProgramRows([]);
                      setRawHeaders([]);
                      setRawDataRows([]);
                      setFileName('');
                    }}
                    className="w-full p-3 bg-purple-50/50 border-2 border-purple-300 focus:border-purple-600 rounded-2xl font-bold text-slate-900 text-xs sm:text-sm cursor-pointer shadow-xs"
                  >
                    {filteredProgramsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.title} ({p.section || 'پرورشی'}) - ضریب {toPersianDigits(p.coefficient || 1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <input
                    type="text"
                    value={perProgramSearchTerm}
                    onChange={(e) => setPerProgramSearchTerm(e.target.value)}
                    placeholder="جستجو در عناوین طرح‌ها..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Active Selected Program Info Card */}
            {activeProgram && (
              <div className="bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 border border-purple-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-xs px-2.5 py-0.5 bg-slate-900 text-white rounded-lg">
                      {activeProgram.code}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      {activeProgram.section || 'پرورشی'}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">
                      ⭐ ضریب {toPersianDigits(activeProgram.coefficient || 1)} ({toPersianDigits((activeProgram.coefficient || 1) * 100)} امتیاز به‌موقع)
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                      مهلت اجرا: {toPersianDigits(activeProgram.deadline || '1403/10/30')}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900">{activeProgram.title}</h4>
                  {activeProgram.description && (
                    <p className="text-xs text-slate-500 line-clamp-1">{activeProgram.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPerProgramTemplate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
                    title="دانلود فایل اکسل که اسامی کلیه همکاران منطقه از قبل در آن درج شده است"
                  >
                    <Download className="w-4 h-4 text-purple-200" />
                    <span>دانلود اکسل با لیست همکاران منطقه</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPerProgramTemplate(false)}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    title="دانلود فایل اکسل خام این طرح"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                    <span>الگوی خام</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SUB-SECTION A: Excel Bulk Import for this Program */}
          {perProgramMode === 'excel' && (
            <div className="space-y-6">
              {/* Upload Zone for Per-Program Excel */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <span className="w-6 h-6 rounded-full bg-purple-900 text-white flex items-center justify-center text-xs">
                      ۱
                    </span>
                    <span>
                      بارگذاری فایل اکسل تکمیل‌شده برای طرح «{activeProgram?.title}»
                    </span>
                  </div>

                  {fileName && (
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                      فایل انتخابی: {fileName}
                    </span>
                  )}
                </div>

                <div
                  onClick={() => perProgramFileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-200 hover:border-purple-600 hover:bg-purple-50/20 rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer group"
                >
                  <input
                    type="file"
                    ref={perProgramFileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />

                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm mb-1">
                    فایل اکسل پر شده این طرح را اینجا کلیک کرده یا بکشید و رها کنید
                  </h4>
                  <p className="text-xs text-slate-400">
                    شامل ستون‌های کد همکار (یا پرسنلی/کد ملی/نام)، وضعیت اجرا (انجام شده/دیر/انجام نشده)، تاریخ و توضیحات
                  </p>
                </div>
              </div>

              {/* Column Mapping for Per-Program Excel */}
              {rawHeaders.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs">
                        ۲
                      </span>
                      <span>تطبیق ستون‌های فایل اکسل با اطلاعات طرح «{activeProgram?.title}»</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPerProgramColumnMap(autoDetectPerProgramColumns(rawHeaders))}
                      className="flex items-center gap-1 text-xs text-purple-700 font-bold hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تشخیص مجدد ستون‌ها</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {/* Employee Identifier */}
                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1">
                      <label className="font-bold text-purple-950 block">کد همکار / پرسنلی / کد ملی: *</label>
                      <select
                        value={perProgramColumnMap.employeeCode || perProgramColumnMap.personnelCode}
                        onChange={(e) =>
                          setPerProgramColumnMap({
                            ...perProgramColumnMap,
                            employeeCode: e.target.value,
                            personnelCode: e.target.value,
                          })
                        }
                        className="w-full p-2 bg-white border border-purple-300 rounded-lg font-bold"
                      >
                        <option value="">-- انتخاب ستون --</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Full Name */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <label className="font-bold text-slate-700 block">نام همکار (جهت تطبیق نام):</label>
                      <select
                        value={perProgramColumnMap.fullName}
                        onChange={(e) =>
                          setPerProgramColumnMap({ ...perProgramColumnMap, fullName: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="">-- انتخاب ستون --</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                      <label className="font-bold text-emerald-950 block">ستون وضعیت اجرا: *</label>
                      <select
                        value={perProgramColumnMap.status}
                        onChange={(e) =>
                          setPerProgramColumnMap({ ...perProgramColumnMap, status: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800"
                      >
                        <option value="">-- انتخاب ستون --</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <label className="font-bold text-slate-700 block">تاریخ اجرا (شمسی):</label>
                      <select
                        value={perProgramColumnMap.date}
                        onChange={(e) =>
                          setPerProgramColumnMap({ ...perProgramColumnMap, date: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- انتخاب ستون (اختیاری) --</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={analyzePerProgramImport}
                      className="flex items-center gap-2 px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      <span>تحلیل فایل و پیش‌نمایش عملکرد این طرح</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Table for Per-Program Rows */}
              {parsedPerProgramRows.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs">
                        ۳
                      </span>
                      <span>
                        پیش‌نمایش وضعیت عملکرد طرح «{activeProgram?.title}» ({toPersianDigits(parsedPerProgramRows.length)} رکورد)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCommitPerProgramExcelImport}
                      className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>تایید و ثبت نهایی این طرح در پرونده همکاران</span>
                    </button>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                      <span className="text-slate-500 block mb-1">همکاران تطبیق‌یافته:</span>
                      <strong className="text-slate-900 font-mono text-base">
                        {toPersianDigits(parsedPerProgramRows.filter((r) => r.isValid).length)} نفر
                      </strong>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <span className="text-emerald-800 block mb-1">انجام شده (کامل):</span>
                      <strong className="text-emerald-700 font-mono text-base">
                        {toPersianDigits(parsedPerProgramRows.filter((r) => r.resolvedStatus === 'done').length)} نفر
                      </strong>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                      <span className="text-amber-800 block mb-1">دیر انجام شده (تاخیر):</span>
                      <strong className="text-amber-700 font-mono text-base">
                        {toPersianDigits(parsedPerProgramRows.filter((r) => r.resolvedStatus === 'late').length)} نفر
                      </strong>
                    </div>

                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                      <span className="text-rose-800 block mb-1">انجام نشده:</span>
                      <strong className="text-rose-700 font-mono text-base">
                        {toPersianDigits(parsedPerProgramRows.filter((r) => r.resolvedStatus === 'not_done').length)} نفر
                      </strong>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 text-center w-12">#</th>
                          <th className="p-2.5">همکار تطبیق داده شده</th>
                          <th className="p-2.5">آموزشگاه</th>
                          <th className="p-2.5 text-center">وضعیت تشخیص داده شده</th>
                          <th className="p-2.5 text-center">تاریخ اجرا</th>
                          <th className="p-2.5">توضیحات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedPerProgramRows.map((r, idx) => (
                          <tr key={r.rowIdx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 text-center text-slate-400 font-mono font-bold">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="p-2.5">
                              {r.matchedEmployee ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px]">
                                    {r.matchedEmployee.code}
                                  </span>
                                  <strong className="text-slate-900">{r.matchedEmployee.fullName}</strong>
                                </div>
                              ) : (
                                <span className="text-rose-600 font-bold">نامشخص ({r.rawIdentifier})</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600">{r.schoolName}</td>
                            <td className="p-2.5 text-center">
                              {r.resolvedStatus === 'done' ? (
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                                  انجام شده (کامل)
                                </span>
                              ) : r.resolvedStatus === 'late' ? (
                                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px]">
                                  دیر انجام شده
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px]">
                                  انجام نشده
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-600">
                              {toPersianDigits(r.executionDate)}
                            </td>
                            <td className="p-2.5 text-slate-500">{r.notes || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      با تایید این بخش، عملکرد کلیه همکاران فوق برای این طرح در پایگاه داده ثبت و در رتبه‌بندی محاسبه خواهد شد.
                    </span>
                    <button
                      type="button"
                      onClick={handleCommitPerProgramExcelImport}
                      className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>تایید و ذخیره در پرونده‌ها</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-SECTION B: Direct Quick In-App Batch Entry for this Program */}
          {perProgramMode === 'direct' && (
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4">
                <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span>ثبت گروهی مستقیم وضعیت برای طرح «{activeProgram?.title}» (بدون نیاز به فایل اکسل)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  می‌توانید گروهی از همکاران یا کل مدارس را انتخاب کرده، وضعیت اجرا را تعیین و با یک کلیک برای همه آنها ذخیره نمایید.
                </p>
              </div>

              {/* Bulk Setting Bar */}
              <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-purple-950 block">وضعیت اجرای دسته‌جمعی: *</label>
                  <select
                    value={bulkStatusToApply}
                    onChange={(e) => setBulkStatusToApply(e.target.value as ExecutionStatus)}
                    className="w-full p-2.5 bg-white border border-purple-300 rounded-xl font-bold text-slate-800"
                  >
                    <option value="done">✅ انجام شده (امتیاز کامل ۱۰۰ × ضریب)</option>
                    <option value="late">⏳ دیر انجام شده (۶۰٪ امتیاز)</option>
                    <option value="not_done">❌ انجام نشده (صفر امتیاز)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">تاریخ اجرای رسمی (شمسی):</label>
                  <input
                    type="text"
                    value={bulkDateToApply}
                    onChange={(e) => setBulkDateToApply(e.target.value)}
                    placeholder="1403/09/20"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">بستر ارسال مستندات:</label>
                  <select
                    value={bulkPlatformToApply}
                    onChange={(e) => setBulkPlatformToApply(e.target.value as DocumentationPlatform)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="ایتا">ایتا</option>
                    <option value="شاد">شاد</option>
                    <option value="اتوماسیون">اتوماسیون اداری</option>
                    <option value="پورتال">پورتال منطقه</option>
                    <option value="حضوری">تحویل حضوری</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">یادداشت / توضیحات همگانی:</label>
                  <input
                    type="text"
                    value={bulkNotesToApply}
                    onChange={(e) => setBulkNotesToApply(e.target.value)}
                    placeholder="توضیح کوتاه عملکرد"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Fast Audience Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 font-bold">
                  <span className="text-slate-400 pl-1">فیلتر جامعه هدف:</span>
                  <button
                    type="button"
                    onClick={() => setDirectGradeFilter('all')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      directGradeFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    همه همکاران ({toPersianDigits(db.employees.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectGradeFilter('primary')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      directGradeFilter === 'primary'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    ابتدایی
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectGradeFilter('middle')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      directGradeFilter === 'middle'
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    متوسطه اول
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectGradeFilter('high')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      directGradeFilter === 'high'
                        ? 'bg-indigo-700 text-white'
                        : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    متوسطه دوم و هنرستان
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectGradeFilter('cultural')}
                    className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      directGradeFilter === 'cultural'
                        ? 'bg-purple-700 text-white'
                        : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    معاونان و مربیان پرورشی
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={directSearchQuery}
                    onChange={(e) => setDirectSearchQuery(e.target.value)}
                    placeholder="جستجوی همکار یا مدرسه..."
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-56 font-bold"
                  />
                  <button
                    type="button"
                    onClick={toggleSelectAllEmployees}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    {selectedEmployeeIds.length === filteredEmployeesForDirect.length ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                        <span>لغو انتخاب همه</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 text-slate-400" />
                        <span>انتخاب همه ({toPersianDigits(filteredEmployeesForDirect.length)})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Employee Selection Table with Status Override */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center w-12">
                        <input
                          type="checkbox"
                          checked={
                            filteredEmployeesForDirect.length > 0 &&
                            selectedEmployeeIds.length === filteredEmployeesForDirect.length
                          }
                          onChange={toggleSelectAllEmployees}
                          className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                        />
                      </th>
                      <th className="p-2.5 text-center w-16">کد</th>
                      <th className="p-2.5">نام و نام خانوادگی</th>
                      <th className="p-2.5">آموزشگاه محل خدمت</th>
                      <th className="p-2.5">مقطع و سمت</th>
                      <th className="p-2.5 text-center">وضعیت فعلی این طرح</th>
                      <th className="p-2.5 text-center w-36">وضعیت جدید ثبتی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredEmployeesForDirect.map((emp) => {
                      const isSelected = selectedEmployeeIds.includes(emp.id);
                      const existingAssignment = db.employeePrograms.find(
                        (ep) => ep.employeeId === emp.id && ep.programId === activeProgram?.id,
                      );
                      const currentStatus = existingAssignment?.status || 'not_done';
                      const rowStatus = individualStatuses[emp.id] || bulkStatusToApply;

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-purple-50/30' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleEmployeeSelection(emp.id)}
                              className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                            {emp.code}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">{emp.fullName}</td>
                          <td className="p-2.5 text-slate-600">{emp.schoolName}</td>
                          <td className="p-2.5 text-slate-500">
                            {emp.grade} - {emp.role}
                          </td>
                          <td className="p-2.5 text-center">
                            {currentStatus === 'done' ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                انجام شده
                              </span>
                            ) : currentStatus === 'late' ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                دیر انجام شده
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                انجام نشده
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <select
                              value={rowStatus}
                              disabled={!isSelected}
                              onChange={(e) =>
                                setIndividualStatuses({
                                  ...individualStatuses,
                                  [emp.id]: e.target.value as ExecutionStatus,
                                })
                              }
                              className={`p-1.5 rounded-lg border text-xs font-bold w-full ${
                                isSelected
                                  ? 'bg-white border-purple-300 text-purple-900'
                                  : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                            >
                              <option value="done">انجام شده</option>
                              <option value="late">دیر انجام شده</option>
                              <option value="not_done">انجام نشده</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Commit Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-700">
                  تعداد همکاران انتخاب شده جهت ثبت این طرح:{' '}
                  <strong className="text-purple-700 text-sm font-mono">
                    {toPersianDigits(selectedEmployeeIds.length)} نفر
                  </strong>{' '}
                  از مجموع {toPersianDigits(filteredEmployeesForDirect.length)} نفر
                </span>

                <button
                  type="button"
                  onClick={handleDirectBatchCommit}
                  disabled={selectedEmployeeIds.length === 0}
                  className={`flex items-center gap-2 px-7 py-3 rounded-2xl text-xs font-black shadow-md transition-all cursor-pointer ${
                    selectedEmployeeIds.length > 0
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>ثبت گروهی وضعیت این طرح برای همکاران انتخاب‌شده</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: EMPLOYEES IMPORT MAPPING & PREVIEW */}
      {/* ======================================================== */}
      {activeImportTarget === 'employees' && rawHeaders.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                ۲
              </span>
              <span>تطبیق ستون‌های فایل اکسل همکاران با مشخصات سامانه</span>
            </div>
            <button
              onClick={() => setEmployeeColumnMap(autoDetectEmployeeColumns(rawHeaders))}
              className="flex items-center gap-1 text-xs text-teal-700 font-bold hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تشخیص مجدد خودکار</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            {/* National ID */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <label className="font-bold text-emerald-950 block">کد ملی همکار (۱۰ رقمی): *</label>
              <select
                value={employeeColumnMap.nationalId}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, nationalId: e.target.value })}
                className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Personnel Code */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <label className="font-bold text-emerald-950 block">کد پرسنلی / استخدامی: *</label>
              <select
                value={employeeColumnMap.personnelCode}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, personnelCode: e.target.value })}
                className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Full Name */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <label className="font-bold text-emerald-950 block">نام و نام خانوادگی: *</label>
              <select
                value={employeeColumnMap.fullName}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, fullName: e.target.value })}
                className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* School Name */}
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
              <label className="font-bold text-blue-950 block">نام آموزشگاه محل خدمت: *</label>
              <select
                value={employeeColumnMap.schoolName}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, schoolName: e.target.value })}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Educational Grade */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">مقطع تحصیلی: *</label>
              <select
                value={employeeColumnMap.grade}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, grade: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Staff Role */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">سمت سازمانی: *</label>
              <select
                value={employeeColumnMap.role}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, role: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Experience Years */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
              <label className="font-bold text-amber-950 block">سابقه خدمت (سنوات به سال): *</label>
              <select
                value={employeeColumnMap.experienceYears}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, experienceYears: e.target.value })}
                className="w-full p-2 bg-white border border-amber-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">شماره تماس (اختیاری):</label>
              <select
                value={employeeColumnMap.phone}
                onChange={(e) => setEmployeeColumnMap({ ...employeeColumnMap, phone: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium"
              >
                <option value="">-- بدون ستون شماره تماس --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={overwriteExistingEmployees}
                onChange={(e) => setOverwriteExistingEmployees(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
              />
              <span>به‌روزرسانی مشخصات همکاران در صورت وجود کد ملی یا پرسنلی مشابه در سامانه</span>
            </label>

            <button
              onClick={analyzeEmployeeImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>تحلیل فایل و پیش‌نمایش همکاران</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Table for Employees */}
      {activeImportTarget === 'employees' && parsedEmployeeRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                ۳
              </span>
              <span>پیش‌نمایش همکاران استخراج‌شده ({toPersianDigits(parsedEmployeeRows.length)} نفر)</span>
            </div>

            <button
              onClick={handleCommitEmployeeImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ثبت نهایی همکاران در سامانه</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5 text-center w-20">کد اختصاصی</th>
                  <th className="p-2.5">نام و نام خانوادگی</th>
                  <th className="p-2.5">کد ملی</th>
                  <th className="p-2.5">کد پرسنلی</th>
                  <th className="p-2.5">آموزشگاه</th>
                  <th className="p-2.5">مقطع</th>
                  <th className="p-2.5">سمت</th>
                  <th className="p-2.5 text-center">سابقه</th>
                  <th className="p-2.5 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedEmployeeRows.map((r, idx) => (
                  <tr key={r.rowIdx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 text-center text-slate-400 font-mono font-bold">{toPersianDigits(idx + 1)}</td>
                    <td className="p-2.5 text-center">
                      <span className="font-mono font-bold px-2 py-0.5 bg-slate-900 text-white rounded text-[11px]">
                        {r.assignedCode}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{r.fullName}</td>
                    <td className="p-2.5 font-mono text-slate-600">{toPersianDigits(r.nationalId)}</td>
                    <td className="p-2.5 font-mono text-slate-600">{toPersianDigits(r.personnelCode)}</td>
                    <td className="p-2.5">
                      <span className="text-slate-800 font-medium">{r.schoolName}</span>
                      {r.willCreateSchool && (
                        <span className="mr-1.5 px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[9px] rounded font-bold">
                          +مدرسه جدید
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-600">{r.grade}</td>
                    <td className="p-2.5 text-emerald-800 font-bold">{r.role}</td>
                    <td className="p-2.5 text-center font-bold text-amber-800 font-mono">
                      {r.experienceYears !== '' ? `${toPersianDigits(r.experienceYears)} سال` : '---'}
                    </td>
                    <td className="p-2.5 text-center">
                      {r.isExisting ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                          به‌روزرسانی
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                          همکار جدید
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: TASK STATUSES BULK IMPORT MAPPING & PREVIEW */}
      {/* ======================================================== */}
      {activeImportTarget === 'tasks' && rawHeaders.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs">
                ۲
              </span>
              <span>تطبیق ستون‌های فایل عملکرد و وضعیت اجرای تکالیف</span>
            </div>
            <button
              onClick={() => setTaskColumnMap(autoDetectTaskColumns(rawHeaders))}
              className="flex items-center gap-1 text-xs text-blue-700 font-bold hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تشخیص مجدد خودکار</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Target Program Selector */}
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1 sm:col-span-2">
              <label className="font-bold text-blue-950 block">
                انتخاب طرح هدف (یا خواندن از ستون اکسل):
              </label>
              <select
                value={targetProgramId}
                onChange={(e) => setTargetProgramId(e.target.value)}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg font-bold text-slate-800"
              >
                <option value="use_file_column">-- خواندن کد یا عنوان طرح از ستون فایل اکسل --</option>
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} ({p.section || 'پرورشی'}) - ضریب {toPersianDigits(p.coefficient || 1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Program Column (if using file column) */}
            {targetProgramId === 'use_file_column' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700 block">ستون کد یا عنوان طرح در اکسل: *</label>
                <select
                  value={taskColumnMap.programCodeOrTitle}
                  onChange={(e) => setTaskColumnMap({ ...taskColumnMap, programCodeOrTitle: e.target.value })}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="">-- انتخاب ستون طرح --</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Employee Identifier */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">کد همکار / کد پرسنلی:</label>
              <select
                value={taskColumnMap.employeeCode || taskColumnMap.personnelCode}
                onChange={(e) =>
                  setTaskColumnMap({ ...taskColumnMap, employeeCode: e.target.value, personnelCode: e.target.value })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Full Name */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">نام همکار (جهت تطبیق نام):</label>
              <select
                value={taskColumnMap.fullName}
                onChange={(e) => setTaskColumnMap({ ...taskColumnMap, fullName: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
              <label className="font-bold text-emerald-950 block">ستون وضعیت اجرا: *</label>
              <select
                value={taskColumnMap.status}
                onChange={(e) => setTaskColumnMap({ ...taskColumnMap, status: e.target.value })}
                className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Execution Date */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">تاریخ اجرا (شمسی):</label>
              <select
                value={taskColumnMap.date}
                onChange={(e) => setTaskColumnMap({ ...taskColumnMap, date: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- انتخاب ستون (اختیاری) --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={analyzeTaskStatusImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>تحلیل فایل و پیش‌نمایش وضعیت تکالیف</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Table for Task Statuses */}
      {activeImportTarget === 'tasks' && parsedTaskRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs">
                ۳
              </span>
              <span>پیش‌نمایش وضعیت تکالیف استخراج‌شده ({toPersianDigits(parsedTaskRows.length)} رکورد)</span>
            </div>

            <button
              onClick={handleCommitTaskStatusImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ثبت نهایی وضعیت تکالیف در پرونده‌ها</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5">همکار تطبیق داده شده</th>
                  <th className="p-2.5">آموزشگاه</th>
                  <th className="p-2.5">طرح و حوزه</th>
                  <th className="p-2.5 text-center">وضعیت تشخیص داده شده</th>
                  <th className="p-2.5 text-center">تاریخ اجرا</th>
                  <th className="p-2.5">توضیحات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedTaskRows.map((r, idx) => (
                  <tr key={r.rowIdx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 text-center text-slate-400 font-mono font-bold">{toPersianDigits(idx + 1)}</td>
                    <td className="p-2.5">
                      {r.matchedEmployee ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-900 text-white rounded text-[10px]">
                            {r.matchedEmployee.code}
                          </span>
                          <strong className="text-slate-900">{r.matchedEmployee.fullName}</strong>
                        </div>
                      ) : (
                        <span className="text-rose-600 font-bold">نامشخص ({r.rawIdentifier})</span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-600">{r.matchedEmployee?.schoolName || '---'}</td>
                    <td className="p-2.5">
                      {r.matchedProgram ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded font-bold text-[10px]">
                            {r.matchedProgram.section || 'پرورشی'}
                          </span>
                          <span className="font-bold text-slate-800">{r.matchedProgram.title}</span>
                        </div>
                      ) : (
                        <span className="text-rose-600">{r.programTitleOrCode}</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      {r.resolvedStatus === 'done' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                          انجام شده
                        </span>
                      ) : r.resolvedStatus === 'late' ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px]">
                          دیر انجام شده
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px]">
                          انجام نشده
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">{toPersianDigits(r.executionDate)}</td>
                    <td className="p-2.5 text-slate-500">{r.notes || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Zone (Only visible for modes: employees, tasks, programs) */}
      {activeImportTarget !== 'per_program' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                ۱
              </span>
              <span>
                {activeImportTarget === 'employees'
                  ? 'بارگذاری فایل اکسل مشخصات همکاران'
                  : activeImportTarget === 'tasks'
                  ? 'بارگذاری فایل اکسل وضعیت اجرای تکالیف'
                  : 'بارگذاری فایل اکسل تعریف کلیه طرح‌ها و برنامه‌ها'}
              </span>
            </div>

            {fileName && (
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                فایل انتخاب شده: {fileName}
              </span>
            )}
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" />
            </div>

            <h4 className="font-bold text-slate-800 text-sm mb-1">
              فایل اکسل (.xlsx یا .xls) را اینجا کلیک کرده یا بکشید و رها کنید
            </h4>
            <p className="text-xs text-slate-400">
              {activeImportTarget === 'employees'
                ? 'شامل ستون‌های کد ملی، پرسنلی، نام و نام خانوادگی، آموزشگاه، مقطع، سمت و سابقه'
                : activeImportTarget === 'tasks'
                ? 'شامل ستون‌های کد همکار/پرسنلی، عنوان طرح، وضعیت (انجام شده/دیر/انجام نشده) و تاریخ'
                : 'شامل ستون‌های کد طرح، عنوان طرح، حوزه تخصصی (۵ حوزه)، ضریب (۱ تا ۳)، شمول و مهلت اجرا'}
            </p>
          </div>

          {sheetNames.length > 1 && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              <Layers className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-700">انتخاب کاربرگ (Sheet):</span>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="p-1.5 bg-white border border-slate-300 rounded-xl font-bold"
              >
                {sheetNames.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 4: NEW PROGRAMS & PLANS BULK IMPORT */}
      {/* ======================================================== */}
      {activeImportTarget === 'programs' && rawHeaders.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs">
                ۲
              </span>
              <span>تطبیق ستون‌های فایل اکسل با مشخصات طرح‌ها و برنامه‌های ۵ حوزه</span>
            </div>
            <button
              onClick={() => setNewProgramColumnMap(autoDetectNewProgramColumns(rawHeaders))}
              className="flex items-center gap-1 text-xs text-indigo-700 font-bold hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تشخیص مجدد خودکار</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1 sm:col-span-2">
              <label className="font-bold text-indigo-950 block">عنوان طرح / برنامه: *</label>
              <select
                value={newProgramColumnMap.title}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, title: e.target.value })}
                className="w-full p-2 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون عنوان طرح --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">کد اختصاصی طرح:</label>
              <select
                value={newProgramColumnMap.code}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, code: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="">-- تولید خودکار توسط سیستم --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1">
              <label className="font-bold text-indigo-950 block">حوزه تخصصی (از ۵ بخش): *</label>
              <select
                value={newProgramColumnMap.section}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, section: e.target.value })}
                className="w-full p-2 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
              <label className="font-bold text-amber-950 block">ضریب اهمیت (۱ تا ۳): *</label>
              <select
                value={newProgramColumnMap.coefficient}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, coefficient: e.target.value })}
                className="w-full p-2 bg-white border border-amber-300 rounded-lg font-bold text-slate-800"
              >
                <option value="">-- پیش‌فرض ضریب ۱ --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">نوع شمول (همگانی/اختصاصی):</label>
              <select
                value={newProgramColumnMap.scope}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, scope: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- پیش‌فرض همگانی --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">مهلت اجرای طرح (شمسی):</label>
              <select
                value={newProgramColumnMap.deadline}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, deadline: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- پیش‌فرض ۱۴۰۳/۰۹/۳۰ --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <label className="font-bold text-slate-700 block">توضیحات و اهداف طرح:</label>
              <select
                value={newProgramColumnMap.description}
                onChange={(e) => setNewProgramColumnMap({ ...newProgramColumnMap, description: e.target.value })}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- انتخاب ستون (اختیاری) --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={overwriteExistingPrograms}
                  onChange={(e) => setOverwriteExistingPrograms(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>به‌روزرسانی طرح‌های موجود در صورت تطبیق کد یا عنوان</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={autoAssignToEmployees}
                  onChange={(e) => setAutoAssignToEmployees(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>تخصیص خودکار طرح‌های همگانی جدید به کلیه همکاران</span>
              </label>
            </div>

            <button
              onClick={analyzeNewProgramImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>تحلیل فایل و پیش‌نمایش طرح‌ها</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preview Table for New Programs */}
      {activeImportTarget === 'programs' && parsedNewProgramRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center text-xs">
                ۳
              </span>
              <span>پیش‌نمایش طرح‌ها و برنامه‌های استخراج‌شده ({toPersianDigits(parsedNewProgramRows.length)} طرح)</span>
            </div>

            <button
              onClick={handleCommitNewProgramsImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ثبت نهایی طرح‌ها در پایگاه داده</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5 text-center w-24">کد طرح</th>
                  <th className="p-2.5">عنوان طرح و برنامه</th>
                  <th className="p-2.5">حوزه تخصصی</th>
                  <th className="p-2.5 text-center">نوع شمول</th>
                  <th className="p-2.5 text-center">ضریب اهمیت</th>
                  <th className="p-2.5 text-center">مهلت اجرا</th>
                  <th className="p-2.5 text-center">وضعیت تطبیق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedNewProgramRows.map((r, idx) => (
                  <tr key={r.rowIdx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 text-center text-slate-400 font-mono font-bold">{toPersianDigits(idx + 1)}</td>
                    <td className="p-2.5 text-center">
                      <span className="font-mono font-bold px-2 py-0.5 bg-slate-900 text-white rounded text-[11px]">
                        {r.code}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{r.title}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded font-bold text-[11px]">
                        {r.section}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.scope === 'همگانی' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {r.scope}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-amber-800">
                      ⭐ ضریب {toPersianDigits(r.coefficient)}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">{toPersianDigits(r.deadline)}</td>
                    <td className="p-2.5 text-center">
                      {r.isExisting ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                          به‌روزرسانی
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                          طرح جدید
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TASK TEMPLATE STRUCTURE & COLUMNS PREVIEW */}
      {/* ======================================================== */}
      {showTaskTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    ساختار و ستون‌های الگوی اکسل ثبت تکالیف
                  </h3>
                  <p className="text-xs text-slate-500">
                    ستون‌های زیر دقیقاً همان ساختار فایل الگوی اکسل تکالیف سامانه می‌باشند.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTaskTemplateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl text-xs">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">نام ستون در فایل اکسل</th>
                    <th className="p-2.5">ضرورت</th>
                    <th className="p-2.5">نمونه مقدار</th>
                    <th className="p-2.5">توضیحات عملکرد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">کد اختصاصی همکار (دو رقمی)</td>
                    <td className="p-2.5 text-emerald-700 font-bold">پیشنهادی</td>
                    <td className="p-2.5 font-mono text-slate-700">01</td>
                    <td className="p-2.5 text-slate-500">کد کارتابل دو رقمی همکار (سریع‌ترین تطبیق)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">کد پرسنلی</td>
                    <td className="p-2.5 text-emerald-700 font-bold">اختیاری</td>
                    <td className="p-2.5 font-mono text-slate-700">201001</td>
                    <td className="p-2.5 text-slate-500">کد پرسنلی شاغل</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">کد ملی</td>
                    <td className="p-2.5 text-emerald-700 font-bold">اختیاری</td>
                    <td className="p-2.5 font-mono text-slate-700">1289456123</td>
                    <td className="p-2.5 text-slate-500">کد ملی ۱۰ رقمی</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">نام و نام خانوادگی همکار</td>
                    <td className="p-2.5 text-emerald-700 font-bold">پیشنهادی</td>
                    <td className="p-2.5 text-slate-700">حسین صادقی</td>
                    <td className="p-2.5 text-slate-500">جهت تطبیق نام در صورت فقدان کد</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">نام آموزشگاه</td>
                    <td className="p-2.5 text-slate-500">اختیاری</td>
                    <td className="p-2.5 text-slate-700">دبیرستان شهید بهشتی</td>
                    <td className="p-2.5 text-slate-500">جهت خوانایی در کاربرگ</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">کد یا عنوان طرح</td>
                    <td className="p-2.5 text-rose-600 font-bold">الزامی (در حالت چندطرحی)</td>
                    <td className="p-2.5 text-slate-700">مسابقات قرآن یا PRG-01</td>
                    <td className="p-2.5 text-slate-500">شناسایی طرح هدف در بین ۵ حوزه</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">وضعیت اجرا</td>
                    <td className="p-2.5 text-rose-600 font-bold">الزامی</td>
                    <td className="p-2.5 text-emerald-700 font-bold">انجام شده / دیر / انجام نشده</td>
                    <td className="p-2.5 text-slate-500">پایه محاسبه امتیاز بر اساس ضرایب</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">تاریخ اجرا (شمسی)</td>
                    <td className="p-2.5 text-slate-500">اختیاری</td>
                    <td className="p-2.5 font-mono text-slate-700">1403/09/20</td>
                    <td className="p-2.5 text-slate-500">تاریخ ثبت و ارسال مستندات</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">بستر ارسال مستندات</td>
                    <td className="p-2.5 text-slate-500">اختیاری</td>
                    <td className="p-2.5 text-slate-700">ایتا / شاد / اتوماسیون</td>
                    <td className="p-2.5 text-slate-500">بستر بارگذاری مدارک</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-blue-900">توضیحات و بازخورد</td>
                    <td className="p-2.5 text-slate-500">اختیاری</td>
                    <td className="p-2.5 text-slate-700">برگزاری مرحله آموزشگاهی با ۸۵ نفر</td>
                    <td className="p-2.5 text-slate-500">بازخورد و نکات کارشناسی</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyTaskTemplateToClipboard}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>کپی جدول ستون‌ها در کلیپ‌بورد</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTaskStatusCsvTemplate}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  دانلود CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadTaskStatusSampleTemplate();
                    setShowTaskTemplateModal(false);
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4 text-blue-200" />
                  <span>دانلود فایل اصلی اکسل (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
