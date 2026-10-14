import * as XLSX from 'xlsx';
import {
  ProgramSection,
  PROGRAM_SECTIONS,
  ExecutionStatus,
  SystemSettings,
  SYSTEM_DESIGNER_NAME,
} from '../types';
import { normalizePersianText } from './storage';
import { toPersianDigits, getCurrentJalaliDate, padZero } from './jalali';

export interface SectionParsedRecord {
  employeeCode?: string;
  personnelCode?: string;
  nationalId?: string;
  fullName: string;
  schoolName: string;
  grade?: string;
  role?: string;
  programTitle: string;
  coefficient: number;
  status: ExecutionStatus;
  executionDate?: string;
  notes?: string;
  earnedScore: number;
  maxScore: number;
}

export interface SectionFileImport {
  section: ProgramSection;
  fileName: string;
  sheetName: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  colleaguesCount: number;
  programsCount: number;
  records: SectionParsedRecord[];
}

export interface ColleagueSectionScore {
  totalTasks: number;
  doneTasks: number;
  lateTasks: number;
  notDoneTasks: number;
  earnedScore: number;
  maxScore: number;
  progressPercent: number;
}

export interface MergedColleague {
  key: string;
  fullName: string;
  nationalId?: string;
  personnelCode?: string;
  employeeCode?: string;
  schoolName: string;
  grade: string;
  role: string;
  sectionScores: Record<ProgramSection, ColleagueSectionScore>;
  includedSectionsCount: number;
  totalTasks: number;
  totalDone: number;
  totalLate: number;
  totalNotDone: number;
  totalEarnedScore: number;
  totalMaxScore: number;
  overallScorePercent: number;
  overallProgressPercent: number;
  rank?: number;
}

export interface MergedSchool {
  schoolName: string;
  grade: string;
  staffCount: number;
  sectionAverages: Record<ProgramSection, number>;
  totalEarnedScore: number;
  averageScorePerColleague: number;
  overallProgressPercent: number;
  rank?: number;
}

export interface SectionOverviewStat {
  section: ProgramSection;
  hasFile: boolean;
  fileName?: string;
  totalTasks: number;
  doneTasks: number;
  lateTasks: number;
  notDoneTasks: number;
  progressPercent: number;
  averageScore: number;
  colleaguesCount: number;
}

export interface ConsolidatedReportResult {
  generatedAt: string;
  sectionsCount: number;
  sectionsList: ProgramSection[];
  colleagues: MergedColleague[];
  schools: MergedSchool[];
  sectionStats: Record<ProgramSection, SectionOverviewStat>;
  totalColleagues: number;
  totalSchools: number;
  totalTasksAllSections: number;
  overallAverageScore: number;
  overallAverageProgress: number;
  topColleague?: MergedColleague;
  topSchool?: MergedSchool;
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

/**
 * Parses an Excel worksheet for a specific section
 */
export function parseSectionWorksheet(
  ws: XLSX.WorkSheet,
  section: ProgramSection,
  fileName: string,
  sheetName: string,
): SectionFileImport {
  const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (json.length === 0) {
    return {
      section,
      fileName,
      sheetName,
      uploadedAt: getCurrentJalaliDate(),
      totalRows: 0,
      validRows: 0,
      colleaguesCount: 0,
      programsCount: 0,
      records: [],
    };
  }

  // Find header row (search first 6 rows)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(json.length, 6); i++) {
    if (json[i].some((cell) => cell !== '')) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaders = json[headerRowIdx].map((c: any) => String(c || '').trim());
  const dataRows = json.slice(headerRowIdx + 1).filter((r) => r.some((c: any) => c !== ''));

  // Detect column indices
  let nationalIdCol = -1;
  let personnelCol = -1;
  let codeCol = -1;
  let nameCol = -1;
  let firstNameCol = -1;
  let lastNameCol = -1;
  let schoolCol = -1;
  let gradeCol = -1;
  let roleCol = -1;
  let programTitleCol = -1;
  let coeffCol = -1;
  let statusCol = -1;
  let dateCol = -1;
  let notesCol = -1;

  rawHeaders.forEach((h, idx) => {
    const norm = normalizePersianText(h);
    if (
      norm.includes('کد ملی') ||
      norm.includes('کدملی') ||
      norm.includes('شناسه ملی') ||
      norm.includes('شماره ملی') ||
      norm.includes('national')
    ) {
      if (nationalIdCol === -1) nationalIdCol = idx;
    } else if (
      norm.includes('پرسنلی') ||
      norm.includes('استخدامی') ||
      norm.includes('کارمندی') ||
      norm.includes('personnel')
    ) {
      if (personnelCol === -1) personnelCol = idx;
    } else if (
      (norm.includes('کد') && norm.includes('همکار')) ||
      norm.includes('کد کارتابل') ||
      norm === 'کد'
    ) {
      if (codeCol === -1) codeCol = idx;
    } else if (
      (norm.includes('نام') && norm.includes('خانوادگی')) ||
      norm.includes('نام همکار') ||
      norm === 'نام و نشان'
    ) {
      if (nameCol === -1) nameCol = idx;
    } else if (norm === 'نام' || norm === 'نام کوچک') {
      if (firstNameCol === -1) firstNameCol = idx;
    } else if (norm === 'نام خانوادگی' || norm === 'فامیلی' || norm === 'شهرت') {
      if (lastNameCol === -1) lastNameCol = idx;
    } else if (
      norm.includes('آموزشگاه') ||
      norm.includes('مدرسه') ||
      norm.includes('واحد آموزشی') ||
      norm.includes('محل خدمت') ||
      norm.includes('school')
    ) {
      if (schoolCol === -1) schoolCol = idx;
    } else if (
      norm.includes('مقطع') ||
      norm.includes('دوره') ||
      norm.includes('پایه') ||
      norm.includes('grade')
    ) {
      if (gradeCol === -1) gradeCol = idx;
    } else if (
      norm.includes('سمت') ||
      norm.includes('پست') ||
      norm.includes('نقش') ||
      norm.includes('شغل') ||
      norm.includes('role')
    ) {
      if (roleCol === -1) roleCol = idx;
    } else if (
      norm.includes('طرح') ||
      norm.includes('برنامه') ||
      norm.includes('فعالیت') ||
      norm.includes('عنوان')
    ) {
      if (programTitleCol === -1) programTitleCol = idx;
    } else if (norm.includes('ضریب') || norm.includes('وزن') || norm.includes('coeff')) {
      if (coeffCol === -1) coeffCol = idx;
    } else if (
      norm.includes('وضعیت') ||
      norm.includes('نتیجه') ||
      norm.includes('اجرا') ||
      norm.includes('status')
    ) {
      if (statusCol === -1) statusCol = idx;
    } else if (norm.includes('تاریخ') || norm.includes('زمان') || norm.includes('مهلت')) {
      if (dateCol === -1) dateCol = idx;
    } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('مستند')) {
      if (notesCol === -1) notesCol = idx;
    }
  });

