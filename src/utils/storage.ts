import { AppDatabase, EmployeeStats, EmployeeProgram, Employee, Program, SchoolStats, ScopeDetailedStats } from '../types';
import { getInitialDatabase } from './sampleData';
import { getCurrentJalaliYear, updateJalaliDateToCurrentYear, toPersianDigits } from './jalali';

const STORAGE_KEY = 'parvareshi_app_db_v1';

export function loadDatabase(): AppDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
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

        return {
          ...emp,
          role: updatedRole,
          customRoleTitle: customRole,
          personnelCode,
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
      if (!parsed.settings.developerName) {
        parsed.settings.developerName = 'علیرضا شریعتی';
      }
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

export function saveDatabase(db: AppDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Error saving database to localStorage:', err);
  }
}

export function exportDatabaseAsJson(db: AppDatabase): void {
  const jsonStr = JSON.stringify(db, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  link.download = `parvareshi_backup_${timestamp}.json`;
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
      developerName: 'علیرضا شریعتی',
    },
    version: parsed.version || 1,
  };

  saveDatabase(validDb);
  return validDb;
}

export function resetDatabaseToDefault(): AppDatabase {
  const initial = getInitialDatabase();
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
