import {
  AppDatabase,
  EmployeeStats,
  EmployeeProgram,
  Employee,
  Program,
  SchoolStats,
  ScopeDetailedStats,
  SYSTEM_DESIGNER_NAME,
  SYSTEM_DESIGNER_WEBSITE,
  SYSTEM_DESIGNER_PHONE,
} from '../types';
import { getInitialDatabase } from './sampleData';
import { getCurrentJalaliYear, updateJalaliDateToCurrentYear, toPersianDigits } from './jalali';

const STORAGE_KEY = 'parvareshi_app_db_v1';
const SNAPSHOTS_KEY = 'parvareshi_app_snapshots_v1';

// In-memory fallback cache when localStorage is unavailable or throws quota error
let memoryDatabaseCache: AppDatabase | null = null;

export interface SaveDatabaseResult {
  success: boolean;
  error?: string;
  bytesWritten?: number;
  verified: boolean;
  fallbackUsed?: boolean;
}

export interface StorageHealthInfo {
  isAvailable: boolean;
  usedBytes: number;
  usedFormatted: string;
  estimatedQuotaBytes: number;
  percentUsed: number;
  snapshotCount: number;
  lastSaveVerified: boolean;
  errorMessage?: string;
}

export function loadDatabase(): AppDatabase {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      if (memoryDatabaseCache) return memoryDatabaseCache;
      const initial = getInitialDatabase();
      saveDatabase(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed.employees || !parsed.programs || !parsed.employeePrograms) {
      const initial = getInitialDatabase();
      saveDatabase(initial);
      return initial;
    }

    const currentYear = getCurrentJalaliYear();

    // Normalize employeePrograms to have executionDate, submissionDate, and submissionPlatform
    if (Array.isArray(parsed.employeePrograms)) {
      parsed.employeePrograms = parsed.employeePrograms.map((ep: any) => {
        let execDate = ep.executionDate || ep.actualDate || undefined;
        let subDate = ep.submissionDate || ep.docSubmissionDate || (ep.actualDate ? ep.actualDate : undefined);
        let platform = ep.submissionPlatform || ep.documentationPlatform || ep.docPlatform;
        if (!platform && (ep.status === 'done' || ep.status === 'late')) {
          platform = 'ایتا';
        }

        if (execDate) execDate = updateJalaliDateToCurrentYear(execDate);
        if (subDate) subDate = updateJalaliDateToCurrentYear(subDate);

        return {
          ...ep,
          actualDate: execDate,
          executionDate: execDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          submissionPlatform: platform,
          documentationPlatform: platform,
        };
      });
    }

    // Normalize programs to include section and coefficient
    if (Array.isArray(parsed.programs)) {
      parsed.programs = parsed.programs.map((p: any) => {
        const rawCoeff = Number(p.coefficient);
        const coeff = ([1, 2, 3].includes(rawCoeff)) ? (rawCoeff as 1 | 2 | 3) : 1;

        // Ensure section is one of the 5 allowed:
        let sec = p.section;
        if (!sec) {
          const axisLower = (p.axis || '').toLowerCase();
          if (axisLower.includes('ابتدایی')) sec = 'آموزش ابتدایی';
          else if (axisLower.includes('متوسطه اول') || axisLower.includes('خوارزمی')) sec = 'آموزش متوسطه اول';
          else if (axisLower.includes('متوسطه دوم') || axisLower.includes('کنکور')) sec = 'آموزش متوسطه دوم';
          else if (axisLower.includes('ورزش') || axisLower.includes('بدنی') || axisLower.includes('المپیاد')) sec = 'تربیت بدنی';
          else sec = 'پرورشی';
        }

        return {
          ...p,
          section: sec,
          scope: p.scope === 'اختصاصی' ? 'اختصاصی' : 'همگانی',
          coefficient: coeff,
          startDate: p.startDate ? updateJalaliDateToCurrentYear(p.startDate) : p.startDate,
          deadline: p.deadline ? updateJalaliDateToCurrentYear(p.deadline) : p.deadline,
          executionDate: p.executionDate ? updateJalaliDateToCurrentYear(p.executionDate) : p.executionDate,
          submissionDate: p.submissionDate ? updateJalaliDateToCurrentYear(p.submissionDate) : p.submissionDate,
        };
      });
    }

    // Normalize employees
    if (Array.isArray(parsed.employees)) {
      parsed.employees = parsed.employees.map((emp: any) => {
        let updatedRole = emp.role;
        let customRole = emp.customRoleTitle;

        if (updatedRole === 'معاون پرورشی و تربیت بدنی') {
          updatedRole = 'معاون پرورشی';
        } else if (updatedRole === 'مدیر / سرپرست پرورشی') {
          updatedRole = 'مدیر';
        } else if (updatedRole === 'مربی امور تربیتی' || updatedRole === 'مشاور مدرسه' || updatedRole === 'رابط فرهنگی و اقامه نماز' || updatedRole === 'مراقب سلامت') {
          updatedRole = 'سایر';
          customRole = customRole || emp.role;
        }

        const personnelCode = emp.personnelCode || `2010${emp.code}`;
        const nationalId = emp.nationalId || (emp.nationalCode ? String(emp.nationalCode) : undefined);
        const experienceYears = emp.experienceYears !== undefined ? emp.experienceYears : (emp.experience ? emp.experience : undefined);

        return {
          ...emp,
          role: updatedRole,
          customRoleTitle: customRole,
          personnelCode,
          nationalId,
          experienceYears,
        };
      });
    }

    if (!parsed.settings) {
      parsed.settings = getInitialDatabase().settings;
    } else {
      if (
        !parsed.settings.officeTitle ||
        parsed.settings.officeTitle.includes('منطقه / شهرستان') ||
        parsed.settings.officeTitle.includes('منطقه ۵ تهران')
      ) {
        parsed.settings.officeTitle = 'اداره آموزش و پرورش ناحیه ۶ اصفهان';
      }
      parsed.settings.developerName = SYSTEM_DESIGNER_NAME;
      if (
        !parsed.settings.academicYear ||
        parsed.settings.academicYear.includes('1403') ||
        parsed.settings.academicYear.includes('۱۴۰۳')
      ) {
        const nextYear = String(Number(currentYear) + 1);
        parsed.settings.academicYear = `سال تحصیلی ${toPersianDigits(currentYear)}-${toPersianDigits(nextYear)}`;
      }
    }
    saveDatabase(parsed);
    return parsed;
  } catch (err) {
    console.error('Error loading database from localStorage:', err);
    return getInitialDatabase();
  }
}