  const records: SectionParsedRecord[] = [];
  const uniqueColleagueKeys = new Set<string>();
  const uniquePrograms = new Set<string>();

  dataRows.forEach((row) => {
    const getVal = (idx: number) => (idx !== -1 && row[idx] !== undefined ? String(row[idx]).trim() : '');

    const nationalId = cleanDigits(getVal(nationalIdCol));
    const personnelCode = cleanDigits(getVal(personnelCol));
    const employeeCode = cleanDigits(getVal(codeCol));

    let fullName = getVal(nameCol);
    if (!fullName && (firstNameCol !== -1 || lastNameCol !== -1)) {
      const fn = getVal(firstNameCol);
      const ln = getVal(lastNameCol);
      fullName = `${fn} ${ln}`.trim();
    }

    const schoolName = getVal(schoolCol) || 'آموزشگاه نامشخص';
    const grade = getVal(gradeCol) || 'متوسطه اول';
    const role = getVal(roleCol) || 'معاون';
    const programTitle = getVal(programTitleCol) || `طرح حوزه ${section}`;

    const rawStatus = getVal(statusCol);
    const rawCoeff = getVal(coeffCol);
    const date = getVal(dateCol);
    const notes = getVal(notesCol);

    if (!fullName && !nationalId && !personnelCode) {
      return; // Skip empty row
    }

    // Resolve status
    let status: ExecutionStatus = 'done';
    const normStat = normalizePersianText(rawStatus);
    if (
      normStat.includes('تاخیر') ||
      normStat.includes('دیر') ||
      normStat.includes('late')
    ) {
      status = 'late';
    } else if (
      normStat.includes('نشده') ||
      normStat.includes('عدم') ||
      normStat.includes('نقص') ||
      normStat.includes('not') ||
      normStat.includes('صفر') ||
      normStat === '۰'
    ) {
      status = 'not_done';
    } else if (
      normStat.includes('شده') ||
      normStat.includes('بله') ||
      normStat.includes('کامل') ||
      normStat.includes('done') ||
      normStat === '۱۰۰'
    ) {
      status = 'done';
    }

    // Resolve coefficient (1 to 3)
    let coefficient = 1;
    if (rawCoeff) {
      const parsedCoeff = parseInt(cleanDigits(rawCoeff), 10);
      if (parsedCoeff >= 1 && parsedCoeff <= 3) {
        coefficient = parsedCoeff;
      }
    }

    const maxScore = coefficient * 100;
    let earnedScore = 0;
    if (status === 'done') {
      earnedScore = maxScore;
    } else if (status === 'late') {
      earnedScore = coefficient * 60;
    }

    const collKey = nationalId || personnelCode || fullName;
    uniqueColleagueKeys.add(collKey);
    uniquePrograms.add(programTitle);

    records.push({
      employeeCode,
      personnelCode,
      nationalId,
      fullName: fullName || 'همکار ارجمند',
      schoolName,
      grade,
      role,
      programTitle,
      coefficient,
      status,
      executionDate: date,
      notes,
      earnedScore,
      maxScore,
    });
  });

  return {
    section,
    fileName,
    sheetName,
    uploadedAt: getCurrentJalaliDate(),
    totalRows: dataRows.length,
    validRows: records.length,
    colleaguesCount: uniqueColleagueKeys.size,
    programsCount: uniquePrograms.size,
    records,
  };
}

/**
 * Merges/Mixes parsed reports from multiple sections into a single Consolidated Master Report
 */
