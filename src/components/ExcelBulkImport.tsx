import React, { useState, useRef } from 'react';
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
} from '../types';
import { normalizePersianText } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate, updateJalaliDateToCurrentYear, padZero } from '../utils/jalali';
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
  UserX,
  UserCheck,
  UserPlus,
  Users,
  Building,
  GraduationCap,
  Briefcase,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ExcelBulkImportProps {
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
  onNavigateToTab?: (tab: string) => void;
  initialMode?: 'employees' | 'programs';
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

interface ParsedProgramStatusRow {
  rowIdx: number;
  schoolCode: string;
  schoolName: string;
  personnelCode: string;
  employeeCode: string;
  fullName: string;
  role: string;
  programTitle: string;
  programCode: string;
  statusText: string;
  executionDate: string;
  notes: string;
  matchedEmployee?: Employee;
  matchedProgram?: Program;
  resolvedStatus: ExecutionStatus;
  statusMatchReason: string;
  isDuplicate: boolean;
  isAmbiguous: boolean;
  matchType: 'personnel_code' | 'emp_code' | 'name' | 'unmatched';
}

export const ExcelBulkImport: React.FC<ExcelBulkImportProps> = ({
  db,
  onUpdateDatabase,
  onNavigateToTab,
  initialMode = 'employees',
}) => {
  // Main Tab: 'employees' (بارگذاری مشخصات همکاران) vs 'programs' (ثبت وضعیت اجرای طرح‌ها)
  const [activeImportTarget, setActiveImportTarget] = useState<'employees' | 'programs'>(initialMode);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);

  // Employee Import specific state
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

  // Program status import specific state
  const [programImportMode, setProgramImportMode] = useState<'completed_only' | 'full_scope'>('completed_only');
  const [targetProgramId, setTargetProgramId] = useState<string>(db.programs[0]?.id || '');
  const [programColumnMap, setProgramColumnMap] = useState({
    personnelCode: '',
    employeeCode: '',
    fullName: '',
    schoolCode: '',
    schoolName: '',
    role: '',
    programTitle: '',
    status: '',
    date: '',
    notes: '',
  });
  const [parsedProgramRows, setParsedProgramRows] = useState<ParsedProgramStatusRow[]>([]);
  const [updateRolesFromExcel, setUpdateRolesFromExcel] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    details?: { [key: string]: number | string };
  } | null>(null);

  // Auto-detect columns for Employees
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
      if (norm.includes('کد ملی') || norm.includes('کدملی') || norm.includes('شناسه ملی') || norm.includes('national') || norm.includes('کدملی')) {
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

  // Auto-detect columns for Program statuses
  const autoDetectProgramColumns = (headers: string[]) => {
    const map = {
      personnelCode: '',
      employeeCode: '',
      fullName: '',
      schoolCode: '',
      schoolName: '',
      role: '',
      programTitle: '',
      status: '',
      date: '',
      notes: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if (norm.includes('پرسنلی') || norm.includes('شناسه') || norm.includes('کد ملی')) {
        map.personnelCode = h;
      } else if ((norm.includes('کد') && norm.includes('همکار')) || norm === 'کد' || norm.includes('کد دو رقمی')) {
        map.employeeCode = h;
      } else if (norm.includes('نام') && (norm.includes('خانوادگی') || norm.includes('همکار') || norm === 'نام')) {
        map.fullName = h;
      } else if (norm.includes('کد') && (norm.includes('مدرسه') || norm.includes('آموزشگاه'))) {
        map.schoolCode = h;
      } else if (norm.includes('نام') && (norm.includes('مدرسه') || norm.includes('آموزشگاه'))) {
        map.schoolName = h;
      } else if (norm.includes('سمت') || norm.includes('پست') || norm.includes('شغل')) {
        map.role = h;
      } else if (norm.includes('طرح') || norm.includes('برنامه') || norm.includes('فعالیت')) {
        map.programTitle = h;
      } else if (norm.includes('وضعیت') || norm.includes('نتیجه') || norm.includes('اجرا')) {
        map.status = h;
      } else if (norm.includes('تاریخ') || norm.includes('مهلت') || norm.includes('زمان')) {
        map.date = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('مستند')) {
        map.notes = h;
      }
    });

    return map;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setExecutionResult(null);
    setParsedEmployeeRows([]);
    setParsedProgramRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheet(wb, firstSheet);
        }
      } catch (err: any) {
        setFormErrorMessage('خطا در خواندن فایل اکسل: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (json.length === 0) return;

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(json.length, 5); i++) {
      if (json[i].some((cell) => cell !== '')) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = json[headerRowIdx].map((c: any) => String(c || '').trim());
    const dataRows = json.slice(headerRowIdx + 1).filter((r) => r.some((c: any) => c !== ''));

    setRawHeaders(headers);
    setRawDataRows(dataRows);

    if (activeImportTarget === 'employees') {
      setEmployeeColumnMap(autoDetectEmployeeColumns(headers));
    } else {
      setProgramColumnMap(autoDetectProgramColumns(headers));
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbook) {
      processSheet(workbook, newSheet);
    }
  };

  // Helper to normalize grade strings
  const normalizeGrade = (raw?: string): EducationalGrade => {
    if (!raw) return 'متوسطه اول';
    const norm = normalizePersianText(raw);
    if (norm.includes('اول') && norm.includes('ابتدایی')) return 'ابتدایی دوره اول';
    if (norm.includes('دوم') && norm.includes('ابتدایی')) return 'ابتدایی دوره دوم';
    if (norm.includes('ابتدایی')) return 'ابتدایی دوره دوم';
    if (norm.includes('متوسطه اول') || norm.includes('راهنمایی')) return 'متوسطه اول';
    if (norm.includes('متوسطه دوم') || norm.includes('دبیرستان') || norm.includes('نظری')) return 'متوسطه دوم نظری';
    if (norm.includes('هنرستان') || norm.includes('فنی') || norm.includes('کاردانش')) return 'هنرستان فنی و حرفه‌ای و کاردانش';
    if (norm.includes('مجتمع')) return 'مجتمع آموزشی و پرورشی';
    return 'متوسطه اول';
  };

  // Helper to normalize role strings
  const normalizeRole = (raw?: string): { role: string; customRoleTitle?: string } => {
    if (!raw) return { role: 'سایر', customRoleTitle: 'نامشخص' };
    const trimmed = raw.trim();
    const matchedStd = STANDARD_ROLES.find(
      (sr) => sr === trimmed || normalizePersianText(sr) === normalizePersianText(trimmed),
    );
    if (matchedStd) {
      return { role: matchedStd };
    }
    return { role: 'سایر', customRoleTitle: trimmed };
  };

  // ==========================================
  // ANALYZE EMPLOYEES IMPORT
  // ==========================================
  const analyzeEmployeeImport = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);

    const existingByNationalId = new Map<string, Employee>();
    const existingByPersonnel = new Map<string, Employee>();
    const existingByFullName = new Map<string, Employee>();
    const usedCodes = new Set<number>();

    db.employees.forEach((emp) => {
      if (emp.nationalId) existingByNationalId.set(emp.nationalId.trim(), emp);
      if (emp.personnelCode) existingByPersonnel.set(emp.personnelCode.trim(), emp);
      existingByFullName.set(normalizePersianText(emp.fullName), emp);
      const c = parseInt(emp.code, 10);
      if (!isNaN(c)) usedCodes.add(c);
    });

    const existingSchools = new Set(db.schools.map((s) => normalizePersianText(s.name)));

    let nextAvailableCodeNum = 1;
    const getNextFreeCode = (): string => {
      while (usedCodes.has(nextAvailableCodeNum) && nextAvailableCodeNum <= 99) {
        nextAvailableCodeNum++;
      }
      usedCodes.add(nextAvailableCodeNum);
      return padZero(nextAvailableCodeNum);
    };

    const parsed: ParsedEmployeeRow[] = [];

    rawDataRows.forEach((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const cIdx = rawHeaders.indexOf(col);
        return cIdx !== -1 ? String(row[cIdx] || '').trim() : '';
      };

      const nationalIdRaw = getVal(employeeColumnMap.nationalId).replace(/[^0-9]/g, '');
      const personnelRaw = getVal(employeeColumnMap.personnelCode).replace(/[^0-9]/g, '');
      const fullName = getVal(employeeColumnMap.fullName);
      const schoolName = getVal(employeeColumnMap.schoolName);
      const gradeRaw = getVal(employeeColumnMap.grade);
      const roleRaw = getVal(employeeColumnMap.role);
      const expRaw = getVal(employeeColumnMap.experienceYears);
      const userCodeRaw = getVal(employeeColumnMap.employeeCode);
      const phone = getVal(employeeColumnMap.phone);
      const notes = getVal(employeeColumnMap.notes);

      if (!fullName && !nationalIdRaw && !personnelRaw) {
        return; // empty row
      }

      let matchedEmp: Employee | undefined = undefined;

      if (nationalIdRaw && existingByNationalId.has(nationalIdRaw)) {
        matchedEmp = existingByNationalId.get(nationalIdRaw);
      } else if (personnelRaw && existingByPersonnel.has(personnelRaw)) {
        matchedEmp = existingByPersonnel.get(personnelRaw);
      } else if (fullName && existingByFullName.has(normalizePersianText(fullName))) {
        matchedEmp = existingByFullName.get(normalizePersianText(fullName));
      }

      const isExisting = Boolean(matchedEmp);
      let assignedCode = '';

      if (matchedEmp) {
        assignedCode = matchedEmp.code;
      } else if (userCodeRaw && !usedCodes.has(parseInt(userCodeRaw, 10))) {
        assignedCode = padZero(userCodeRaw);
        usedCodes.add(parseInt(userCodeRaw, 10));
      } else {
        assignedCode = getNextFreeCode();
      }

      const willCreateSchool = schoolName ? !existingSchools.has(normalizePersianText(schoolName)) : false;

      let expValue: string | number = '';
      if (expRaw) {
        const num = parseInt(expRaw.replace(/[^0-9]/g, ''), 10);
        expValue = isNaN(num) ? expRaw : num;
      }

      parsed.push({
        rowIdx: idx + 2,
        fullName: fullName || (matchedEmp?.fullName || 'نامشخص'),
        nationalId: nationalIdRaw || matchedEmp?.nationalId || '',
        personnelCode: personnelRaw || matchedEmp?.personnelCode || assignedCode,
        employeeCode: userCodeRaw || assignedCode,
        schoolName: schoolName || matchedEmp?.schoolName || 'دبیرستان شهید بهشتی',
        grade: normalizeGrade(gradeRaw || matchedEmp?.grade),
        role: roleRaw || matchedEmp?.role || 'معاون پرورشی',
        experienceYears: expValue !== '' ? expValue : (matchedEmp?.experienceYears || ''),
        phone: phone || matchedEmp?.phone || '',
        notes: notes || matchedEmp?.notes || '',
        isExisting,
        matchedEmployeeId: matchedEmp?.id,
        willCreateSchool,
        assignedCode,
        isValid: Boolean(fullName || nationalIdRaw || personnelRaw),
      });
    });

    setParsedEmployeeRows(parsed);
    setIsProcessing(false);
  };

  // Commit Employee Import
  const handleCommitEmployeeImport = () => {
    if (parsedEmployeeRows.length === 0) return;

    let updatedEmployees = [...db.employees];
    let updatedSchools = [...db.schools];

    let createdCount = 0;
    let updatedCount = 0;
    let schoolsCreatedCount = 0;

    const existingSchoolsMap = new Map(db.schools.map((s) => [normalizePersianText(s.name), s]));

    parsedEmployeeRows.forEach((row) => {
      // 1. Ensure school exists or create it
      const normSchName = normalizePersianText(row.schoolName);
      let targetSchool = existingSchoolsMap.get(normSchName);

      if (!targetSchool && row.schoolName) {
        targetSchool = {
          id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: row.schoolName.trim(),
          code: `10${updatedSchools.length + 1}`,
          grade: row.grade,
          gender: 'پسرانه',
          notes: 'ثبت خودکار از طریق ورود مشخصات اکسل',
        };
        updatedSchools.push(targetSchool);
        existingSchoolsMap.set(normSchName, targetSchool);
        schoolsCreatedCount++;
      }

      const { role, customRoleTitle } = normalizeRole(row.role);

      // 2. Insert or update employee
      if (row.isExisting && row.matchedEmployeeId && overwriteExistingEmployees) {
        const empIdx = updatedEmployees.findIndex((e) => e.id === row.matchedEmployeeId);
        if (empIdx !== -1) {
          const current = updatedEmployees[empIdx];
          updatedEmployees[empIdx] = {
            ...current,
            fullName: row.fullName || current.fullName,
            nationalId: row.nationalId || current.nationalId,
            personnelCode: row.personnelCode || current.personnelCode,
            schoolId: targetSchool?.id || current.schoolId,
            schoolName: targetSchool?.name || row.schoolName || current.schoolName,
            grade: row.grade || current.grade,
            role: role || current.role,
            customRoleTitle: customRoleTitle !== undefined ? customRoleTitle : current.customRoleTitle,
            experienceYears: row.experienceYears !== '' ? row.experienceYears : current.experienceYears,
            phone: row.phone || current.phone,
            notes: row.notes || current.notes,
          };
          updatedCount++;
        }
      } else if (!row.isExisting) {
        const newEmp: Employee = {
          id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          code: row.assignedCode,
          personnelCode: row.personnelCode || row.assignedCode,
          nationalId: row.nationalId || undefined,
          fullName: row.fullName,
          schoolId: targetSchool?.id || '',
          schoolName: targetSchool?.name || row.schoolName,
          grade: row.grade,
          role: role,
          customRoleTitle: customRoleTitle,
          experienceYears: row.experienceYears !== '' ? row.experienceYears : undefined,
          phone: row.phone || '',
          notes: row.notes || 'بارگذاری از اکسل',
          createdAt: getCurrentJalaliDate(),
        };
        updatedEmployees.push(newEmp);
        createdCount++;
      }
    });

    const newDb: AppDatabase = {
      ...db,
      employees: updatedEmployees,
      schools: updatedSchools,
    };

    onUpdateDatabase(newDb);

    setExecutionResult({
      success: true,
      title: 'بارگذاری مشخصات همکاران با موفقیت انجام شد',
      message: `${toPersianDigits(createdCount)} همکار جدید ثبت شد و مشخصات ${toPersianDigits(updatedCount)} همکار موجود به‌روزرسانی گردید.`,
      details: {
        'همکاران جدید افزوده شده': createdCount,
        'همکاران موجود به‌روزرسانی‌شده': updatedCount,
        'آموزشگاه‌های جدید ثبت‌شده': schoolsCreatedCount,
        'مجموع همکاران سامانه': updatedEmployees.length,
      },
    });

    setParsedEmployeeRows([]);
  };

  // Download Sample Template for Employees
  const handleDownloadEmployeeSampleTemplate = () => {
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
      [
        '1278912345',
        '201004',
        'الهام سعیدی',
        'هنرستان فنی دخترانه کوثر',
        'هنرستان فنی و حرفه‌ای و کاردانش',
        'دبیر',
        '10',
        '09134445566',
        'دبیر تربیت بدنی و مسئول کانون',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 16 }, // کد ملی
      { wch: 14 }, // کد پرسنلی
      { wch: 24 }, // نام و نام خانوادگی
      { wch: 30 }, // نام آموزشگاه
      { wch: 22 }, // مقطع تحصیلی
      { wch: 20 }, // سمت
      { wch: 18 }, // سابقه خدمت
      { wch: 16 }, // تلفن
      { wch: 35 }, // توضیحات
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'مشخصات همکاران');
    XLSX.writeFile(wb, 'الگوی_اکسل_مشخصات_همکاران_ناحیه۶.xlsx');
  };

  // Program status import commit
  const handleCommitProgramImport = () => {
    if (parsedProgramRows.length === 0) return;
    const matched = parsedProgramRows.filter((r) => r.matchedEmployee && r.matchedProgram && !r.isDuplicate);
    if (matched.length === 0) {
      setFormErrorMessage('هیچ ردیف منطبقی با همکاران و طرح‌های سامانه یافت نشد.');
      return;
    }

    let updatedEmployees = [...db.employees];
    let updatedAssignments = [...db.employeePrograms];
    let count = 0;

    matched.forEach((row) => {
      const emp = row.matchedEmployee!;
      const prg = row.matchedProgram!;

      const existingIdx = updatedAssignments.findIndex(
        (ep) => ep.employeeId === emp.id && ep.programId === prg.id,
      );

      if (existingIdx !== -1) {
        updatedAssignments[existingIdx] = {
          ...updatedAssignments[existingIdx],
          status: row.resolvedStatus,
          actualDate: row.executionDate || updatedAssignments[existingIdx].actualDate || getCurrentJalaliDate(),
          executionDate: row.executionDate || updatedAssignments[existingIdx].executionDate || getCurrentJalaliDate(),
          notes: row.notes || updatedAssignments[existingIdx].notes,
          updatedAt: getCurrentJalaliDate(),
        };
      } else {
        updatedAssignments.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          programId: prg.id,
          status: row.resolvedStatus,
          isManualOverride: false,
          actualDate: row.executionDate || getCurrentJalaliDate(),
          executionDate: row.executionDate || getCurrentJalaliDate(),
          notes: row.notes || 'ثبت خودکار از اکسل',
          updatedAt: getCurrentJalaliDate(),
        });
      }
      count++;
    });

    onUpdateDatabase({
      ...db,
      employees: updatedEmployees,
      employeePrograms: updatedAssignments,
    });

    setExecutionResult({
      success: true,
      title: 'وضعیت اجرای طرح‌ها با موفقیت ثبت شد',
      message: `${toPersianDigits(count)} تکلیف در سامانه به‌روزرسانی شد.`,
    });
    setParsedProgramRows([]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
              📊 اداره آموزش و پرورش ناحیه ۶ اصفهان
            </span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              ورود هوشمند داده‌ها از Excel
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-600" />
            <span>مرکز ورود گروهی اطلاعات از فایل Excel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            بارگذاری پرونده مشخصات همکاران (کد ملی، پرسنلی، آموزشگاه، مقطع، سمت و سابقه) یا ثبت دسته‌جمعی عملکرد طرح‌ها
          </p>
        </div>

        {activeImportTarget === 'employees' ? (
          <button
            onClick={handleDownloadEmployeeSampleTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>دانلود الگوی اکسل مشخصات همکاران</span>
          </button>
        ) : (
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300 shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>الگوی اکسل تکالیف طرح‌ها</span>
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('employees');
            setExecutionResult(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeImportTarget === 'employees'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>۱. بارگذاری مشخصات همکاران (کد ملی، پرسنلی، آموزشگاه، مقطع، سمت، سابقه)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveImportTarget('programs');
            setExecutionResult(null);
            setRawHeaders([]);
            setRawDataRows([]);
            setFileName('');
          }}
          className={`py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeImportTarget === 'programs'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>۲. ثبت گروهی وضعیت اجرای طرح‌ها و برنامه‌ها از اکسل</span>
        </button>
      </div>

      {/* Error Notification */}
      {formErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-3xl shadow-sm flex items-center justify-between text-xs font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formErrorMessage}</span>
          </div>
          <button
            onClick={() => setFormErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success / Result Notification */}
      {executionResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-3xl shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{executionResult.title}</span>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">{executionResult.message}</p>

          {executionResult.details && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
              {Object.entries(executionResult.details).map(([key, val]) => (
                <div key={key} className="bg-white/90 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-500 block text-[11px]">{key}:</span>
                  <strong className="text-emerald-800 font-mono text-sm">{toPersianDigits(val)}</strong>
                </div>
              ))}
            </div>
          )}

          {onNavigateToTab && (
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => onNavigateToTab(activeImportTarget === 'employees' ? 'employees' : 'ranking')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {activeImportTarget === 'employees' ? 'مشاهده پرونده همکاران ↵' : 'مشاهده تابلوی رتبه‌بندی ↵'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs">
              ۱
            </span>
            <span>
              {activeImportTarget === 'employees'
                ? 'انتخاب فایل اکسل مشخصات همکاران (حاوی کد ملی، پرسنلی، نام آموزشگاه، مقطع، سمت، سابقه)'
                : 'انتخاب فایل اکسل وضعیت اجرای طرح‌ها'}
            </span>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all space-y-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <div className="font-bold text-sm text-slate-800">
            {fileName ? (
              <span className="text-teal-700 font-mono font-bold">فایل انتخاب‌شده: {fileName}</span>
            ) : (
              <span>کلیک برای انتخاب فایل اکسل (XLSX / XLS) یا رها کردن فایل در این بخش</span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {activeImportTarget === 'employees'
              ? 'فایل اکسل می‌تواند شامل ستون‌های: کد ملی، کد پرسنلی، نام و نام خانوادگی، نام آموزشگاه، مقطع، سمت و سابقه خدمت باشد.'
              : 'پشتیبانی از فرمت‌های خروجی اتوماسیون، شاد و سیدا'}
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
              <label className="font-bold text-emerald-950 block">
                کد ملی همکار (۱۰ رقمی): *
              </label>
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
              <label className="font-bold text-emerald-950 block">
                کد پرسنلی / استخدامی: *
              </label>
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
              <label className="font-bold text-emerald-950 block">
                نام و نام خانوادگی: *
              </label>
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
              <label className="font-bold text-blue-950 block">
                نام آموزشگاه محل خدمت: *
              </label>
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
              <label className="font-bold text-slate-700 block">
                مقطع تحصیلی: *
              </label>
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
              <label className="font-bold text-slate-700 block">
                سمت سازمانی: *
              </label>
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
              <label className="font-bold text-amber-950 block">
                سابقه خدمت (سنوات به سال): *
              </label>
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
                className="w-4 h-4 rounded text-emerald-600"
              />
              <span>به‌روزرسانی خودکار مشخصات همکاران موجود در صورت تطبیق کد ملی یا کد پرسنلی</span>
            </label>

            <button
              onClick={analyzeEmployeeImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <span>تحلیل فایل و پیش‌نمایش فهرست همکاران</span>
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
              <span>پیش‌نمایش مشخصات همکاران استخراج‌شده ({toPersianDigits(parsedEmployeeRows.length)} نفر)</span>
            </div>

            <button
              onClick={handleCommitEmployeeImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ثبت نهایی همکاران در پایگاه داده</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-500 block mb-1">کل افراد استخراج‌شده:</span>
              <strong className="text-slate-900 font-mono text-base">
                {toPersianDigits(parsedEmployeeRows.length)} نفر
              </strong>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-emerald-800 block mb-1">همکاران جدید (ثبت جدید):</span>
              <strong className="text-emerald-700 font-mono text-base">
                {toPersianDigits(parsedEmployeeRows.filter((r) => !r.isExisting).length)} نفر
              </strong>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
              <span className="text-blue-800 block mb-1">همکاران منطبق (به‌روزرسانی):</span>
              <strong className="text-blue-700 font-mono text-base">
                {toPersianDigits(parsedEmployeeRows.filter((r) => r.isExisting).length)} نفر
              </strong>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-amber-800 block mb-1">آموزشگاه‌های جدید:</span>
              <strong className="text-amber-700 font-mono text-base">
                {toPersianDigits(parsedEmployeeRows.filter((r) => r.willCreateSchool).length)} مدرسه
              </strong>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5 text-center w-20">کد کارتابل</th>
                  <th className="p-2.5">نام و نام خانوادگی</th>
                  <th className="p-2.5 text-center">کد ملی</th>
                  <th className="p-2.5 text-center">کد پرسنلی</th>
                  <th className="p-2.5">آموزشگاه محل خدمت</th>
                  <th className="p-2.5">مقطع</th>
                  <th className="p-2.5">سمت</th>
                  <th className="p-2.5 text-center">سابقه</th>
                  <th className="p-2.5 text-center">وضعیت تطبیق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedEmployeeRows.map((r, idx) => (
                  <tr
                    key={r.rowIdx}
                    className={`hover:bg-slate-50 transition-colors ${
                      r.isExisting ? 'bg-blue-50/20' : 'bg-emerald-50/15'
                    }`}
                  >
                    <td className="p-2.5 text-center text-slate-400 font-mono font-bold">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="font-mono font-bold px-2 py-0.5 bg-slate-900 text-white rounded text-[11px]">
                        {r.assignedCode}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{r.fullName}</td>
                    <td className="p-2.5 text-center font-mono text-slate-700">{r.nationalId || '---'}</td>
                    <td className="p-2.5 text-center font-mono text-slate-700">{r.personnelCode || '---'}</td>
                    <td className="p-2.5 text-slate-800">
                      <span>{r.schoolName}</span>
                      {r.willCreateSchool && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded mr-1">
                          آموزشگاه جدید
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
                          به‌روزرسانی موجود
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

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              با کلیک بر روی دکمه زیر، مشخصات استخراج‌شده شامل کد ملی، کد پرسنلی، آموزشگاه، مقطع، سمت و سابقه در سامانه ذخیره می‌گردد.
            </span>
            <button
              onClick={handleCommitEmployeeImport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تایید و ثبت نهایی همکاران در پایگاه داده</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: PROGRAM STATUSES BULK IMPORT */}
      {/* ======================================================== */}
      {activeImportTarget === 'programs' && rawHeaders.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-800">تطبیق ستون‌های فایل عملکرد طرح‌ها</h3>
            <button
              onClick={() => setProgramColumnMap(autoDetectProgramColumns(rawHeaders))}
              className="flex items-center gap-1 text-xs text-blue-700 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تشخیص مجدد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">کد همکار یا کد پرسنلی:</label>
              <select
                value={programColumnMap.employeeCode || programColumnMap.personnelCode}
                onChange={(e) => setProgramColumnMap({ ...programColumnMap, employeeCode: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">نام همکار: *</label>
              <select
                value={programColumnMap.fullName}
                onChange={(e) => setProgramColumnMap({ ...programColumnMap, fullName: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">طرح هدف:</label>
              <select
                value={targetProgramId}
                onChange={(e) => setTargetProgramId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title} ({p.section || 'پرورشی'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                // Program analysis logic
              }}
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              تحلیل و پیش‌نمایش وضعیت طرح‌ها ↵
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