export interface LocalDatabaseSnapshot {
  id: string;
  createdAt: string;
  label: string;
  employeeCount: number;
  programCount: number;
  schoolCount: number;
  assignmentCount: number;
  db: AppDatabase;
}

export function saveLocalSnapshot(db: AppDatabase, label: string = 'پشتیبان خودکار'): LocalDatabaseSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    const existing: LocalDatabaseSnapshot[] = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const newSnapshot: LocalDatabaseSnapshot = {
      id: `snap_${Date.now()}`,
      createdAt: `${now.toLocaleDateString('fa-IR')} ساعت ${now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
      label,
      employeeCount: db.employees?.length || 0,
      programCount: db.programs?.length || 0,
      schoolCount: db.schools?.length || 0,
      assignmentCount: db.employeePrograms?.length || 0,
      db: JSON.parse(JSON.stringify(db)),
    };
    const updated = [newSnapshot, ...existing].slice(0, 10);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save local snapshot:', e);
    return [];
  }
}

export function getLocalSnapshots(): LocalDatabaseSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function restoreLocalSnapshot(snapshotId: string): AppDatabase | null {
  const snapshots = getLocalSnapshots();
  const found = snapshots.find((s) => s.id === snapshotId);
  if (!found) return null;
  saveDatabase(found.db);
  return found.db;
}

export function deleteLocalSnapshot(snapshotId: string): LocalDatabaseSnapshot[] {
  const snapshots = getLocalSnapshots().filter((s) => s.id !== snapshotId);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
  return snapshots;
}

export interface BackupInspectionResult {
  isValid: boolean;
  error?: string;
  employeesCount: number;
  programsCount: number;
  schoolsCount: number;
  assignmentsCount: number;
  officeTitle: string;
  academicYear: string;
}

export function inspectBackupJson(jsonString: string): BackupInspectionResult {
  try {
    let parsed = JSON.parse(jsonString.trim());
    if (parsed.database && typeof parsed.database === 'object') parsed = parsed.database;
    else if (parsed.db && typeof parsed.db === 'object') parsed = parsed.db;

    const employees = parsed.employees || parsed.colleagues || parsed.staff || [];
    const programs = parsed.programs || parsed.plans || parsed.tarhha || [];
    const employeePrograms = parsed.employeePrograms || parsed.assignments || parsed.tarhayeEjraei || [];
    const schools = parsed.schools || parsed.madares || [];

    if (!Array.isArray(employees) && !Array.isArray(programs)) {
      return {
        isValid: false,
        error: 'فایل فاقد ساختار آرایه همکاران یا طرح‌ها می‌باشد.',
        employeesCount: 0,
        programsCount: 0,
        schoolsCount: 0,
        assignmentsCount: 0,
        officeTitle: '',
        academicYear: '',
      };
    }

    return {
      isValid: true,
      employeesCount: Array.isArray(employees) ? employees.length : 0,
      programsCount: Array.isArray(programs) ? programs.length : 0,
      schoolsCount: Array.isArray(schools) ? schools.length : 0,
      assignmentsCount: Array.isArray(employeePrograms) ? employeePrograms.length : 0,
      officeTitle: parsed.settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان',
      academicYear: parsed.settings?.academicYear || 'سال تحصیلی جاری',
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: 'فرمت داده‌های JSON نامعتبر است: ' + err.message,
      employeesCount: 0,
      programsCount: 0,
      schoolsCount: 0,
      assignmentsCount: 0,
      officeTitle: '',
      academicYear: '',
    };
  }
}

export function saveDatabase(db: AppDatabase): SaveDatabaseResult {
  if (!db || typeof db !== 'object') {
    return {
      success: false,
      error: 'ساختار پایگاه داده نامعتبر یا تهی است.',
      verified: false,
    };
  }

  // Integrity safeguard: check essential tables
  if (!Array.isArray(db.employees) || !Array.isArray(db.programs) || !Array.isArray(db.schools) || !Array.isArray(db.employeePrograms)) {
    return {
      success: false,
      error: 'آرایه‌های اصلی پایگاه داده (همکاران، طرح‌ها، مدارس یا تکالیف) مفقود یا نامعتبر هستند.',
      verified: false,
    };
  }

  try {
    if (db.settings) {
      db.settings.developerName = SYSTEM_DESIGNER_NAME;
      db.settings.developerWebsite = SYSTEM_DESIGNER_WEBSITE;
      db.settings.developerPhone = SYSTEM_DESIGNER_PHONE;
    }

    const serialized = JSON.stringify(db);
    // Keep in-memory cache updated as instant fallback
    try {
      memoryDatabaseCache = JSON.parse(serialized);
    } catch {
      memoryDatabaseCache = db;
    }

    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        success: true,
        verified: true,
        fallbackUsed: true,
        bytesWritten: new Blob([serialized]).size,
      };
    }

    // Write to localStorage
    localStorage.setItem(STORAGE_KEY, serialized);

    // CRITICAL: Explicit read-back verification to guarantee data integrity
    const readBack = localStorage.getItem(STORAGE_KEY);
    if (!readBack || readBack.length !== serialized.length) {
      return {
        success: false,
        error: 'اعتبارسنجی ذخیره‌سازی ناموفق بود؛ داده‌های خوانده‌شده با داده‌های ذخیره‌شده همخوانی ندارند.',
        verified: false,
      };
    }

    return {
      success: true,
      bytesWritten: new Blob([serialized]).size,
      verified: true,
    };
  } catch (err: any) {
    console.error('Error saving database to localStorage:', err);
    let errorMsg = 'خطای نامشخص در ذخیره‌سازی داده‌ها در حافظه مرورگر.';

    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.number === -2147024882 ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

    if (isQuota) {
      errorMsg = 'حافظه ذخیره‌سازی مرورگر (LocalStorage) پر شده است.';
      // Automatic self-healing: prune old snapshots to recover storage quota
      try {
        const rawSnaps = localStorage.getItem(SNAPSHOTS_KEY);
        if (rawSnaps) {
          const snaps = JSON.parse(rawSnaps);
          if (Array.isArray(snaps) && snaps.length > 2) {
            localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(0, 2)));
            // Retry saving
            const serialized = JSON.stringify(db);
            localStorage.setItem(STORAGE_KEY, serialized);
            const verified = localStorage.getItem(STORAGE_KEY) === serialized;
            if (verified) {
              return {
                success: true,
                bytesWritten: new Blob([serialized]).size,
                verified: true,
                error: 'حافظه مرورگر فشرده‌سازی شد و داده‌ها با موفقیت تثبیت شدند.',
              };
            }
          }
        }
      } catch (pruneErr) {
        console.warn('Auto-pruning snapshots failed to recover quota:', pruneErr);
      }
    } else if (err?.message) {
      errorMsg = `خطای دسترسی به حافظه: ${err.message}`;
    }

    return {
      success: false,
      error: errorMsg,
      verified: false,
      fallbackUsed: true,
    };
  }
}

/**
 * بررسی وضعیت سلامت و مصرف حافظه محلی
 */
export function getStorageHealthInfo(): StorageHealthInfo {
  let isAvailable = false;
  let usedBytes = 0;
  let snapshotCount = 0;
  let errorMessage: string | undefined;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const testKey = '__test_storage_integrity__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      isAvailable = true;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || '';
          usedBytes += (key.length + val.length) * 2; // UTF-16 bytes
        }
      }

      const rawSnaps = localStorage.getItem(SNAPSHOTS_KEY);
      if (rawSnaps) {
        const parsed = JSON.parse(rawSnaps);
        snapshotCount = Array.isArray(parsed) ? parsed.length : 0;
      }
    }
  } catch (err: any) {
    isAvailable = false;
    errorMessage = err?.message || 'دسترسی به LocalStorage محدود است.';
  }

  const estimatedQuotaBytes = 5 * 1024 * 1024; // 5 MB standard
  const percentUsed = Math.min(100, Math.round((usedBytes / estimatedQuotaBytes) * 100));
  const kb = Math.round(usedBytes / 1024);
  const usedFormatted = kb > 1024 ? `${(kb / 1024).toFixed(2)} مگابایت` : `${toPersianDigits(kb)} کیلوبایت`;

  return {
    isAvailable,
    usedBytes,
    usedFormatted,
    estimatedQuotaBytes,
    percentUsed,
    snapshotCount,
    lastSaveVerified: isAvailable,
    errorMessage,
  };
}

/**
 * بررسی و ترمیم خودکار جامعیت پیوندهای پایگاه داده
 */
export function verifyAndRepairDatabase(db: AppDatabase): { repairedDb: AppDatabase; repairs: string[] } {
  const repairs: string[] = [];
  const empIds = new Set(db.employees.map((e) => e.id));
  const prgIds = new Set(db.programs.map((p) => p.id));
  const schIds = new Set(db.schools.map((s) => s.id));

  // 1. Remove dangling employeePrograms whose employee or program no longer exists
  const initialEpCount = db.employeePrograms.length;
  const validEp = db.employeePrograms.filter((ep) => {
    const hasEmp = empIds.has(ep.employeeId);
    const hasPrg = prgIds.has(ep.programId);
    return hasEmp && hasPrg;
  });

  if (validEp.length < initialEpCount) {
    const removedCount = initialEpCount - validEp.length;
    repairs.push(`${toPersianDigits(removedCount)} رکورد ارزیابی معلق (فاقد همکار یا طرح معتبر) پاکسازی شد.`);
  }

  // 2. Ensure each employee has valid school name matching schoolId
  const schMap = new Map(db.schools.map((s) => [s.id, s]));
  const repairedEmployees = db.employees.map((emp) => {
    const sch = schMap.get(emp.schoolId);
    if (sch && sch.name !== emp.schoolName) {
      repairs.push(`نام آموزشگاه برای همکار «${emp.fullName}» اصلاح شد.`);
      return { ...emp, schoolName: sch.name, grade: sch.grade };
    }
    return emp;
  });

  return {
    repairedDb: {
      ...db,
      employees: repairedEmployees,
      employeePrograms: validEp,
    },
    repairs,
  };
}

export function exportDatabaseAsJson(db: AppDatabase): void {
  // Save an automatic local snapshot before user downloads
  saveLocalSnapshot(db, 'پشتیبان‌گیری دستی (دانلود فایل)');
  const jsonStr = JSON.stringify(db, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  link.download = `backup_parvareshi_isfahan6_${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importDatabaseFromJson(jsonString: string): AppDatabase {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString.trim());
  } catch (e: any) {
    throw new Error('متن یا فایل وارد شده ساختار معتبر JSON ندارد: ' + e.message);
  }

  if (parsed.database && typeof parsed.database === 'object') {
    parsed = parsed.database;
  } else if (parsed.db && typeof parsed.db === 'object') {
    parsed = parsed.db;
  }

  const employees = parsed.employees || parsed.colleagues || parsed.staff || [];
  const programs = parsed.programs || parsed.plans || parsed.tarhha || [];
  const employeePrograms = parsed.employeePrograms || parsed.assignments || parsed.tarhayeEjraei || [];
  const schools = parsed.schools || parsed.madares || [];

  if (!Array.isArray(employees) && !Array.isArray(programs)) {
    throw new Error('فایل انتخاب شده معتبر نیست یا مشخصات همکاران و طرح‌ها در آن یافت نشد.');
  }

  const defaultDb = getInitialDatabase();

  const normalizedEmployeePrograms = (Array.isArray(employeePrograms) ? employeePrograms : []).map((ep: any, idx: number) => {
    const execDate = ep.executionDate || ep.actualDate || undefined;
    const subDate = ep.submissionDate || ep.docSubmissionDate || execDate;
    let platform = ep.submissionPlatform || ep.documentationPlatform || ep.docPlatform;
    if (!platform && (ep.status === 'done' || ep.status === 'late')) {
      platform = 'ایتا';
    }
    return {
      id: ep.id || `ep_imported_${idx + 1}`,
      employeeId: ep.employeeId || '',
      employeeCode: ep.employeeCode || '',
      programId: ep.programId || '',
      status: ep.status || 'not_done',
      isManualOverride: ep.isManualOverride ?? false,
      actualDate: execDate,
      executionDate: execDate,
      submissionDate: subDate,
      docSubmissionDate: subDate,
      submissionPlatform: platform,
      documentationPlatform: platform,
      notes: ep.notes || '',
      documentationNotes: ep.documentationNotes || '',
      updatedAt: ep.updatedAt || '1403/10/01',
    };
  });

  const normalizedPrograms = (Array.isArray(programs) && programs.length > 0 ? programs : defaultDb.programs).map((p: any) => {
    const rawCoeff = Number(p.coefficient);
    const coeff = ([1, 2, 3].includes(rawCoeff)) ? (rawCoeff as 1 | 2 | 3) : 1;
    let sec = p.section;
    if (!sec) {
      const axisLower = (p.axis || '').toLowerCase();
      if (axisLower.includes('ابتدایی')) sec = 'آموزش ابتدایی';
      else if (axisLower.includes('متوسطه اول')) sec = 'آموزش متوسطه اول';
      else if (axisLower.includes('متوسطه دوم')) sec = 'آموزش متوسطه دوم';
      else if (axisLower.includes('ورزش') || axisLower.includes('بدنی')) sec = 'تربیت بدنی';
      else sec = 'پرورشی';
    }
    return {
      ...p,
      section: sec,
      scope: p.scope === 'اختصاصی' ? 'اختصاصی' : 'همگانی',
      coefficient: coeff,
    };
  });

  const validDb: AppDatabase = {
    employees: Array.isArray(employees) && employees.length > 0 ? employees : defaultDb.employees,
    schools: Array.isArray(schools) && schools.length > 0 ? schools : defaultDb.schools,
    programs: normalizedPrograms,
    employeePrograms: normalizedEmployeePrograms.length > 0 ? normalizedEmployeePrograms : defaultDb.employeePrograms,
    settings: {
      ...defaultDb.settings,
      ...(parsed.settings || {}),
      officeTitle: 'اداره آموزش و پرورش ناحیه ۶ اصفهان',
      developerName: SYSTEM_DESIGNER_NAME,
      developerWebsite: SYSTEM_DESIGNER_WEBSITE,
      developerPhone: SYSTEM_DESIGNER_PHONE,
    },
    version: parsed.version || 1,
  };

  // Snapshot before overwriting
  saveLocalSnapshot(validDb, 'بازیابی از فایل JSON');
  saveDatabase(validDb);
  return validDb;
}