export function mergeSectionReports(
  sectionImports: Partial<Record<ProgramSection, SectionFileImport>>,
  settings?: SystemSettings,
): ConsolidatedReportResult {
  const activeSections = PROGRAM_SECTIONS.filter((sec) => Boolean(sectionImports[sec]?.records?.length));

  // Map colleagues by key (nationalId -> personnelCode -> normalized fullName)
  const colleaguesMap = new Map<string, MergedColleague>();
  const schoolsMap = new Map<string, MergedSchool>();

  const initSectionScore = (): ColleagueSectionScore => ({
    totalTasks: 0,
    doneTasks: 0,
    lateTasks: 0,
    notDoneTasks: 0,
    earnedScore: 0,
    maxScore: 0,
    progressPercent: 0,
  });

  PROGRAM_SECTIONS.forEach((section) => {
    const importData = sectionImports[section];
    if (!importData || !importData.records.length) return;

    importData.records.forEach((rec) => {
      // Find matching colleague
      const normName = normalizePersianText(rec.fullName);
      let matchKey = '';

      if (rec.nationalId && colleaguesMap.has(`nid_${rec.nationalId}`)) {
        matchKey = `nid_${rec.nationalId}`;
      } else if (rec.personnelCode && colleaguesMap.has(`pid_${rec.personnelCode}`)) {
        matchKey = `pid_${rec.personnelCode}`;
      } else if (colleaguesMap.has(`name_${normName}`)) {
        matchKey = `name_${normName}`;
      } else {
        // Create new key
        if (rec.nationalId) matchKey = `nid_${rec.nationalId}`;
        else if (rec.personnelCode) matchKey = `pid_${rec.personnelCode}`;
        else matchKey = `name_${normName}`;
      }

      let colleague = colleaguesMap.get(matchKey);
      if (!colleague) {
        colleague = {
          key: matchKey,
          fullName: rec.fullName,
          nationalId: rec.nationalId,
          personnelCode: rec.personnelCode,
          employeeCode: rec.employeeCode,
          schoolName: rec.schoolName,
          grade: rec.grade || 'متوسطه اول',
          role: rec.role || 'معاون',
          sectionScores: {
            'پرورشی': initSectionScore(),
            'آموزش ابتدایی': initSectionScore(),
            'آموزش متوسطه اول': initSectionScore(),
            'آموزش متوسطه دوم': initSectionScore(),
            'تربیت بدنی': initSectionScore(),
          },
          includedSectionsCount: 0,
          totalTasks: 0,
          totalDone: 0,
          totalLate: 0,
          totalNotDone: 0,
          totalEarnedScore: 0,
          totalMaxScore: 0,
          overallScorePercent: 0,
          overallProgressPercent: 0,
        };
        colleaguesMap.set(matchKey, colleague);
      } else {
        // Update complementary fields if missing
        if (!colleague.nationalId && rec.nationalId) colleague.nationalId = rec.nationalId;
        if (!colleague.personnelCode && rec.personnelCode) colleague.personnelCode = rec.personnelCode;
        if (!colleague.employeeCode && rec.employeeCode) colleague.employeeCode = rec.employeeCode;
        if (rec.schoolName && colleague.schoolName === 'آموزشگاه نامشخص') colleague.schoolName = rec.schoolName;
      }

      // Add to section score
      const secScore = colleague.sectionScores[section];
      secScore.totalTasks++;
      if (rec.status === 'done') secScore.doneTasks++;
      else if (rec.status === 'late') secScore.lateTasks++;
      else secScore.notDoneTasks++;

      secScore.earnedScore += rec.earnedScore;
      secScore.maxScore += rec.maxScore;
      secScore.progressPercent = secScore.maxScore > 0 ? Math.round((secScore.earnedScore / secScore.maxScore) * 100) : 0;
    });
  });

  // Calculate totals and percentages for each colleague
  const colleaguesList: MergedColleague[] = Array.from(colleaguesMap.values()).map((coll) => {
    let totalTasks = 0;
    let totalDone = 0;
    let totalLate = 0;
    let totalNotDone = 0;
    let totalEarnedScore = 0;
    let totalMaxScore = 0;
    let includedSectionsCount = 0;

    PROGRAM_SECTIONS.forEach((sec) => {
      const s = coll.sectionScores[sec];
      if (s.totalTasks > 0) {
        includedSectionsCount++;
        totalTasks += s.totalTasks;
        totalDone += s.doneTasks;
        totalLate += s.lateTasks;
        totalNotDone += s.notDoneTasks;
        totalEarnedScore += s.earnedScore;
        totalMaxScore += s.maxScore;
      }
    });

    const overallScorePercent = totalMaxScore > 0 ? Math.round((totalEarnedScore / totalMaxScore) * 100) : 0;
    const completedTasks = totalDone + totalLate;
    const overallProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...coll,
      includedSectionsCount,
      totalTasks,
      totalDone,
      totalLate,
      totalNotDone,
      totalEarnedScore,
      totalMaxScore,
      overallScorePercent,
      overallProgressPercent,
    };
  });

  // Sort colleagues by earned score descending
  colleaguesList.sort((a, b) => {
    if (b.totalEarnedScore !== a.totalEarnedScore) return b.totalEarnedScore - a.totalEarnedScore;
    return b.overallScorePercent - a.overallScorePercent;
  });

  // Assign ranks
  colleaguesList.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  // Aggregate by School
  colleaguesList.forEach((coll) => {
    const schNorm = normalizePersianText(coll.schoolName);
    let sch = schoolsMap.get(schNorm);
    if (!sch) {
      sch = {
        schoolName: coll.schoolName,
        grade: coll.grade,
        staffCount: 0,
        sectionAverages: {
          'پرورشی': 0,
          'آموزش ابتدایی': 0,
          'آموزش متوسطه اول': 0,
          'آموزش متوسطه دوم': 0,
          'تربیت بدنی': 0,
        },
        totalEarnedScore: 0,
        averageScorePerColleague: 0,
        overallProgressPercent: 0,
      };
      schoolsMap.set(schNorm, sch);
    }
    sch.staffCount++;
    sch.totalEarnedScore += coll.totalEarnedScore;
  });

  const schoolsList: MergedSchool[] = Array.from(schoolsMap.values()).map((sch) => {
    const schNorm = normalizePersianText(sch.schoolName);
    const schColleagues = colleaguesList.filter((c) => normalizePersianText(c.schoolName) === schNorm);
    const avgScore = schColleagues.length > 0 ? Math.round(sch.totalEarnedScore / schColleagues.length) : 0;

    let totalTasks = 0;
    let totalDone = 0;
    schColleagues.forEach((c) => {
      totalTasks += c.totalTasks;
      totalDone += c.totalDone + c.totalLate;
    });

    const overallProgressPercent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

    const sectionAverages: Record<ProgramSection, number> = {
      'پرورشی': 0,
      'آموزش ابتدایی': 0,
      'آموزش متوسطه اول': 0,
      'آموزش متوسطه دوم': 0,
      'تربیت بدنی': 0,
    };

    PROGRAM_SECTIONS.forEach((sec) => {
      const activeInSec = schColleagues.filter((c) => c.sectionScores[sec].totalTasks > 0);
      if (activeInSec.length > 0) {
        const sumSecScore = activeInSec.reduce((sum, c) => sum + c.sectionScores[sec].earnedScore, 0);
        sectionAverages[sec] = Math.round(sumSecScore / activeInSec.length);
      }
    });

    return {
      ...sch,
      staffCount: schColleagues.length,
      averageScorePerColleague: avgScore,
      sectionAverages,
      overallProgressPercent,
    };
  });

  // Sort schools by total score
  schoolsList.sort((a, b) => b.totalEarnedScore - a.totalEarnedScore);
  schoolsList.forEach((s, idx) => {
    s.rank = idx + 1;
  });

  // Section Overview Stats
  const sectionStats: Record<ProgramSection, SectionOverviewStat> = {
    'پرورشی': { section: 'پرورشی', hasFile: false, totalTasks: 0, doneTasks: 0, lateTasks: 0, notDoneTasks: 0, progressPercent: 0, averageScore: 0, colleaguesCount: 0 },
    'آموزش ابتدایی': { section: 'آموزش ابتدایی', hasFile: false, totalTasks: 0, doneTasks: 0, lateTasks: 0, notDoneTasks: 0, progressPercent: 0, averageScore: 0, colleaguesCount: 0 },
    'آموزش متوسطه اول': { section: 'آموزش متوسطه اول', hasFile: false, totalTasks: 0, doneTasks: 0, lateTasks: 0, notDoneTasks: 0, progressPercent: 0, averageScore: 0, colleaguesCount: 0 },
    'آموزش متوسطه دوم': { section: 'آموزش متوسطه دوم', hasFile: false, totalTasks: 0, doneTasks: 0, lateTasks: 0, notDoneTasks: 0, progressPercent: 0, averageScore: 0, colleaguesCount: 0 },
    'تربیت بدنی': { section: 'تربیت بدنی', hasFile: false, totalTasks: 0, doneTasks: 0, lateTasks: 0, notDoneTasks: 0, progressPercent: 0, averageScore: 0, colleaguesCount: 0 },
  };

  PROGRAM_SECTIONS.forEach((sec) => {
    const imp = sectionImports[sec];
    if (imp && imp.records.length > 0) {
      let tDone = 0;
      let tLate = 0;
      let tNotDone = 0;
      let tEarned = 0;
      let tMax = 0;
      imp.records.forEach((r) => {
        if (r.status === 'done') tDone++;
        else if (r.status === 'late') tLate++;
        else tNotDone++;
        tEarned += r.earnedScore;
        tMax += r.maxScore;
      });

      const prog = imp.records.length > 0 ? Math.round(((tDone + tLate) / imp.records.length) * 100) : 0;
      const avg = imp.colleaguesCount > 0 ? Math.round(tEarned / imp.colleaguesCount) : 0;

      sectionStats[sec] = {
        section: sec,
        hasFile: true,
        fileName: imp.fileName,
        totalTasks: imp.records.length,
        doneTasks: tDone,
        lateTasks: tLate,
        notDoneTasks: tNotDone,
        progressPercent: prog,
        averageScore: avg,
        colleaguesCount: imp.colleaguesCount,
      };
    }
  });

  const totalTasksAll = colleaguesList.reduce((sum, c) => sum + c.totalTasks, 0);
  const totalScoreAll = colleaguesList.reduce((sum, c) => sum + c.totalEarnedScore, 0);
  const totalMaxScoreAll = colleaguesList.reduce((sum, c) => sum + c.totalMaxScore, 0);
  const avgScore = colleaguesList.length > 0 ? Math.round(totalScoreAll / colleaguesList.length) : 0;
  const avgProg = totalMaxScoreAll > 0 ? Math.round((totalScoreAll / totalMaxScoreAll) * 100) : 0;

  return {
    generatedAt: getCurrentJalaliDate(),
    sectionsCount: activeSections.length,
    sectionsList: activeSections,
    colleagues: colleaguesList,
    schools: schoolsList,
    sectionStats,
    totalColleagues: colleaguesList.length,
    totalSchools: schoolsList.length,
    totalTasksAllSections: totalTasksAll,
    overallAverageScore: avgScore,
    overallAverageProgress: avgProg,
    topColleague: colleaguesList[0],
    topSchool: schoolsList[0],
  };
}

