import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  Employee,
  School,
  EducationalGrade,
  STANDARD_ROLES,
} from '../types';
import { normalizePersianText } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate, padZero } from '../utils/jalali';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  UserPlus,
  Users,
  Building,
  GraduationCap,
  Briefcase,
  Clock,
  IdCard,
} from 'lucide-react';

interface EmployeeExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
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
  customRoleTitle?: string;
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

function cleanDigits(str?: any): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = s;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i));
    res = res.replaceAll(arabicDigits[i], String(i));
  }
  return res.replace(/[^0-9]/g, '');
}

export const EmployeeExcelImportModal: React.FC<EmployeeExcelImportModalProps> = ({
  isOpen,
  onClose,
  db,
  onUpdateDatabase,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [columnMap, setColumnMap] = useState({
    nationalId: '',
    personnelCode: '',
    fullName: '',
    firstName: '',
    lastName: '',
    schoolName: '',
    grade: '',
    role: '',
    experienceYears: '',
    employeeCode: '',
    phone: '',
    notes: '',
  });

  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    createdCount: number;
    updatedCount: number;
    schoolsCreatedCount: number;
    total: number;
  } | null>(null);

  if (!isOpen) return null;

  // Auto-detect columns
  const autoDetectColumns = (headers: string[]) => {
    const map = {
      nationalId: '',
      personnelCode: '',
      fullName: '',
      firstName: '',
      lastName: '',
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
      if (
        norm.includes('کد ملی') ||
        norm.includes('کدملی') ||
        norm.includes('شناسه ملی') ||
        norm.includes('شماره ملی') ||
        norm.includes('national') ||
        norm.includes('melli')
      ) {
        map.nationalId = h;
      } else if (
        norm.includes('پرسنلی') ||
        norm.includes('استخدامی') ||
        norm.includes('کارمندی') ||
        norm.includes('personnel')
      ) {
        map.personnelCode = h;
      } else if (
        (norm.includes('نام') && norm.includes('خانوادگی')) ||
        norm.includes('همکار') ||
        norm === 'نام و نشان'
      ) {
        map.fullName = h;
      } else if (norm === 'نام' || norm === 'نام کوچک' || norm === 'first name') {
        map.firstName = h;
      } else if (
        norm === 'نام خانوادگی' ||
        norm === 'فامیلی' ||
        norm === 'شهرت' ||
        norm === 'last name'
      ) {
        map.lastName = h;
      } else if (
        norm.includes('آموزشگاه') ||
        norm.includes('مدرسه') ||
        norm.includes('واحد آموزشی') ||
        norm.includes('محل خدمت') ||
        norm.includes('school')
      ) {
        map.schoolName = h;
      } else if (
        norm.includes('مقطع') ||
        norm.includes('دوره') ||
        norm.includes('پایه') ||
        norm.includes('grade') ||
        norm.includes('level')
      ) {
        map.grade = h;
      } else if (
        norm.includes('سمت') ||
        norm.includes('پست') ||
        norm.includes('نقش') ||
        norm.includes('شغل') ||
        norm.includes('سازمانی') ||
        norm.includes('role')
      ) {
        map.role = h;
      } else if (
        norm.includes('سابقه') ||
        norm.includes('سنوات') ||
        norm.includes('تجربه') ||
        norm.includes('experience') ||
        norm.includes('exp')
      ) {
        map.experienceYears = h;
      } else if (
        (norm.includes('کد') && norm.includes('کارتابل')) ||
        norm.includes('کد دو رقمی') ||
        norm === 'کد'
      ) {
        map.employeeCode = h;
      } else if (
        norm.includes('همراه') ||
        norm.includes('موبایل') ||
        norm.includes('تلفن') ||
        norm.includes('phone')
      ) {
        map.phone = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('سوابق')) {
        map.notes = h;
      }
    });

    if (!map.fullName && map.firstName && map.lastName) {
      // both exist
    }

    return map;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setSuccessResult(null);
    setParsedRows([]);

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
        setErrorMessage('خطا در خواندن فایل اکسل: ' + (err.message || 'فایل معتبر نیست'));
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (json.length === 0) {
      setErrorMessage('کاربرگ انتخابی خالی است.');
      return;
    }

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(json.length, 6); i++) {
      if (json[i].some((cell) => cell !== '')) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = json[headerRowIdx].map((c: any) => String(c || '').trim());
    const dataRows = json.slice(headerRowIdx + 1).filter((r) => r.some((c: any) => c !== ''));

    setRawHeaders(headers);
    setRawDataRows(dataRows);
    setColumnMap(autoDetectColumns(headers));
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbook) {
      processSheet(workbook, newSheet);
    }
  };

  const normalizeGrade = (raw?: string): EducationalGrade => {
    if (!raw) return 'متوسطه اول';
    const norm = normalizePersianText(raw);
    if (norm.includes('اول') && norm.includes('ابتدایی')) return 'ابتدایی دوره اول';
    if (norm.includes('دوم') && norm.includes('ابتدایی')) return 'ابتدایی دوره دوم';
    if (norm.includes('ابتدایی')) return 'ابتدایی دوره دوم';
    if (norm.includes('متوسطه اول') || norm.includes('راهنمایی')) return 'متوسطه اول';
    if (norm.includes('متوسطه دوم') || norm.includes('دبیرستان') || norm.includes('نظری'))
      return 'متوسطه دوم نظری';
    if (norm.includes('هنرستان') || norm.includes('فنی') || norm.includes('کاردانش'))
      return 'هنرستان فنی و حرفه‌ای و کاردانش';
    if (norm.includes('مجتمع')) return 'مجتمع آموزشی و پرورشی';
    return 'متوسطه اول';
  };

  const normalizeRole = (raw?: string): { role: string; customRoleTitle?: string } => {
    if (!raw) return { role: 'معاون پرورشی' };
    const trimmed = raw.trim();
    const matchedStd = STANDARD_ROLES.find(
      (sr) => sr === trimmed || normalizePersianText(sr) === normalizePersianText(trimmed),
    );
    if (matchedStd) {
      return { role: matchedStd };
    }
    return { role: 'سایر', customRoleTitle: trimmed };
  };

  const analyzeRows = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const existingByNationalId = new Map<string, Employee>();
    const existingByPersonnel = new Map<string, Employee>();
    const existingByFullName = new Map<string, Employee>();
    const usedCodes = new Set<number>();

    db.employees.forEach((emp) => {
      if (emp.nationalId) existingByNationalId.set(cleanDigits(emp.nationalId), emp);
      if (emp.personnelCode) existingByPersonnel.set(cleanDigits(emp.personnelCode), emp);
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

      const nationalIdClean = cleanDigits(getVal(columnMap.nationalId));
      const personnelClean = cleanDigits(getVal(columnMap.personnelCode));

      let fullName = getVal(columnMap.fullName);
      if (!fullName && (columnMap.firstName || columnMap.lastName)) {
        const fn = getVal(columnMap.firstName);
        const ln = getVal(columnMap.lastName);
        fullName = `${fn} ${ln}`.trim();
      }

      const schoolName = getVal(columnMap.schoolName);
      const gradeRaw = getVal(columnMap.grade);
      const roleRaw = getVal(columnMap.role);
      const expRaw = getVal(columnMap.experienceYears);
      const userCodeRaw = getVal(columnMap.employeeCode);
      const phone = getVal(columnMap.phone);
      const notes = getVal(columnMap.notes);

      if (!fullName && !nationalIdClean && !personnelClean) {
        return; // skip completely empty rows
      }

      let matchedEmp: Employee | undefined = undefined;
      if (nationalIdClean && existingByNationalId.has(nationalIdClean)) {
        matchedEmp = existingByNationalId.get(nationalIdClean);
      } else if (personnelClean && existingByPersonnel.has(personnelClean)) {
        matchedEmp = existingByPersonnel.get(personnelClean);
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

      const willCreateSchool = schoolName
        ? !existingSchools.has(normalizePersianText(schoolName))
        : false;

      let expValue: string | number = '';
      if (expRaw) {
        const cleanedExp = cleanDigits(expRaw);
        expValue = cleanedExp ? parseInt(cleanedExp, 10) : expRaw;
      }

      const { role, customRoleTitle } = normalizeRole(roleRaw || matchedEmp?.role);

      parsed.push({
        rowIdx: idx + 2,
        fullName: fullName || matchedEmp?.fullName || 'نامشخص',
        nationalId: nationalIdClean || matchedEmp?.nationalId || '',
        personnelCode: personnelClean || matchedEmp?.personnelCode || assignedCode,
        employeeCode: userCodeRaw || assignedCode,
        schoolName: schoolName || matchedEmp?.schoolName || 'دبیرستان شهید بهشتی',
        grade: normalizeGrade(gradeRaw || matchedEmp?.grade),
        role: role,
        customRoleTitle: customRoleTitle,
        experienceYears: expValue !== '' ? expValue : matchedEmp?.experienceYears || '',
        phone: phone || matchedEmp?.phone || '',
        notes: notes || matchedEmp?.notes || '',
        isExisting,
        matchedEmployeeId: matchedEmp?.id,
        willCreateSchool,
        assignedCode,
        isValid: Boolean(fullName || nationalIdClean || personnelClean),
      });
    });

    if (parsed.length === 0) {
      setErrorMessage('هیچ ردیف معتبری در فایل اکسل شناسایی نشد.');
    } else {
      setParsedRows(parsed);
    }
    setIsProcessing(false);
  };

  const handleCommit = () => {
    if (parsedRows.length === 0) return;

    let updatedEmployees = [...db.employees];
    let updatedSchools = [...db.schools];

    let createdCount = 0;
    let updatedCount = 0;
    let schoolsCreatedCount = 0;

    const existingSchoolsMap = new Map(db.schools.map((s) => [normalizePersianText(s.name), s]));

    parsedRows.forEach((row) => {
      // 1. School check
      const normSchName = normalizePersianText(row.schoolName);
      let targetSchool = existingSchoolsMap.get(normSchName);

      if (!targetSchool && row.schoolName) {
        targetSchool = {
          id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: row.schoolName.trim(),
          code: `10${updatedSchools.length + 1}`,
          grade: row.grade,
          gender: 'پسرانه',
          notes: 'ثبت خودکار از اکسل مشخصات همکاران',
        };
        updatedSchools.push(targetSchool);
        existingSchoolsMap.set(normSchName, targetSchool);
        schoolsCreatedCount++;
      }

      // 2. Employee check
      if (row.isExisting && row.matchedEmployeeId && overwriteExisting) {
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
            role: row.role || current.role,
            customRoleTitle:
              row.customRoleTitle !== undefined ? row.customRoleTitle : current.customRoleTitle,
            experienceYears:
              row.experienceYears !== '' ? row.experienceYears : current.experienceYears,
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
          role: row.role,
          customRoleTitle: row.customRoleTitle,
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

    setSuccessResult({
      createdCount,
      updatedCount,
      schoolsCreatedCount,
      total: updatedEmployees.length,
    });
    setParsedRows([]);
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
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

    const data = [
      headers,
      [
        '1289456123',
        '201001',
        'حسین صادقی',
        'دبیرستان شهید بهشتی',
        'متوسطه اول',
        'معاون پرورشی',
        '15',
        '09131112233',
        'مسئول پایگاه فرهنگی و تربیتی',
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
        'پیگیر و فعال در حوزه مسابقات قرآن',
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
        'آموزگار پایه پنجم و مربی تشکل‌ها',
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
        'دبیر تربیت بدنی و مسئول المپیاد ورزشی',
      ],
      [
        '1299988776',
        '201005',
        'محمد رضایی',
        'دبیرستان امام صادق (ع)',
        'متوسطه دوم نظری',
        'مدیر',
        '22',
        '09135556677',
        'مدیر با سابقه و هماهنگ‌کننده طرح‌ها',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 16 }, // کد ملی
      { wch: 14 }, // کد پرسنلی
      { wch: 24 }, // نام و نام خانوادگی
      { wch: 30 }, // نام آموزشگاه
      { wch: 22 }, // مقطع تحصیلی
      { wch: 20 }, // سمت
      { wch: 18 }, // سابقه خدمت
      { wch: 16 }, // شماره تماس
      { wch: 35 }, // توضیحات
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'مشخصات همکاران');
    XLSX.writeFile(wb, 'الگوی_اکسل_مشخصات_همکاران_ناحیه۶.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                  آموزش و پرورش ناحیه ۶ اصفهان
                </span>
                <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
                  ورود مستقیم Excel
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold">
                بارگذاری مشخصات همکاران از طریق فایل اکسل
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                شامل: کد ملی، کد پرسنلی، نام آموزشگاه، مقطع تحصیلی، سمت سازمانی و سابقه خدمت
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-800 px-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Success Banner */}
          {successResult && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>بارگذاری مشخصات همکاران با موفقیت انجام شد</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-500 block text-[11px]">همکاران جدید:</span>
                  <strong className="text-emerald-700 font-mono text-sm">
                    {toPersianDigits(successResult.createdCount)} نفر
                  </strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-500 block text-[11px]">به‌روزرسانی‌شده:</span>
                  <strong className="text-blue-700 font-mono text-sm">
                    {toPersianDigits(successResult.updatedCount)} نفر
                  </strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-500 block text-[11px]">آموزشگاه‌های جدید:</span>
                  <strong className="text-amber-700 font-mono text-sm">
                    {toPersianDigits(successResult.schoolsCreatedCount)} مدرسه
                  </strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-slate-500 block text-[11px]">مجموع پرونده‌ها:</span>
                  <strong className="text-slate-900 font-mono text-sm">
                    {toPersianDigits(successResult.total)} نفر
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Upload Card & Download Template */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                  ۱
                </span>
                <span>انتخاب فایل اکسل حاوی اطلاعات همکاران</span>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span>دانلود نمونه الگوی اکسل همکاران</span>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-300 hover:border-teal-500 bg-white hover:bg-teal-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
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
                  <span className="text-teal-700 font-mono font-bold">
                    فایل انتخاب‌شده: {fileName}
                  </span>
                ) : (
                  <span>کلیک برای انتخاب فایل اکسل (XLSX / XLS) یا کشیدن فایل به اینجا</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                ستون‌های پیشنهادی: کد ملی، کد پرسنلی، نام و نام خانوادگی، نام آموزشگاه، مقطع تحصیلی،
                سمت سازمانی، سابقه خدمت
              </p>
            </div>

            {sheetNames.length > 1 && (
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">انتخاب کاربرگ (Sheet):</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Step 2: Column Mapping */}
          {rawHeaders.length > 0 && (
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    ۲
                  </span>
                  <span>تطبیق فیلدهای درخواستی با ستون‌های فایل اکسل شما</span>
                </div>
                <button
                  type="button"
                  onClick={() => setColumnMap(autoDetectColumns(rawHeaders))}
                  className="flex items-center gap-1 text-xs text-teal-700 font-bold hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تطبیق خودکار مجدد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* 1. National ID */}
                <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-xs space-y-1">
                  <label className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کد ملی (۱۰ رقمی): *</span>
                  </label>
                  <select
                    value={columnMap.nationalId}
                    onChange={(e) => setColumnMap({ ...columnMap, nationalId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون کد ملی --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Personnel Code */}
                <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-xs space-y-1">
                  <label className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کد پرسنلی / استخدامی: *</span>
                  </label>
                  <select
                    value={columnMap.personnelCode}
                    onChange={(e) => setColumnMap({ ...columnMap, personnelCode: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون کد پرسنلی --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Full Name */}
                <div className="p-3 bg-white rounded-xl border border-emerald-300 shadow-xs space-y-1">
                  <label className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>نام و نام خانوادگی همکار: *</span>
                  </label>
                  <select
                    value={columnMap.fullName}
                    onChange={(e) => setColumnMap({ ...columnMap, fullName: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون نام و نام خانوادگی --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. School Name */}
                <div className="p-3 bg-white rounded-xl border border-blue-300 shadow-xs space-y-1">
                  <label className="font-bold text-blue-950 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span>نام آموزشگاه محل خدمت: *</span>
                  </label>
                  <select
                    value={columnMap.schoolName}
                    onChange={(e) => setColumnMap({ ...columnMap, schoolName: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون نام آموزشگاه --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Grade */}
                <div className="p-3 bg-white rounded-xl border border-slate-300 shadow-xs space-y-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>مقطع تحصیلی: *</span>
                  </label>
                  <select
                    value={columnMap.grade}
                    onChange={(e) => setColumnMap({ ...columnMap, grade: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون مقطع تحصیلی --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Staff Role */}
                <div className="p-3 bg-white rounded-xl border border-slate-300 shadow-xs space-y-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    <span>سمت سازمانی: *</span>
                  </label>
                  <select
                    value={columnMap.role}
                    onChange={(e) => setColumnMap({ ...columnMap, role: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون سمت سازمانی --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Experience Years */}
                <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-xs space-y-1">
                  <label className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>سابقه خدمت (سال): *</span>
                  </label>
                  <select
                    value={columnMap.experienceYears}
                    onChange={(e) =>
                      setColumnMap({ ...columnMap, experienceYears: e.target.value })
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="">-- انتخاب ستون سابقه خدمت --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Phone */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <label className="font-bold text-slate-700 block">شماره تماس (اختیاری):</label>
                  <select
                    value={columnMap.phone}
                    onChange={(e) => setColumnMap({ ...columnMap, phone: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                  >
                    <option value="">-- بدون ستون شماره تماس --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Notes */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <label className="font-bold text-slate-700 block">توضیحات (اختیاری):</label>
                  <select
                    value={columnMap.notes}
                    onChange={(e) => setColumnMap({ ...columnMap, notes: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
                  >
                    <option value="">-- بدون ستون توضیحات --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span>
                    به‌روزرسانی خودکار مشخصات همکاران موجود در صورت تطبیق کد ملی یا کد پرسنلی
                  </span>
                </label>

                <button
                  type="button"
                  onClick={analyzeRows}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <span>استخراج و پیش‌نمایش فهرست همکاران</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview Table */}
          {parsedRows.length > 0 && (
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    ۳
                  </span>
                  <span>
                    پیش‌نمایش داده‌های استخراج‌شده ({toPersianDigits(parsedRows.length)} همکار)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                    همکار جدید: {toPersianDigits(parsedRows.filter((r) => !r.isExisting).length)}
                  </span>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold">
                    به‌روزرسانی موجود:{' '}
                    {toPersianDigits(parsedRows.filter((r) => r.isExisting).length)}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-xs max-h-72 overflow-y-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-center w-10">#</th>
                      <th className="p-2 text-center w-16">کد کارتابل</th>
                      <th className="p-2">نام و نام خانوادگی</th>
                      <th className="p-2 text-center">کد ملی</th>
                      <th className="p-2 text-center">کد پرسنلی</th>
                      <th className="p-2">نام آموزشگاه</th>
                      <th className="p-2">مقطع</th>
                      <th className="p-2">سمت</th>
                      <th className="p-2 text-center">سابقه</th>
                      <th className="p-2 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-slate-50 ${
                          r.isExisting ? 'bg-blue-50/20' : 'bg-emerald-50/15'
                        }`}
                      >
                        <td className="p-2 text-center text-slate-400 font-mono font-bold">
                          {toPersianDigits(i + 1)}
                        </td>
                        <td className="p-2 text-center font-mono font-bold">
                          <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[11px]">
                            {r.assignedCode}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-slate-900">{r.fullName}</td>
                        <td className="p-2 text-center font-mono text-slate-700">
                          {r.nationalId || '---'}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-700">
                          {r.personnelCode || '---'}
                        </td>
                        <td className="p-2 text-slate-800">
                          {r.schoolName}
                          {r.willCreateSchool && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded mr-1">
                              مدرسه جدید
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-600">{r.grade}</td>
                        <td className="p-2 text-emerald-800 font-bold">{r.role}</td>
                        <td className="p-2 text-center font-mono font-bold text-amber-800">
                          {r.experienceYears !== '' ? `${toPersianDigits(r.experienceYears)} سال` : '---'}
                        </td>
                        <td className="p-2 text-center">
                          {r.isExisting ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                              به‌روزرسانی
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              ثبت جدید
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-500">
                  اطلاعات بالا بررسی شد و آماده انتقال نهایی به پایگاه داده سامانه می‌باشد.
                </p>
                <button
                  type="button"
                  onClick={handleCommit}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>تایید و ذخیره مشخصات همکاران</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            فایل بارگذاری‌شده به صورت محلی در مرورگر پردازش و در پایگاه داده ذخیره می‌شود.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