export function resetDatabaseToDefault(): AppDatabase {
  const initial = getInitialDatabase();
  saveLocalSnapshot(initial, 'بازگردانی به پیش‌فرض کارخانه');
  saveDatabase(initial);
  return initial;
}

export function normalizePersianText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * محاسبه امتیاز و آمار همکاران بر اساس برنامه‌های همگانی با ضرایب ۱ تا ۳
 */
export function calculateEmployeeStats(
  employeeId: string,
  allEmployeePrograms: EmployeeProgram[],
  allPrograms?: Program[],
): EmployeeStats {
  const prgMap = new Map((allPrograms || []).map((p) => [p.id, p]));
  let assignments = allEmployeePrograms.filter((ep) => ep.employeeId === employeeId);

  // Filter out اختصاصی programs for official ranking score
  if (allPrograms && allPrograms.length > 0) {
    assignments = assignments.filter((ep) => {
      const prg = prgMap.get(ep.programId);
      return !prg || prg.scope !== 'اختصاصی';
    });
  }

  const total = assignments.length;
  if (total === 0) {
    return {
      total: 0,
      done: 0,
      late: 0,
      notDone: 0,
      progressPercent: 0,
      onTimePercent: 0,
      totalWeightedPossible: 0,
      earnedWeightedScore: 0,
      weightedProgressPercent: 0,
      totalCoefficients: 0,
    };
  }

  const done = assignments.filter((a) => a.status === 'done').length;
  const late = assignments.filter((a) => a.status === 'late').length;
  const notDone = assignments.filter((a) => a.status === 'not_done').length;

  const progressPercent = Math.round(((done + late) / total) * 100);
  const onTimePercent = Math.round((done / total) * 100);

  let totalCoefficients = 0;
  let totalWeightedPossible = 0;
  let earnedWeightedScore = 0;

  for (const a of assignments) {
    const prg = prgMap.get(a.programId);
    const coeff = (prg?.coefficient && [1, 2, 3].includes(prg.coefficient)) ? prg.coefficient : 1;
    totalCoefficients += coeff;
    totalWeightedPossible += coeff * 100;

    if (a.status === 'done') {
      earnedWeightedScore += coeff * 100;
    } else if (a.status === 'late') {
      earnedWeightedScore += coeff * 60;
    }
  }

  const weightedProgressPercent =
    totalWeightedPossible > 0
      ? Number(((earnedWeightedScore / totalWeightedPossible) * 100).toFixed(1))
      : 0;

  return {
    total,
    done,
    late,
    notDone,
    progressPercent,
    onTimePercent,
    totalWeightedPossible,
    earnedWeightedScore,
    weightedProgressPercent,
    totalCoefficients,
  };
}