/**
 * Exports Consolidated Merged Multi-Section Report to Excel (.xlsx)
 */
export function exportMergedMultiSectionExcel(
  result: ConsolidatedReportResult,
  settings?: SystemSettings,
  filename = 'گزارش_جامع_میکس_بخش_های_پنجگانه',
) {
  const wb = XLSX.utils.book_new();

  wb.Props = {
    Title: `گزارش تجمیعی و میکس بخش‌های پنج‌گانه - ${settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}`,
    Subject: 'گزارش ادغام شده از فایل‌های اکسل بخش‌های پرورشی، ابتدایی، متوسطه و تربیت بدنی',
    Author: SYSTEM_DESIGNER_NAME,
    Company: settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان',
    Comments: `طراح و برنامه‌نویس: ${SYSTEM_DESIGNER_NAME} - تاریخ: ${result.generatedAt}`,
  };

  // Sheet 1: شناسنامه و خلاصه
  const sheet0: (string | number)[][] = [
    ['مشخصه', 'مقدار در گزارش تجمیعی'],
    ['عنوان گزارش', 'گزارش تجمیعی و میکس‌شده بخش‌های پنج‌گانه'],
    ['اداره متبوع', settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'],
    ['طراح و برنامه‌نویس', SYSTEM_DESIGNER_NAME],
    ['سال تحصیلی', settings?.academicYear || 'سال تحصیلی جاری'],
    ['تاریخ صدور گزارش', result.generatedAt],
    ['تعداد بخش‌های میکس‌شده', `${result.sectionsCount} از ۵ بخش (${result.sectionsList.join('، ')})`],
    ['تعداد کل همکاران ارزیابی‌شده', result.totalColleagues],
    ['تعداد کل آموزشگاه‌ها و مدارس', result.totalSchools],
    ['مجموع کل تکالیف پنج حوزه', result.totalTasksAllSections],
    ['میانگین امتیاز کل همکاران', result.overallAverageScore],
    ['میانگین درصد تحقق کل', `${result.overallAverageProgress}%`],
    ['همکار رتبه اول منطقه', result.topColleague ? `${result.topColleague.fullName} (${result.topColleague.totalEarnedScore} امتیاز)` : '---'],
    ['آموزشگاه برتر منطقه', result.topSchool ? `${result.topSchool.schoolName} (${result.topSchool.totalEarnedScore} امتیاز)` : '---'],
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(sheet0);
  ws0['!cols'] = [{ wch: 32 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, ws0, 'شناسنامه گزارش');

  // Sheet 2: کارنامه جامع میکس‌شده همکاران
  const sheet1: (string | number)[][] = [
    [
      'رتبه کل',
      'کد همکار',
      'نام و نام خانوادگی',
      'کد ملی',
      'کد پرسنلی',
      'آموزشگاه',
      'مقطع',
      'سمت',
      'امتیاز پرورشی',
      'امتیاز آموزش ابتدایی',
      'امتیاز متوسطه اول',
      'امتیاز متوسطه دوم',
      'امتیاز تربیت بدنی',
      'مجموع امتیاز کسب‌شده',
      'سقف امتیاز قابل کسب',
      'درصد نهایی تحقق',
      'کل تکالیف',
      'انجام به‌موقع',
      'دیر انجام شده',
      'انجام نشده',
    ],
  ];

  result.colleagues.forEach((c) => {
    sheet1.push([
      c.rank || 1,
      c.employeeCode || '---',
      c.fullName,
      c.nationalId || '---',
      c.personnelCode || '---',
      c.schoolName,
      c.grade,
      c.role,
      c.sectionScores['پرورشی'].earnedScore,
      c.sectionScores['آموزش ابتدایی'].earnedScore,
      c.sectionScores['آموزش متوسطه اول'].earnedScore,
      c.sectionScores['آموزش متوسطه دوم'].earnedScore,
      c.sectionScores['تربیت بدنی'].earnedScore,
      c.totalEarnedScore,
      c.totalMaxScore,
      `${c.overallScorePercent}%`,
      c.totalTasks,
      c.totalDone,
      c.totalLate,
      c.totalNotDone,
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1);
  ws1['!cols'] = [
    { wch: 8 }, { wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'کارنامه تجمیعی همکاران');

  // Sheet 3: مقایسه آموزشگاه‌ها
  const sheet2: (string | number)[][] = [
    [
      'رتبه',
      'نام آموزشگاه',
      'مقطع تحصیلی',
      'تعداد همکاران',
      'میانگین پرورشی',
      'میانگین ابتدایی',
      'میانگین متوسطه اول',
      'میانگین متوسطه دوم',
      'میانگین تربیت بدنی',
      'مجموع امتیاز آموزشگاه',
      'میانگین هر همکار',
      'درصد تحقق آموزشگاه',
    ],
  ];

  result.schools.forEach((s) => {
    sheet2.push([
      s.rank || 1,
      s.schoolName,
      s.grade,
      s.staffCount,
      s.sectionAverages['پرورشی'],
      s.sectionAverages['آموزش ابتدایی'],
      s.sectionAverages['آموزش متوسطه اول'],
      s.sectionAverages['آموزش متوسطه دوم'],
      s.sectionAverages['تربیت بدنی'],
      s.totalEarnedScore,
      s.averageScorePerColleague,
      `${s.overallProgressPercent}%`,
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2);
  ws2['!cols'] = [
    { wch: 8 }, { wch: 32 }, { wch: 20 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'مقایسه عملکرد آموزشگاه‌ها');

  // Sheet 4: آمار و ماتریس ۵ بخش
  const sheet3: (string | number)[][] = [
    [
      'حوزه سازمانی',
      'وضعیت فایل اکسل',
      'نام فایل بارگذاری‌شده',
      'تعداد تکالیف',
      'انجام شده',
      'دیر انجام شده',
      'انجام نشده',
      'درصد تحقق',
      'میانگین نمره همکاران',
      'تعداد نیروهای ارزیابی‌شده',
    ],
  ];

  PROGRAM_SECTIONS.forEach((sec) => {
    const st = result.sectionStats[sec];
    sheet3.push([
      sec,
      st.hasFile ? 'فایل بارگذاری شده' : 'بدون فایل',
      st.fileName || '---',
      st.totalTasks,
      st.doneTasks,
      st.lateTasks,
      st.notDoneTasks,
      `${st.progressPercent}%`,
      st.averageScore,
      st.colleaguesCount,
    ]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3);
  ws3['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'ماتریس تحلیلی بخش‌ها');

  const dateStr = result.generatedAt.replace(/\//g, '-');
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
}

/**
 * Generates and downloads Standalone HTML Report for the Merged Multi-Section Data
 */
export function exportMergedMultiSectionHtml(
  result: ConsolidatedReportResult,
  settings?: SystemSettings,
  filename = 'گزارش_جامع_میکس_بخش_های_پنجگانه',
) {
  const officeTitle = settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان';
  const developerName = SYSTEM_DESIGNER_NAME;
  const academicYear = settings?.academicYear || 'سال تحصیلی جاری';

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>گزارش نهایی تجمیعی و میکس بخش‌های مختلف - ${officeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #047857;
      --primary-dark: #064e3b;
      --secondary: #0284c7;
      --accent: #d97706;
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --done: #10b981;
      --late: #f59e0b;
      --not-done: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Vazirmatn', -apple-system, sans-serif; }
    body { background-color: var(--bg); color: var(--text); direction: rtl; text-align: right; padding: 24px; font-size: 13px; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    .print-bar {
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      border-radius: 16px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { background: var(--primary-dark); }
    
    .header-card {
      background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
      color: white;
      border-radius: 24px;
      padding: 30px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(6, 78, 59, 0.3);
    }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .header-title-box h1 { font-size: 22px; font-weight: 900; margin-bottom: 6px; }
    .header-title-box p { font-size: 13px; color: #a7f3d0; }
    .meta-box { background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); padding: 12px 18px; border-radius: 14px; font-size: 12px; line-height: 1.8; text-align: left; }
    
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 20px; }
    .kpi-card { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 14px; text-align: center; }
    .kpi-card .val { font-size: 24px; font-weight: 900; color: #34d399; font-family: monospace; }
    .kpi-card .lbl { font-size: 11px; color: #cbd5e1; margin-top: 4px; }
    
    .section-card { background: white; border-radius: 20px; border: 1px solid var(--border); padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
    .section-title { font-size: 16px; font-weight: 800; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    th { background: #f8fafc; color: #475569; font-weight: 700; text-align: right; padding: 10px 12px; border-bottom: 2px solid var(--border); }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:hover { background-color: #f8fafc; }
    
    .podium-box { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .medal-card { padding: 18px; border-radius: 18px; display: flex; align-items: center; gap: 14px; border: 1px solid transparent; }
    .gold { background: linear-gradient(135deg, #fef3c7, #fef9c3); border-color: #fde047; }
    .silver { background: linear-gradient(135deg, #f1f5f9, #e2e8f0); border-color: #cbd5e1; }
    .bronze { background: linear-gradient(135deg, #ffedd5, #fed7aa); border-color: #fdba74; }
    
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-primary { background: #ecfdf5; color: #065f46; }
    .badge-score { background: #eff6ff; color: #1e40af; font-family: monospace; font-size: 12px; }
    
    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 20px; }
    
    @media print {
      body { padding: 0; background: white; font-size: 11px; }
      .print-bar { display: none; }
      .header-card { box-shadow: none; border: 1px solid #000; color: black; background: white !important; }
      .header-card * { color: black !important; }
      .section-card { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="print-bar">
      <div>
        <strong>📄 گزارش رسمی تجمیع و میکس بخش‌های پنج‌گانه</strong>
        <span style="opacity: 0.8; margin-right: 10px; font-size: 11px;">${officeTitle} | طراح: ${developerName}</span>
      </div>
      <button class="btn" onclick="window.print()">🖨️ چاپ استاندارد A4 و خروجی PDF</button>
    </div>

    <div class="header-card">
      <div class="header-top">
        <div class="header-title-box">
          <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-bottom: 4px;">جمهوری اسلامی ایران | وزارت آموزش و پرورش</div>
          <h1>${officeTitle}</h1>
          <p>گزارش نهایی و یکپارچه تجمیع عملکرد بخش‌های پنج‌گانه (پرورشی، ابتدایی، متوسطه اول، متوسطه دوم، تربیت بدنی)</p>
        </div>
        <div class="meta-box">
          <div><strong>سال تحصیلی:</strong> ${academicYear}</div>
          <div><strong>تاریخ میکس و صدور:</strong> ${toPersianDigits(result.generatedAt)}</div>
          <div><strong>طراح و برنامه‌نویس:</strong> ${developerName}</div>
          <div><strong>بخش‌های ترکیب‌شده:</strong> ${toPersianDigits(result.sectionsCount)} از ۵ بخش</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="val">${toPersianDigits(result.totalColleagues)}</div>
          <div class="lbl">کل همکاران ارزیابی‌شده</div>
        </div>
        <div class="kpi-card">
          <div class="val">${toPersianDigits(result.totalSchools)}</div>
          <div class="lbl">مدارس و آموزشگاه‌ها</div>
        </div>
        <div class="kpi-card">
          <div class="val">${toPersianDigits(result.totalTasksAllSections)}</div>
          <div class="lbl">مجموع تکالیف تمام بخش‌ها</div>
        </div>
        <div class="kpi-card">
          <div class="val">${toPersianDigits(result.overallAverageScore)}</div>
          <div class="lbl">میانگین امتیاز کل</div>
        </div>
        <div class="kpi-card">
          <div class="val">%${toPersianDigits(result.overallAverageProgress)}</div>
          <div class="lbl">میانگین درصد تحقق کل</div>
        </div>
      </div>
    </div>

    <!-- Podium Top 3 -->
    ${result.colleagues.length >= 3 ? `
    <div class="podium-box">
      <div class="medal-card gold">
        <div style="font-size: 36px;">🥇</div>
        <div>
          <span style="font-size: 10px; font-weight: 800; color: #92400e;">مقام اول منطقه (مجموع بخش‌ها)</span>
          <div style="font-size: 15px; font-weight: 800; color: #78350f;">${result.colleagues[0].fullName}</div>
          <div style="font-size: 11px; color: #b45309;">${result.colleagues[0].schoolName} | <strong style="font-family: monospace;">${toPersianDigits(result.colleagues[0].totalEarnedScore)} امتیاز</strong></div>
        </div>
      </div>
      <div class="medal-card silver">
        <div style="font-size: 36px;">🥈</div>
        <div>
          <span style="font-size: 10px; font-weight: 800; color: #334155;">مقام دوم منطقه</span>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${result.colleagues[1].fullName}</div>
          <div style="font-size: 11px; color: #475569;">${result.colleagues[1].schoolName} | <strong style="font-family: monospace;">${toPersianDigits(result.colleagues[1].totalEarnedScore)} امتیاز</strong></div>
        </div>
      </div>
      <div class="medal-card bronze">
        <div style="font-size: 36px;">🥉</div>
        <div>
          <span style="font-size: 10px; font-weight: 800; color: #9a3412;">مقام سوم منطقه</span>
          <div style="font-size: 15px; font-weight: 800; color: #7c2d12;">${result.colleagues[2].fullName}</div>
          <div style="font-size: 11px; color: #c2410c;">${result.colleagues[2].schoolName} | <strong style="font-family: monospace;">${toPersianDigits(result.colleagues[2].totalEarnedScore)} امتیاز</strong></div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Table 1: Master Ranking of Colleagues across Sections -->
    <div class="section-card">
      <div class="section-title">
        <span>🏆 جدول رتبه‌بندی جامع همکاران با تفکیک امتیاز هر بخش</span>
        <span style="margin-right: auto; font-size: 11px; color: var(--text-muted); font-weight: 500;">(${toPersianDigits(result.colleagues.length)} همکار)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">رتبه</th>
            <th style="width: 60px; text-align: center;">کد</th>
            <th>نام و نام خانوادگی</th>
            <th>آموزشگاه</th>
            <th>مقطع</th>
            <th style="text-align: center;">پرورشی</th>
            <th style="text-align: center;">ابتدایی</th>
            <th style="text-align: center;">متوسطه اول</th>
            <th style="text-align: center;">متوسطه دوم</th>
            <th style="text-align: center;">تربیت بدنی</th>
            <th style="text-align: center;">جمع امتیاز</th>
            <th style="text-align: center;">تحقق</th>
          </tr>
        </thead>
        <tbody>
          ${result.colleagues.map((c) => `
            <tr>
              <td style="text-align: center; font-weight: bold; font-family: monospace;">${toPersianDigits(c.rank)}</td>
              <td style="text-align: center; font-family: monospace;"><strong>${c.employeeCode || '---'}</strong></td>
              <td style="font-weight: 700; color: #1e293b;">${c.fullName}</td>
              <td style="color: #475569;">${c.schoolName}</td>
              <td style="color: #64748b;">${c.grade}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${toPersianDigits(c.sectionScores['پرورشی'].earnedScore)}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${toPersianDigits(c.sectionScores['آموزش ابتدایی'].earnedScore)}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${toPersianDigits(c.sectionScores['آموزش متوسطه اول'].earnedScore)}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${toPersianDigits(c.sectionScores['آموزش متوسطه دوم'].earnedScore)}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${toPersianDigits(c.sectionScores['تربیت بدنی'].earnedScore)}</td>
              <td style="text-align: center;">
                <span class="badge badge-score">${toPersianDigits(c.totalEarnedScore)}</span>
              </td>
              <td style="text-align: center; font-weight: bold; color: ${c.overallScorePercent >= 75 ? '#059669' : '#d97706'}; font-family: monospace;">
                %${toPersianDigits(c.overallScorePercent)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Table 2: School Comparisons across Sections -->
    <div class="section-card">
      <div class="section-title">
        <span>🏫 گزارش تحلیلی و مقایسه عملکرد آموزشگاه‌ها در بخش‌های پنج‌گانه</span>
        <span style="margin-right: auto; font-size: 11px; color: var(--text-muted); font-weight: 500;">(${toPersianDigits(result.schools.length)} آموزشگاه)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">رتبه</th>
            <th>نام آموزشگاه</th>
            <th>مقطع تحصیلی</th>
            <th style="text-align: center;">همکاران</th>
            <th style="text-align: center;">میانگین پرورشی</th>
            <th style="text-align: center;">میانگین ابتدایی</th>
            <th style="text-align: center;">میانگین متوسطه اول</th>
            <th style="text-align: center;">میانگین متوسطه دوم</th>
            <th style="text-align: center;">میانگین تربیت بدنی</th>
            <th style="text-align: center;">مجموع امتیاز</th>
            <th style="text-align: center;">درصد پیشرفت</th>
          </tr>
        </thead>
        <tbody>
          ${result.schools.map((s) => `
            <tr>
              <td style="text-align: center; font-weight: bold; font-family: monospace;">${toPersianDigits(s.rank)}</td>
              <td style="font-weight: 700; color: #1e293b;">${s.schoolName}</td>
              <td style="color: #64748b;">${s.grade}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.staffCount)}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.sectionAverages['پرورشی'])}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.sectionAverages['آموزش ابتدایی'])}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.sectionAverages['آموزش متوسطه اول'])}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.sectionAverages['آموزش متوسطه دوم'])}</td>
              <td style="text-align: center; font-family: monospace;">${toPersianDigits(s.sectionAverages['تربیت بدنی'])}</td>
              <td style="text-align: center;">
                <span class="badge badge-score">${toPersianDigits(s.totalEarnedScore)}</span>
              </td>
              <td style="text-align: center; font-weight: bold; color: ${s.overallProgressPercent >= 75 ? '#059669' : '#d97706'}; font-family: monospace;">
                %${toPersianDigits(s.overallProgressPercent)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Section Matrices Breakdown -->
    <div class="section-card">
      <div class="section-title">
        <span>📊 ماتریس آماری مشارکت حوزه‌ها در گزارش نهایی</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>حوزه تخصصی</th>
            <th style="text-align: center;">وضعیت دریافت فایل</th>
            <th>نام فایل منبع اکسل</th>
            <th style="text-align: center;">تعداد تکالیف</th>
            <th style="text-align: center;">نیروهای مشارکت‌کننده</th>
            <th style="text-align: center;">نرخ تحقق</th>
            <th style="text-align: center;">میانگین نمره</th>
          </tr>
        </thead>
        <tbody>
          ${PROGRAM_SECTIONS.map((sec) => {
            const st = result.sectionStats[sec];
            return `
              <tr>
                <td style="font-weight: 700;">${sec}</td>
                <td style="text-align: center;">
                  <span class="badge ${st.hasFile ? 'badge-primary' : ''}" style="${!st.hasFile ? 'background:#f1f5f9; color:#94a3b8;' : ''}">
                    ${st.hasFile ? '✓ دریافت و میکس شد' : 'بدون فایل'}
                  </span>
                </td>
                <td style="font-family: monospace; font-size: 11px; color: #475569;">${st.fileName || '---'}</td>
                <td style="text-align: center; font-family: monospace;">${toPersianDigits(st.totalTasks)}</td>
                <td style="text-align: center; font-family: monospace;">${toPersianDigits(st.colleaguesCount)}</td>
                <td style="text-align: center; font-weight: bold; font-family: monospace;">%${toPersianDigits(st.progressPercent)}</td>
                <td style="text-align: center; font-weight: bold; font-family: monospace; color: #0369a1;">${toPersianDigits(st.averageScore)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>این گزارش رسمی توسط ماژول میکس و تجمیع گزارش‌های اکسل ${officeTitle} تدوین شده است.</div>
      <div style="margin-top: 6px; font-weight: 700; color: #1e293b;">
        طراح و برنامه‌نویس سامانه: ${developerName}
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${result.generatedAt.replace(/\//g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates sample Excel templates for each section
 */
export function downloadSectionSampleTemplate(section: ProgramSection) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'کد ملی',
    'کد پرسنلی',
    'نام و نام خانوادگی',
    'آموزشگاه',
    'مقطع تحصیلی',
    'سمت سازمانی',
    'عنوان طرح یا فعالیت',
    'ضریب طرح (۱ تا ۳)',
    'وضعیت اجرا',
    'تاریخ اجرا',
    'توضیحات و مستندات',
  ];

  const sampleRows: Record<ProgramSection, (string | number)[][]> = {
    'پرورشی': [
      ['1289456123', '201001', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'متوسطه اول', 'معاون پرورشی', 'مسابقات قرآن، عترت و نماز', 3, 'انجام شده', '1403/09/10', 'بارگذاری مستندات در سامانه نورینو'],
      ['1287349102', '201002', 'زهره کریمی', 'دبیرستان فرزانگان', 'متوسطه دوم نظری', 'معاون پرورشی', 'طرح مصباح الهدی', 2, 'انجام شده', '1403/08/20', 'برگزاری نمایشگاه سبک زندگی اسلامی'],
      ['1290123456', '201003', 'رضا مرادی', 'دبستان انقلاب اسلامی', 'ابتدایی دوره دوم', 'آموزگار', 'طرح ۳۳ روزه قرآن کریم', 2, 'دیر انجام شده', '1403/10/05', 'اجرا با ۵ روز تاخیر'],
    ],
    'آموزش ابتدایی': [
      ['1290123456', '201003', 'رضا مرادی', 'دبستان انقلاب اسلامی', 'ابتدایی دوره دوم', 'آموزگار', 'طرح جابربن حیان و فرصت‌های یادگیری', 3, 'انجام شده', '1403/09/25', 'ارسال آثار دانش‌آموزان به منطقه'],
      ['1289456123', '201001', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'متوسطه اول', 'معاون پرورشی', 'کارگاه اختلالات یادگیری ابتدایی', 1, 'انجام شده', '1403/08/15', 'شرکت فعال در دوره توانمندسازی'],
      ['1278912345', '201004', 'الهام سعیدی', 'هنرستان فنی دخترانه کوثر', 'هنرستان فنی و حرفه‌ای و کاردانش', 'دبیر', 'طرح درس پژوهی دوره اول ابتدایی', 2, 'انجام شده', '1403/09/18', 'ثبت گزارش در سامانه سیدا'],
    ],
    'آموزش متوسطه اول': [
      ['1289456123', '201001', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'متوسطه اول', 'معاون پرورشی', 'جشنواره نوجوان خوارزمی', 3, 'انجام شده', '1403/09/20', 'کسب رتبه منطقه‌ای در محور پژوهش'],
      ['1287349102', '201002', 'زهره کریمی', 'دبیرستان فرزانگان', 'متوسطه دوم نظری', 'معاون پرورشی', 'طرح مدام (مدیریت توسط دانش‌آموزان)', 2, 'انجام شده', '1403/08/28', 'اجرای کامل طرح در آموزشگاه'],
      ['1290123456', '201003', 'رضا مرادی', 'دبستان انقلاب اسلامی', 'ابتدایی دوره دوم', 'آموزگار', 'همایش کیفیت‌بخشی آموزش متوسطه اول', 1, 'دیر انجام شده', '1403/10/02', 'ارسال گزارش با تاخیر'],
    ],
    'آموزش متوسطه دوم': [
      ['1287349102', '201002', 'زهره کریمی', 'دبیرستان فرزانگان', 'متوسطه دوم نظری', 'معاون پرورشی', 'جشنواره جوان خوارزمی و المپیادها', 3, 'انجام شده', '1403/09/14', 'ثبت نام ۱۲ دانش‌آموز در مرحله نخست'],
      ['1278912345', '201004', 'الهام سعیدی', 'هنرستان فنی دخترانه کوثر', 'هنرستان فنی و حرفه‌ای و کاردانش', 'دبیر', 'نمایشگاه دستاوردهای هنرجویان هنرستان', 3, 'انجام شده', '1403/09/22', 'برگزاری نمایشگاه در سطح منطقه ۶'],
      ['1289456123', '201001', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'متوسطه اول', 'معاون پرورشی', 'پایگاه کنکور و هدایت تحصیلی پایه دوازدهم', 2, 'انجام شده', '1403/08/10', 'برگزاری جلسات مشاوره هفتگی'],
    ],
    'تربیت بدنی': [
      ['1278912345', '201004', 'الهام سعیدی', 'هنرستان فنی دخترانه کوثر', 'هنرستان فنی و حرفه‌ای و کاردانش', 'دبیر', 'المپیاد ورزشی درون‌مدرسه‌ای', 3, 'انجام شده', '1403/08/26', 'افتتاحیه باشکوه با حضور کارشناسان'],
      ['1289456123', '201001', 'حسین صادقی', 'دبیرستان شهید بهشتی', 'متوسطه اول', 'معاون پرورشی', 'طرح کوچ (کنترل وزن و چاقی دانش‌آموزان)', 2, 'انجام شده', '1403/09/05', 'پایش و ثبت بیومتریک تمام دانش‌آموزان'],
      ['1290123456', '201003', 'رضا مرادی', 'دبستان انقلاب اسلامی', 'ابتدایی دوره دوم', 'آموزگار', 'حیاط پویا و ورزش صبحگاهی', 1, 'انجام شده', '1403/07/20', 'خط‌کشی حیاط و اجرای هر روزه'],
    ],
  };

  const data = [headers, ...(sampleRows[section] || sampleRows['پرورشی'])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 }, // کد ملی
    { wch: 14 }, // کد پرسنلی
    { wch: 24 }, // نام
    { wch: 30 }, // آموزشگاه
    { wch: 22 }, // مقطع
    { wch: 20 }, // سمت
    { wch: 35 }, // عنوان طرح
    { wch: 18 }, // ضریب
    { wch: 18 }, // وضعیت
    { wch: 16 }, // تاریخ
    { wch: 35 }, // توضیحات
  ];

  XLSX.utils.book_append_sheet(wb, ws, `گزارش_${section}`);
  XLSX.writeFile(wb, `الگوی_اکسل_گزارش_بخش_${section.replace(/\s+/g, '_')}_ناحیه۶.xlsx`);
}
