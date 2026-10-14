import { AppDatabase, PROGRAM_SECTIONS } from '../types';
import { calculateEmployeeStats, calculateProgramStats, calculateSchoolStats } from './storage';
import { toPersianDigits, getCurrentJalaliDate } from './jalali';

export function exportFullHtmlReport(db: AppDatabase, filenamePrefix = 'گزارش_جامع_عملکرد_ناحیه۶_اصفهان'): void {
  const htmlContent = generateHtmlReportContent(db);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = getCurrentJalaliDate().replace(/\//g, '-');
  link.download = `${filenamePrefix}_${today}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function openHtmlReportInNewTab(db: AppDatabase): void {
  const htmlContent = generateHtmlReportContent(db);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function generateHtmlReportContent(db: AppDatabase): string {
  const todayJalali = getCurrentJalaliDate();
  const { settings, employees, programs, employeePrograms, schools } = db;
  const prgMap = new Map(programs.map((p) => [p.id, p]));

  // Ranked employees factoring in program coefficients (1 to 3)
  const rankedEmployees = employees.map((emp) => {
    const stats = calculateEmployeeStats(emp.id, employeePrograms, programs);
    const score = stats.earnedWeightedScore;

    let tier = 'نیازمند پیگیری';
    let tierClass = 'badge-rose';
    if (score >= 600 || (stats.progressPercent >= 85)) {
      tier = 'ممتاز (پیشگام)';
      tierClass = 'badge-emerald';
    } else if (score >= 350 || stats.progressPercent >= 65) {
      tier = 'بسیار خوب';
      tierClass = 'badge-blue';
    } else if (score >= 150 || stats.progressPercent >= 40) {
      tier = 'خوب';
      tierClass = 'badge-amber';
    }

    return {
      ...emp,
      stats,
      score,
      tier,
      tierClass,
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.stats.progressPercent !== a.stats.progressPercent) {
      return b.stats.progressPercent - a.stats.progressPercent;
    }
    return b.stats.done - a.stats.done;
  });

  // Calculate school stats with coefficients
  const schoolReports = schools.map((sch) => {
    const stats = calculateSchoolStats(sch.id, employees, employeePrograms, programs);
    return {
      ...sch,
      stats,
    };
  }).sort((a, b) => b.stats.earnedWeightedScore - a.stats.earnedWeightedScore || b.stats.progressPercent - a.stats.progressPercent);

  // Calculate programs stats
  const programReports = programs.map((prg) => {
    const stats = calculateProgramStats(prg.id, employeePrograms);
    return {
      ...prg,
      stats,
    };
  }).sort((a, b) => b.stats.progressPercent - a.stats.progressPercent);

  // Overall KPIs
  const totalAssignments = employeePrograms.length;
  const totalDone = employeePrograms.filter((ep) => ep.status === 'done').length;
  const totalLate = employeePrograms.filter((ep) => ep.status === 'late').length;
  const totalNotDone = employeePrograms.filter((ep) => ep.status === 'not_done').length;
  const overallProgress = totalAssignments > 0 ? Math.round(((totalDone + totalLate) / totalAssignments) * 100) : 0;
  const overallOnTime = totalAssignments > 0 ? Math.round((totalDone / totalAssignments) * 100) : 0;

  // Breakdown across the 5 sections:
  const sectionBreakdown = PROGRAM_SECTIONS.map((sec) => {
    const secPrgs = programs.filter((p) => (p.section || 'پرورشی') === sec);
    const secPrgIds = new Set(secPrgs.map((p) => p.id));
    const secAssignments = employeePrograms.filter((ep) => secPrgIds.has(ep.programId));
    const secTotal = secAssignments.length;
    const secDone = secAssignments.filter((a) => a.status === 'done').length;
    const secLate = secAssignments.filter((a) => a.status === 'late').length;
    const secProgress = secTotal > 0 ? Math.round(((secDone + secLate) / secTotal) * 100) : 0;

    return {
      section: sec,
      programCount: secPrgs.length,
      assignmentCount: secTotal,
      doneCount: secDone,
      lateCount: secLate,
      progressPercent: secProgress,
    };
  });

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>گزارش جامع ارزشیابی عملکرد ۵ حوزه تخصصی | ${settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap');
    
    :root {
      --primary: #047857;
      --primary-dark: #065f46;
      --primary-light: #d1fae5;
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-700: #334155;
      --slate-800: #1e293b;
      --slate-900: #0f172a;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
      padding: 24px;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    .action-bar {
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .action-bar h2 { font-size: 14px; font-weight: 700; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #059669;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: #047857; }

    .header-card {
      background: white;
      border-radius: 20px;
      padding: 28px;
      border: 1px solid var(--slate-200);
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      position: relative;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--slate-100);
      padding-bottom: 18px;
      margin-bottom: 18px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-title-box h1 {
      font-size: 20px;
      font-weight: 900;
      color: var(--slate-900);
      margin-bottom: 4px;
    }
    .header-title-box p {
      font-size: 13px;
      color: var(--primary-dark);
      font-weight: 600;
    }

    .sections-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .section-pill {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }
    .kpi-card {
      background: white;
      border-radius: 16px;
      padding: 16px;
      border: 1px solid var(--slate-200);
      text-align: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .kpi-label { font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600; }
    .kpi-value { font-size: 24px; font-weight: 900; color: var(--slate-900); }
    .kpi-value.green { color: #059669; }
    .kpi-value.blue { color: #2563eb; }
    .kpi-value.amber { color: #d97706; }

    .nav-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .tab-item {
      padding: 10px 18px;
      border-radius: 12px;
      background: #e2e8f0;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      font-family: inherit;
      white-space: nowrap;
    }
    .tab-item.active { background: #0f172a; color: white; }

    .section-card {
      background: white;
      border-radius: 20px;
      border: 1px solid var(--slate-200);
      overflow: hidden;
      margin-bottom: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .section-header {
      padding: 18px 24px;
      background: #f8fafc;
      border-bottom: 1px solid var(--slate-200);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .section-title { font-size: 15px; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 8px; }

    table { width: 100%; border-collapse: collapse; text-align: right; font-size: 12px; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      padding: 12px 14px;
      border-bottom: 1px solid var(--slate-200);
      white-space: nowrap;
    }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    tr:nth-child(even) td { background-color: #fafbfc; }
    tr:hover td { background-color: #f1f5f9; }

    .badge { display: inline-block; padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .badge-code { background: #0f172a; color: white; font-family: monospace; font-weight: 700; padding: 2px 7px; }
    .badge-emerald { background: #d1fae5; color: #065f46; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }

    .podium-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      padding: 20px;
      background: linear-gradient(to bottom, #f8fafc, #ffffff);
      border-bottom: 1px solid var(--slate-200);
    }
    .podium-card {
      border-radius: 16px;
      padding: 16px;
      border: 2px solid #e2e8f0;
      text-align: center;
      position: relative;
    }
    .podium-gold { border-color: #f59e0b; background: #fffbeb; }
    .podium-silver { border-color: #94a3b8; background: #f8fafc; }
    .podium-bronze { border-color: #d97706; background: #fff7ed; }

    .progress-wrap {
      width: 90px;
      background: #e2e8f0;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-left: 6px;
    }
    .progress-fill { height: 100%; background: #059669; border-radius: 999px; }

    .search-box {
      padding: 7px 12px;
      border-radius: 10px;
      border: 1px solid var(--slate-200);
      font-family: inherit;
      font-size: 11px;
      width: 220px;
      outline: none;
    }

    @media print {
      body { background: white; padding: 0; color: black; }
      .no-print { display: none !important; }
      .action-bar, .nav-tabs, .search-box { display: none !important; }
      .section-card { box-shadow: none; border: 1px solid #cbd5e1; break-inside: avoid; margin-bottom: 20px; }
      .tab-content { display: block !important; }
      @page { size: A4 portrait; margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="action-bar no-print">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">📄</span>
        <div>
          <h2>خروجی رسمی پرونده ارزشیابی عملکرد (۵ حوزه تخصصی با ضرایب ۱ تا ۳)</h2>
          <p style="font-size: 11px; opacity: 0.8;">${settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'} | طراح و برنامه‌نویس: ${settings.developerName || 'علیرضا شریعتی کمال آبادی'}</p>
        </div>
      </div>
      <button class="btn" onclick="window.print()">
        🖨️ چاپ کارنامه و خروجی PDF
      </button>
    </div>

    <div class="header-card">
      <div class="header-top">
        <div class="header-title-box">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px;">جمهوری اسلامی ایران | وزارت آموزش و پرورش</div>
          <h1>${settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}</h1>
          <p>${settings.departmentTitle} — گزارش عملکرد ۵ حوزه تخصصی با اعمال ضرایب ۱ تا ۳ طرح‌ها</p>
          <div class="sections-pills">
            <span class="section-pill">۱. پرورشی</span>
            <span class="section-pill">۲. آموزش ابتدایی</span>
            <span class="section-pill">۳. آموزش متوسطه اول</span>
            <span class="section-pill">۴. آموزش متوسطه دوم</span>
            <span class="section-pill">۵. تربیت بدنی</span>
          </div>
        </div>
        <div style="text-align: left; font-size: 12px; color: #334155; line-height: 1.8;">
          <div><strong>سال تحصیلی:</strong> ${settings.academicYear}</div>
          <div><strong>تاریخ صدور گزارش:</strong> ${toPersianDigits(todayJalali)}</div>
          <div><strong>برنامه‌نویس:</strong> ${settings.developerName || 'علیرضا شریعتی کمال آبادی'}</div>
          <div><strong>سیستم ارزیابی:</strong> ضرایب ۱ تا ۳ برای طرح‌های مهم</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">تعداد کل همکاران</div>
          <div class="kpi-value">${toPersianDigits(employees.length)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">تعداد کل آموزشگاه‌ها</div>
          <div class="kpi-value">${toPersianDigits(schools.length)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">تعداد برنامه‌ها (۵ حوزه)</div>
          <div class="kpi-value">${toPersianDigits(programs.length)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">کل تکالیف محوله</div>
          <div class="kpi-value">${toPersianDigits(totalAssignments)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">اجرا در موعد مقرر (سبز)</div>
          <div class="kpi-value green">${toPersianDigits(totalDone)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">اجرا با تأخیر (نارنجی)</div>
          <div class="kpi-value amber">${toPersianDigits(totalLate)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">میانگین پیشرفت منطقه</div>
          <div class="kpi-value green">${toPersianDigits(overallProgress)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">شاخص اجرای به‌موقع</div>
          <div class="kpi-value blue">${toPersianDigits(overallOnTime)}%</div>
        </div>
      </div>
    </div>

    <!-- 5 Sections Overview Cards -->
    <div style="background: white; border-radius: 20px; padding: 20px; border: 1px solid var(--slate-200); margin-bottom: 24px;">
      <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 14px;">📊 آمار و شاخص‌های پیشرفت به تفکیک ۵ حوزه تخصصی:</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
        ${sectionBreakdown.map((s) => `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${s.section}</div>
            <div style="font-size: 11px; color: #64748b;">تعداد طرح‌ها: <strong>${toPersianDigits(s.programCount)}</strong> | تکالیف: <strong>${toPersianDigits(s.assignmentCount)}</strong></div>
            <div style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 6px;">${toPersianDigits(s.progressPercent)}%</div>
            <div style="font-size: 10px; color: #64748b;">پیشرفت کلی حوزه</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="nav-tabs no-print">
      <button class="tab-item active" onclick="switchSection('ranking')">🏆 تابلوی رتبه‌بندی همکاران</button>
      <button class="tab-item" onclick="switchSection('schools')">🏫 گزارش تجمیعی مدارس</button>
      <button class="tab-item" onclick="switchSection('programs')">📋 طرح‌ها در ۵ بخش</button>
      <button class="tab-item" onclick="switchSection('details')">📑 ریز عملکرد تکالیف</button>
    </div>

    <!-- SECTION 1: RANKING -->
    <div id="section-ranking" class="tab-content section-card">
      <div class="section-header">
        <div class="section-title">
          <span>🏆 تابلوی رسمی رتبه‌بندی عملکرد همکاران (محاسبه با ضرایب ۱ تا ۳)</span>
          <span class="badge badge-emerald">${toPersianDigits(rankedEmployees.length)} همکار ارزیابی‌شده</span>
        </div>
        <input type="text" class="search-box no-print" oninput="filterTable('rankingTable', this.value)" placeholder="جستجو در رتبه‌بندی...">
      </div>

      ${rankedEmployees.length >= 3 ? `
      <div class="podium-container">
        <div class="podium-card podium-silver">
          <div style="font-size: 26px;">🥈</div>
          <div style="font-size: 11px; font-weight: bold; color: #475569;">رتبه دوم</div>
          <div style="font-size: 15px; font-weight: 800;">${rankedEmployees[1].fullName}</div>
          <div style="font-size: 11px; color: #64748b;">${rankedEmployees[1].schoolName} (کد ${toPersianDigits(rankedEmployees[1].code)})</div>
          <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 4px;">${toPersianDigits(rankedEmployees[1].score)} امتیاز با ضریب</div>
        </div>
        <div class="podium-card podium-gold">
          <div style="font-size: 28px;">🥇</div>
          <div style="font-size: 11px; font-weight: bold; color: #b45309;">رتبه اول (برترین عملکرد)</div>
          <div style="font-size: 17px; font-weight: 800; color: #92400e;">${rankedEmployees[0].fullName}</div>
          <div style="font-size: 11px; color: #64748b;">${rankedEmployees[0].schoolName} (کد ${toPersianDigits(rankedEmployees[0].code)})</div>
          <div style="font-size: 22px; font-weight: 900; color: #b45309; margin-top: 4px;">${toPersianDigits(rankedEmployees[0].score)} امتیاز با ضریب</div>
        </div>
        <div class="podium-card podium-bronze">
          <div style="font-size: 26px;">🥉</div>
          <div style="font-size: 11px; font-weight: bold; color: #b45309;">رتبه سوم</div>
          <div style="font-size: 15px; font-weight: 800;">${rankedEmployees[2].fullName}</div>
          <div style="font-size: 11px; color: #64748b;">${rankedEmployees[2].schoolName} (کد ${toPersianDigits(rankedEmployees[2].code)})</div>
          <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 4px;">${toPersianDigits(rankedEmployees[2].score)} امتیاز با ضریب</div>
        </div>
      </div>
      ` : ''}

      <div style="overflow-x: auto;">
        <table id="rankingTable">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">رتبه</th>
              <th style="width: 70px; text-align: center;">کد ۲ رقمی</th>
              <th>نام و نام خانوادگی</th>
              <th>سمت سازمانی</th>
              <th>آموزشگاه محل خدمت</th>
              <th style="text-align: center;">طرح‌های همگانی</th>
              <th style="text-align: center; color: #b45309;">مجموع ضرایب</th>
              <th style="text-align: center; color: #047857;">🟢 به‌موقع</th>
              <th style="text-align: center; color: #d97706;">🟠 با تأخیر</th>
              <th style="text-align: center; color: #e11d48;">🔴 انجام نشده</th>
              <th style="text-align: center;">درصد پیشرفت</th>
              <th style="text-align: center; background: #fef3c7;">امتیاز با ضریب</th>
              <th style="text-align: center;">سطح ارزیابی</th>
            </tr>
          </thead>
          <tbody>
            ${rankedEmployees.map((emp, index) => {
              let medal = toPersianDigits(index + 1);
              if (index === 0) medal = '🥇 ۱';
              else if (index === 1) medal = '🥈 ۲';
              else if (index === 2) medal = '🥉 ۳';

              return `
              <tr>
                <td style="text-align: center; font-weight: 800;">${medal}</td>
                <td style="text-align: center;"><span class="badge badge-code">${toPersianDigits(emp.code)}</span></td>
                <td style="font-weight: 700;">${emp.fullName}</td>
                <td style="color: #64748b;">${emp.role}</td>
                <td>${emp.schoolName}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(emp.stats.total)}</td>
                <td style="text-align: center; font-weight: 700; color: #b45309;">${toPersianDigits(emp.stats.totalCoefficients)}</td>
                <td style="text-align: center; font-weight: 700; color: #059669;">${toPersianDigits(emp.stats.done)}</td>
                <td style="text-align: center; font-weight: 700; color: #d97706;">${toPersianDigits(emp.stats.late)}</td>
                <td style="text-align: center; font-weight: 700; color: #e11d48;">${toPersianDigits(emp.stats.notDone)}</td>
                <td style="text-align: center;">
                  <div class="progress-wrap"><div class="progress-fill" style="width: ${emp.stats.progressPercent}%;"></div></div>
                  <span>${toPersianDigits(emp.stats.progressPercent)}%</span>
                </td>
                <td style="text-align: center; font-weight: 900; color: #0f172a; background: #fffbeb;">${toPersianDigits(emp.score)}</td>
                <td style="text-align: center;"><span class="badge ${emp.tierClass}">${emp.tier}</span></td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 2: SCHOOLS -->
    <div id="section-schools" class="tab-content section-card" style="display: none;">
      <div class="section-header">
        <div class="section-title">
          <span>🏫 گزارش تجمیعی عملکرد مدارس (امتیازبندی با ضرایب طرح‌ها)</span>
          <span class="badge badge-blue">${toPersianDigits(schools.length)} آموزشگاه</span>
        </div>
        <input type="text" class="search-box no-print" oninput="filterTable('schoolsTable', this.value)" placeholder="جستجو در مدارس...">
      </div>
      <div style="overflow-x: auto;">
        <table id="schoolsTable">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">رتبه</th>
              <th>نام آموزشگاه</th>
              <th style="text-align: center;">کد مدرسه</th>
              <th>مقطع تحصیلی</th>
              <th>جنسیت</th>
              <th style="text-align: center;">تعداد نیروها</th>
              <th style="text-align: center;">کل تکالیف</th>
              <th style="text-align: center; color: #059669;">🟢 به‌موقع</th>
              <th style="text-align: center;">درصد پیشرفت</th>
              <th style="text-align: center; background: #fffbeb;">امتیاز وزنی مدرسه</th>
              <th style="text-align: center;">میانگین هر نیرو</th>
            </tr>
          </thead>
          <tbody>
            ${schoolReports.map((sch, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${toPersianDigits(idx + 1)}</td>
                <td style="font-weight: 700;">${sch.name}</td>
                <td style="text-align: center;"><span class="badge badge-code">${toPersianDigits(sch.code)}</span></td>
                <td>${sch.grade}</td>
                <td>${sch.gender}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(sch.stats.staffCount)}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(sch.stats.totalPrograms)}</td>
                <td style="text-align: center; font-weight: 700; color: #059669;">${toPersianDigits(sch.stats.done)}</td>
                <td style="text-align: center;">${toPersianDigits(sch.stats.progressPercent)}%</td>
                <td style="text-align: center; font-weight: 900; background: #fffbeb;">${toPersianDigits(sch.stats.earnedWeightedScore)}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(sch.stats.averageStaffScore)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 3: PROGRAMS IN 5 SECTIONS -->
    <div id="section-programs" class="tab-content section-card" style="display: none;">
      <div class="section-header">
        <div class="section-title">
          <span>📋 گزارش تفکیکی طرح‌ها در ۵ بخش تخصصی با ضرایب ۱ تا ۳</span>
          <span class="badge badge-emerald">${toPersianDigits(programs.length)} طرح تعریف‌شده</span>
        </div>
        <input type="text" class="search-box no-print" oninput="filterTable('programsTable', this.value)" placeholder="جستجو در طرح‌ها...">
      </div>
      <div style="overflow-x: auto;">
        <table id="programsTable">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ردیف</th>
              <th style="width: 80px; text-align: center;">کد طرح</th>
              <th>عنوان برنامه / طرح</th>
              <th style="text-align: center;">حوزه تخصصی</th>
              <th style="text-align: center; background: #fffbeb;">ضریب طرح</th>
              <th style="text-align: center;">مهلت نهایی</th>
              <th style="text-align: center;">مشمولین</th>
              <th style="text-align: center; color: #059669;">🟢 به‌موقع</th>
              <th style="text-align: center; color: #d97706;">🟠 با تأخیر</th>
              <th style="text-align: center; color: #e11d48;">🔴 عدم اجرا</th>
              <th style="text-align: center;">درصد تحقق</th>
            </tr>
          </thead>
          <tbody>
            ${programReports.map((prg, idx) => `
              <tr>
                <td style="text-align: center;">${toPersianDigits(idx + 1)}</td>
                <td style="text-align: center;"><span class="badge badge-code">${prg.code}</span></td>
                <td style="font-weight: 700;">${prg.title}</td>
                <td style="text-align: center;"><span class="badge badge-blue">${prg.section || 'پرورشی'}</span></td>
                <td style="text-align: center; font-weight: 900; background: #fffbeb;">ضریب ${toPersianDigits(prg.coefficient || 1)}</td>
                <td style="text-align: center; font-family: monospace;">${toPersianDigits(prg.deadline)}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(prg.stats.totalAssigned)}</td>
                <td style="text-align: center; font-weight: 700; color: #059669;">${toPersianDigits(prg.stats.done)}</td>
                <td style="text-align: center; font-weight: 700; color: #d97706;">${toPersianDigits(prg.stats.late)}</td>
                <td style="text-align: center; font-weight: 700; color: #e11d48;">${toPersianDigits(prg.stats.notDone)}</td>
                <td style="text-align: center; font-weight: 700;">${toPersianDigits(prg.stats.progressPercent)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 4: DETAILS -->
    <div id="section-details" class="tab-content section-card" style="display: none;">
      <div class="section-header">
        <div class="section-title">
          <span>📑 ریز جزئیات عملکرد تک‌تک تکالیف و امتیاز با ضریب</span>
          <span class="badge badge-code">${toPersianDigits(employeePrograms.length)} رکورد ثبت‌شده</span>
        </div>
        <input type="text" class="search-box no-print" oninput="filterTable('detailsTable', this.value)" placeholder="جستجو در تمام رکوردها...">
      </div>
      <div style="overflow-x: auto;">
        <table id="detailsTable">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ردیف</th>
              <th style="width: 60px; text-align: center;">کد</th>
              <th>نام همکار</th>
              <th>آموزشگاه</th>
              <th>عنوان طرح</th>
              <th style="text-align: center;">حوزه</th>
              <th style="text-align: center;">ضریب</th>
              <th style="text-align: center;">تاریخ اجرا</th>
              <th style="text-align: center;">وضعیت</th>
              <th style="text-align: center;">امتیاز</th>
              <th>مستندات و توضیحات</th>
            </tr>
          </thead>
          <tbody>
            ${employeePrograms.map((ep, idx) => {
              const emp = employees.find((e) => e.id === ep.employeeId);
              const prg = programs.find((p) => p.id === ep.programId);
              if (!emp || !prg) return '';

              const coeff = prg.coefficient || 1;
              const isSpecific = prg.scope === 'اختصاصی';
              let pts = 0;
              if (!isSpecific) {
                if (ep.status === 'done') pts = coeff * 100;
                else if (ep.status === 'late') pts = coeff * 60;
              }

              const execDate = ep.executionDate || ep.actualDate;
              let statusBadge = '<span class="badge badge-rose">🔴 انجام نشده</span>';
              if (ep.status === 'done') statusBadge = '<span class="badge badge-emerald">🟢 به‌موقع</span>';
              else if (ep.status === 'late') statusBadge = '<span class="badge badge-amber">🟠 با تأخیر</span>';

              return `
              <tr>
                <td style="text-align: center;">${toPersianDigits(idx + 1)}</td>
                <td style="text-align: center;"><span class="badge badge-code">${toPersianDigits(emp.code)}</span></td>
                <td style="font-weight: 700;">${emp.fullName}</td>
                <td>${emp.schoolName}</td>
                <td style="font-weight: 600;">${prg.title}</td>
                <td style="text-align: center;"><span class="badge badge-blue">${prg.section || 'پرورشی'}</span></td>
                <td style="text-align: center; font-weight: bold;">ضریب ${toPersianDigits(coeff)}</td>
                <td style="text-align: center; font-family: monospace;">${execDate ? toPersianDigits(execDate) : '---'}</td>
                <td style="text-align: center;">${statusBadge}</td>
                <td style="text-align: center; font-weight: bold; color: #047857;">${pts > 0 ? '+' + toPersianDigits(pts) : '۰'}</td>
                <td style="font-size: 11px; color: #475569;">${ep.notes || '---'}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid var(--slate-200); padding-top: 16px;">
      <div>این گزارش رسمی توسط سامانه هوشمند ارزشیابی عملکرد ${settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'} صادر شده است.</div>
      <div style="margin-top: 6px; font-weight: 700; color: #1e293b;">
        طراح و برنامه‌نویس سامانه: ${settings.developerName || 'علیرضا شریعتی کمال آبادی'}
      </div>
    </div>
  </div>

  <script>
    function switchSection(secId) {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));

      const target = document.getElementById('section-' + secId);
      if (target) target.style.display = 'block';

      const clickedBtn = Array.from(document.querySelectorAll('.tab-item')).find(btn => btn.getAttribute('onclick')?.includes(secId));
      if (clickedBtn) clickedBtn.classList.add('active');
    }

    function filterTable(tableId, query) {
      const q = query.trim().toLowerCase();
      const rows = document.querySelectorAll('#' + tableId + ' tbody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}