/**
 * آمار مجزا و تفکیک‌شده برای «طرح‌های همگانی» و «طرح‌های اختصاصی»
 * جهت نمایش دو نمودار دایره‌ای مجزا در کارتابل همکار
 */
export function calculateEmployeeDualScopeStats(
  employeeId: string,
  allEmployeePrograms: EmployeeProgram[],
  allPrograms: Program[],
) {
  const prgMap = new Map(allPrograms.map((p) => [p.id, p]));
  const allEmpAssignments = allEmployeePrograms.filter((ep) => ep.employeeId === employeeId);

  const general = allEmpAssignments.filter((ep) => {
    const prg = prgMap.get(ep.programId);
    return !prg || prg.scope !== 'اختصاصی';
  });

  const specific = allEmpAssignments.filter((ep) => {
    const prg = prgMap.get(ep.programId);
    return prg?.scope === 'اختصاصی';
  });

  const buildScopeStats = (items: EmployeeProgram[]): ScopeDetailedStats => {
    const total = items.length;
    const done = items.filter((a) => a.status === 'done').length;
    const late = items.filter((a) => a.status === 'late').length;
    const notDone = items.filter((a) => a.status === 'not_done').length;
    const progressPercent = total > 0 ? Math.round(((done + late) / total) * 100) : 0;
    const onTimePercent = total > 0 ? Math.round((done / total) * 100) : 0;

    let earnedWeightedScore = 0;
    for (const a of items) {
      const prg = prgMap.get(a.programId);
      const coeff = (prg?.coefficient && [1, 2, 3].includes(prg.coefficient)) ? prg.coefficient : 1;
      if (a.status === 'done') earnedWeightedScore += coeff * 100;
      else if (a.status === 'late') earnedWeightedScore += coeff * 60;
    }

    return {
      total,
      done,
      late,
      notDone,
      progressPercent,
      onTimePercent,
      earnedWeightedScore,
    };
  };

  const generalStats = buildScopeStats(general);
  const specificStats = buildScopeStats(specific);

  return {
    general: generalStats,
    specific: specificStats,
    totalCount: allEmpAssignments.length,
    officialScore: generalStats.earnedWeightedScore,
  };
}

