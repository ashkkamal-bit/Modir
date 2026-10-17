import * as XLSX from 'xlsx';
import { AppDatabase, PROGRAM_SECTIONS, SYSTEM_DESIGNER_NAME, SYSTEM_DESIGNER_WEBSITE, SYSTEM_DESIGNER_PHONE } from '../types';
import { calculateEmployeeStats, calculateProgramStats, calculateSchoolStats } from './storage';
import { getCurrentJalaliDate, getCurrentJalaliYear, updateJalaliDateToCurrentYear, toPersianDigits } from './jalali';

export function exportFullExcelReport(db: AppDatabase, filenamePrefix = 'گزارش_جامع_ارزشیابی_عملکرد_ناحیه۶'): void {
  const wb = XLSX.utils.book_new();

  const currentYear = getCurrentJalaliYear();
  const nextYear = String(Number(currentYear) + 1);
  const currentJalaliDate = getCurrentJalaliDate();
  const dynamicAcademicYear = db.settings.academicYear && !db.settings.academicYear.includes('1403')
    ? db.settings.academicYear
    : `سال تحصیلی ${toPersianDigits(currentYear)}-${toPersianDigits(nextYear)}`;

  wb.Props = {
    Title: `گزارش جامع عملکرد ۵ حوزه تخصصی با ضرایب - ${db.settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}`,
    Subject: 'گزارش ارزیابی و رتبه‌بندی عملکرد نیروها و مدارس با اعمال ۵ حوزه و ضرایب ۱ تا ۳ طرح‌ها',
    Author: SYSTEM_DESIGNER_NAME,
    Company: db.settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان',
    Comments: `طراح و برنامه‌نویس: ${SYSTEM_DESIGNER_NAME} - تاریخ صدور: ${currentJalaliDate}`,
  };

  const empMap = new Map(db.employees.map((e) => [e.id, e]));
  const prgMap = new Map(db.programs.map((p) => [p.id, p]));

  // Sheet 0: شناسنامه
  const sheet0Data: (string | number)[][] = [
    ['عنوان مشخصه', 'مقدار مشخصه در سامانه'],
    ['نام اداره متبوع', db.settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'],
    ['عنوان کارشناسی / واحد سازمانی', db.settings.departmentTitle || 'کارشناسی امور پرورشی و فرهنگی'],
    ['سال تحصیلی رسمی', dynamicAcademicYear],
    ['تاریخ صدور این فایل گزارش (شمسی)', currentJalaliDate],
    ['طراح و برنامه‌نویس سامانه', SYSTEM_DESIGNER_NAME],
    ['تارنما و وب‌سایت طراح', SYSTEM_DESIGNER_WEBSITE],
    ['شماره تماس و پشتیبانی', SYSTEM_DESIGNER_PHONE],
    ['تعداد کل همکاران ثبت‌شده', db.employees.length],
    ['تعداد کل آموزشگاه‌ها و مدارس', db.schools.length],
    ['تعداد کل طرح‌ها و برنامه‌ها', db.programs.length],
    ['حوزه‌های پنج‌گانه طرح‌ها', '۱. پرورشی | ۲. آموزش ابتدایی | ۳. آموزش متوسطه اول | ۴. آموزش متوسطه دوم | ۵. تربیت بدنی'],
    ['مجموع کل تکالیف ارجاع‌شده', db.employeePrograms.length],
    ['سیستم امتیازبندی و ضرایب', 'هر طرح دارای ضریب ۱ تا ۳ است؛ اجرای به‌موقع = ۱۰۰ × ضریب | با تاخیر = ۶۰ × ضریب'],
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(sheet0Data);
  ws0['!cols'] = [{ wch: 38 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, ws0, 'شناسنامه گزارش');

  // Sheet 1: ریز عملکرد
  const sheet1Data: (string | number)[][] = [
    [
      'ردیف',
      'کد همکار',
      'نام و نام خانوادگی',
      'آموزشگاه',
      'مقطع تحصیلی',
      'سمت سازمانی',
      'کد برنامه',
      'عنوان برنامه',
      'حوزه تخصصی (از ۵ بخش)',
      'ضریب طرح (۱ تا ۳)',
      'نوع طرح',
      'مهلت مقرر اجرا',
      'تاریخ اجرای طرح',
      'تاریخ ارسال مستندات',
      'محل ارسال مستندات',
      'وضعیت اجرا',
      'امتیاز کسب‌شده با ضریب',
      'توضیحات و مستندات',
    ],
  ];

  let rowIdx = 1;
  for (const ep of db.employeePrograms) {
    const emp = empMap.get(ep.employeeId);
    const prg = prgMap.get(ep.programId);
    if (!emp || !prg) continue;

    let statusFa = 'انجام نشده';
    if (ep.status === 'done') statusFa = 'انجام شده (به‌موقع)';
    else if (ep.status === 'late') statusFa = 'دیر انجام شده';

    let rawExec = ep.executionDate || ep.actualDate;
    const execDate = rawExec ? updateJalaliDateToCurrentYear(rawExec) : '---';
    let rawSub = ep.submissionDate || ep.docSubmissionDate || rawExec;
    const subDate = rawSub ? updateJalaliDateToCurrentYear(rawSub) : execDate;
    const platform = ep.submissionPlatform || ep.documentationPlatform || '---';

    const isSpecific = prg.scope === 'اختصاصی';
    const coeff = prg.coefficient || 1;
    const sectionName = prg.section || 'پرورشی';

    let earnedPoints = 0;
    if (!isSpecific) {
      if (ep.status === 'done') earnedPoints = coeff * 100;
      else if (ep.status === 'late') earnedPoints = coeff * 60;
    }

    sheet1Data.push([
      rowIdx++,
      emp.code,
      emp.fullName,
      emp.schoolName,
      emp.grade,
      emp.role,
      prg.code,
      prg.title,
      sectionName,
      coeff,
      isSpecific ? 'اختصاصی' : 'همگانی',
      updateJalaliDateToCurrentYear(prg.deadline),
      execDate,
      subDate,
      platform,
      statusFa,
      earnedPoints,
      ep.notes || '',
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: 6 }, { wch: 10 }, { wch: 22 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    { wch: 12 }, { wch: 38 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'ریز عملکرد و تکالیف');

  // Sheet 2: خلاصه عملکرد و مشخصات همکاران
  const sheet2Data: (string | number)[][] = [
    [
      'ردیف',
      'کد کارتابل',
      'نام و نام خانوادگی',
      'کد ملی',
      'کد پرسنلی',
      'آموزشگاه',
      'مقطع تحصیلی',
      'سمت سازمانی',
      'سابقه خدمت (سال)',
      'کل طرح‌ها',
      'طرح‌های همگانی',
      'مجموع ضرایب',
      'طرح‌های اختصاصی',
      'انجام شده به‌موقع',
      'دیر انجام شده',
      'انجام نشده',
      'درصد پیشرفت همگانی',
      'درصد اجرای به‌موقع',
      'امتیاز نهایی با ضریب',
    ],
  ];

  let r2 = 1;
  for (const emp of db.employees) {
    const stats = calculateEmployeeStats(emp.id, db.employeePrograms, db.programs);
    const empAssignments = db.employeePrograms.filter((ep) => ep.employeeId === emp.id);
    const specificAssignments = empAssignments.filter((ep) => {
      const p = prgMap.get(ep.programId);
      return p?.scope === 'اختصاصی';
    });

    sheet2Data.push([
      r2++,
      emp.code,
      emp.fullName,
      emp.nationalId || '---',
      emp.personnelCode || '---',
      emp.schoolName,
      emp.grade,
      emp.role,
      emp.experienceYears !== undefined ? `${emp.experienceYears} سال` : '---',
      empAssignments.length,
      stats.total,
      stats.totalCoefficients,
      specificAssignments.length,
      stats.done,
      stats.late,
      stats.notDone,
      `${stats.progressPercent}%`,
      `${stats.onTimePercent}%`,
      stats.earnedWeightedScore,
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 6 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'خلاصه همکاران و سوابق');

  // Sheet 3: طرح‌ها
  const sheet3Data: (string | number)[][] = [
    [
      'ردیف',
      'کد برنامه',
      'عنوان برنامه / طرح',
      'حوزه تخصصی',
      'ضریب طرح (۱ تا ۳)',
      'نوع برنامه',
      'مهلت نهایی اجرا',
      'تعداد افراد مشمول',
      'انجام شده',
      'دیر انجام شده',
      'انجام نشده',
      'درصد تحقق',
    ],
  ];

  let r3 = 1;
  for (const prg of db.programs) {
    const pStats = calculateProgramStats(prg.id, db.employeePrograms);
    sheet3Data.push([
      r3++,
      prg.code,
      prg.title,
      prg.section || 'پرورشی',
      prg.coefficient || 1,
      prg.scope === 'اختصاصی' ? 'اختصاصی' : 'همگانی',
      updateJalaliDateToCurrentYear(prg.deadline),
      pStats.totalAssigned,
      pStats.done,
      pStats.late,
      pStats.notDone,
      `${pStats.progressPercent}%`,
    ]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 38 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'طرح‌ها در ۵ حوزه');

  // Sheet 4: گزارش آموزشگاه‌ها
  const sheet4Data: (string | number)[][] = [
    [
      'ردیف',
      'کد آموزشگاه',
      'نام آموزشگاه',
      'مقطع تحصیلی',
      'جنسیت',
      'تعداد نیروها',
      'کل تکالیف',
      'انجام شده',
      'دیر انجام شده',
      'انجام نشده',
      'درصد پیشرفت',
      'امتیاز وزنی مدرسه',
    ],
  ];

  let r4 = 1;
  for (const sch of db.schools) {
    const sStats = calculateSchoolStats(sch.id, db.employees, db.employeePrograms, db.programs);
    sheet4Data.push([
      r4++,
      sch.code,
      sch.name,
      sch.grade,
      sch.gender,
      sStats.staffCount,
      sStats.totalPrograms,
      sStats.done,
      sStats.late,
      sStats.notDone,
      `${sStats.progressPercent}%`,
      sStats.earnedWeightedScore,
    ]);
  }
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
  ws4['!cols'] = [
    { wch: 6 }, { wch: 14 }, { wch: 32 }, { wch: 22 }, { wch: 12 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws4, 'گزارش آموزشگاه‌ها');

  const dateStr = currentJalaliDate.replace(/\//g, '-');
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}