export function calculateSchoolStats(
  schoolId: string,
  employees: Employee[],
  allEmployeePrograms: EmployeeProgram[],
  allPrograms?: Program[],
): SchoolStats {
  const prgMap = new Map((allPrograms || []).map((p) => [p.id, p]));
  const schoolEmployees = employees.filter((e) => e.schoolId === schoolId);
  const empIds = new Set(schoolEmployees.map((e) => e.id));
  const assignments = allEmployeePrograms.filter((ep) => empIds.has(ep.employeeId));

  const totalPrograms = assignments.length;
  const done = assignments.filter((a) => a.status === 'done').length;
  const late = assignments.filter((a) => a.status === 'late').length;
  const notDone = assignments.filter((a) => a.status === 'not_done').length;

  const progressPercent = totalPrograms > 0 ? Math.round(((done + late) / totalPrograms) * 100) : 0;
  const onTimePercent = totalPrograms > 0 ? Math.round((done / totalPrograms) * 100) : 0;

  let totalWeightedPossible = 0;
  let earnedWeightedScore = 0;

  for (const a of assignments) {
    const prg = prgMap.get(a.programId);
    const coeff = (prg?.coefficient && [1, 2, 3].includes(prg.coefficient)) ? prg.coefficient : 1;
    totalWeightedPossible += coeff * 100;
    if (a.status === 'done') {
      earnedWeightedScore += coeff * 100;
    } else if (a.status === 'late') {
      earnedWeightedScore += coeff * 60;
    }
  }

  const weightedProgressPercent =
    totalWeightedPossible > 0
      ? Number(((earnedWeightedScore / totalWeightedPossible) * 100).toFixed(1))
      : 0;

  const averageStaffScore =
    schoolEmployees.length > 0 ? Math.round(earnedWeightedScore / schoolEmployees.length) : 0;

  return {
    staffCount: schoolEmployees.length,
    totalPrograms,
    done,
    late,
    notDone,
    progressPercent,
    onTimePercent,
    totalWeightedPossible,
    earnedWeightedScore,
    weightedProgressPercent,
    averageStaffScore,
  };
}

export function calculateProgramStats(programId: string, allEmployeePrograms: EmployeeProgram[]) {
  const assignments = allEmployeePrograms.filter((ep) => ep.programId === programId);
  const totalAssigned = assignments.length;
  const done = assignments.filter((a) => a.status === 'done').length;
  const late = assignments.filter((a) => a.status === 'late').length;
  const notDone = assignments.filter((a) => a.status === 'not_done').length;

  const progressPercent = totalAssigned > 0 ? Math.round(((done + late) / totalAssigned) * 100) : 0;
  const onTimePercent = totalAssigned > 0 ? Math.round((done / totalAssigned) * 100) : 0;

  return {
    totalAssigned,
    done,
    late,
    notDone,
    progressPercent,
    onTimePercent,
  };
}

export function calculateOverallStats(
  employees: Employee[],
  allEmployeePrograms: EmployeeProgram[],
) {
  const totalEmployees = employees.length;
  const totalAssignments = allEmployeePrograms.length;
  const done = allEmployeePrograms.filter((a) => a.status === 'done').length;
  const late = allEmployeePrograms.filter((a) => a.status === 'late').length;
  const notDone = allEmployeePrograms.filter((a) => a.status === 'not_done').length;

  const progressPercent =
    totalAssignments > 0 ? Math.round(((done + late) / totalAssignments) * 100) : 0;
  const onTimePercent =
    totalAssignments > 0 ? Math.round((done / totalAssignments) * 100) : 0;

  return {
    totalEmployees,
    totalAssignments,
    done,
    late,
    notDone,
    progressPercent,
    onTimePercent,
  };
}
