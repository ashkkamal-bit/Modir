import React, { useState } from 'react';
import { Employee, Program, School, EmployeeProgram, SystemSettings, PROGRAM_SECTIONS } from '../types';
import { calculateOverallStats, calculateEmployeeStats } from '../utils/storage';
import { toPersianDigits, padZero } from '../utils/jalali';
import { PieChart } from './PieChart';
import {
  ArrowRight,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Award,
  FileSpreadsheet,
  Share2,
  UserPlus,
  AlertCircle,
  Sparkles,
  Briefcase,
  FileCode,
  Layers,
} from 'lucide-react';
import {
  IsfahanSkyline,
  IsfahanToranjWatermark,
  IsfahanHeritageBar,
} from './IsfahanMotifs';

interface DashboardProps {
  employees: Employee[];
  programs: Program[];
  schools: School[];
  employeePrograms: EmployeeProgram[];
  settings: SystemSettings;
  onQuickJump: (code: string) => boolean;
  onNavigate: (tab: string) => void;
  onSelectEmployee: (emp: Employee) => void;
  onOpenNewEmployeeModal: () => void;
  onOpenNewProgramModal: () => void;
  onOpenAssignModal: () => void;
  onExportExcel: () => void;
  onExportHtml?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  employees,
  programs,
  schools,
  employeePrograms,
  settings,
  onQuickJump,
  onNavigate,
  onSelectEmployee,
  onOpenNewEmployeeModal,
  onOpenNewProgramModal,
  onOpenAssignModal,
  onExportExcel,
  onExportHtml,
}) => {
  const [quickCode, setQuickCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const overall = calculateOverallStats(employees, employeePrograms);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const clean = padZero(quickCode.trim());
    if (!clean || clean === '00') {
      setErrorMessage('لطفاً یک کد دو رقمی معتبر (از 01 تا 99) وارد کنید.');
      return;
    }

    const success = onQuickJump(clean);
    if (!success) {
      setErrorMessage(`همکاری با کد «${clean}» در سیستم پیدا نشد. لطفاً کد را بررسی کنید.`);
    }
  };

  const rankedEmployees = [...employees]
    .map((emp) => {
      const stats = calculateEmployeeStats(emp.id, employeePrograms, programs);
      return { emp, stats };
    })
    .sort((a, b) => b.stats.earnedWeightedScore - a.stats.earnedWeightedScore || b.stats.progressPercent - a.stats.progressPercent)
    .slice(0, 5);

  // 5 Sections breakdown
  const sectionCards = PROGRAM_SECTIONS.map((sec) => {
    const secPrgs = programs.filter((p) => (p.section || 'پرورشی') === sec);
    const secPrgIds = new Set(secPrgs.map((p) => p.id));
    const secAssignments = employeePrograms.filter((ep) => secPrgIds.has(ep.programId));
    const total = secAssignments.length;
    const done = secAssignments.filter((a) => a.status === 'done').length;
    const late = secAssignments.filter((a) => a.status === 'late').length;
    const progress = total > 0 ? Math.round(((done + late) / total) * 100) : 0;
    return {
      name: sec,
      prgCount: secPrgs.length,
      assignCount: total,
      progress,
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-blue-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <IsfahanSkyline className="w-full h-36 absolute bottom-0 left-0 right-0 text-teal-300 pointer-events-none" opacity={0.16} />

        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{settings.officeTitle} | {settings.academicYear}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold">
              <span>🏛️ ۵ حوزه: پرورشی، ابتدایی، متوسطه اول، متوسطه دوم، تربیت بدنی</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
              <span>⭐ ضرایب ۱ تا ۳ برای طرح‌های مهم</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-3">
            سامانه ارزشیابی عملکرد نیروهای آموزش و پرورش ناحیه ۶ اصفهان
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mb-8 leading-relaxed max-w-2xl">
            سامانه جامع، حرفه‌ای و عملیاتی ثبت، ارزشیابی، تحلیل و گزارش‌گیری عملکرد نیروها و مدارس آموزش و پرورش ناحیه ۶ اصفهان
          </p>

          {/* Quick Cartable Jump Card */}
          <div className="bg-white/10 backdrop-blur-md p-5 sm:p-7 rounded-2xl border border-white/20 shadow-xl max-w-2xl relative overflow-hidden">
            <IsfahanToranjWatermark className="w-48 h-48 absolute -bottom-12 -left-12 text-teal-300 pointer-events-none" opacity={0.12} />

            <div className="relative z-10">
              <h3 className="text-base sm:text-lg font-bold text-teal-300 mb-2">
                ورود سریع به کارتابل همکار با کد دو رقمی
              </h3>
              <p className="text-xs text-slate-300 mb-4">
                کد اختصاصی همکار را وارد کنید تا مستقیماً کارتابل، وضعیت برنامه‌ها و نمودار عملکرد او باز شود:
              </p>

              <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={4}
                    value={quickCode}
                    onChange={(e) => {
                      setQuickCode(e.target.value.replace(/[^0-9]/g, ''));
                      setErrorMessage('');
                    }}
                    placeholder="کد دو رقمی همکار (مثلاً 27 یا 01)"
                    className="w-full text-center sm:text-right font-mono font-bold text-lg px-4 py-3 bg-white text-slate-900 rounded-xl focus:ring-4 focus:ring-teal-400 outline-hidden shadow-inner"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <span>ورود به کارتابل</span>
                  <ArrowRight className="w-4 h-4 transform rotate-180" />
                </button>
              </form>

              {errorMessage && (
                <div className="mt-3 p-3 bg-rose-500/20 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Sample Quick Chips */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                <span className="text-[11px] text-slate-400 ml-1">دسترسی سریع به همکاران:</span>
                {employees.slice(0, 7).map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setQuickCode(emp.code);
                      onQuickJump(emp.code);
                    }}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="text-teal-300 font-bold">{emp.code}</span>
                    <span className="text-slate-200 text-[11px]">({emp.fullName.split(' ')[0]})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <IsfahanHeritageBar />

      {/* 5 Specialized Sections Cards Grid */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">
              پایش عملکرد به تفکیک ۵ حوزه تخصصی آموزش و پرورش
            </h3>
          </div>
          <span className="text-xs text-slate-400">ناحیه ۶ اصفهان</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {sectionCards.map((sec, idx) => (
            <div
              key={sec.name}
              onClick={() => onNavigate('programs')}
              className="bg-slate-50 hover:bg-blue-50/50 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">{toPersianDigits(idx + 1)}</span>
                  <span>{toPersianDigits(sec.prgCount)} طرح</span>
                </div>
                <h4 className="font-black text-sm text-slate-800 group-hover:text-blue-700 transition-colors">{sec.name}</h4>
                <div className="text-[11px] text-slate-500 mt-1">
                  تکالیف ثبت‌شده: <strong>{toPersianDigits(sec.assignCount)}</strong>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">پیشرفت:</span>
                <span className="text-base font-black text-emerald-600 font-mono">%{toPersianDigits(sec.progress)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>شاخص‌های کلی عملکرد منطقه</span>
          </h2>
          <span className="text-xs text-slate-500">
            بروزرسانی زنده بر اساس تمام تکالیف با احتساب ضرایب ۱ تا ۳
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          <div onClick={() => onNavigate('employees')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-black text-slate-800 block">{toPersianDigits(overall.totalEmployees)}</span>
            <span className="text-[11px] font-medium text-slate-500">کل همکاران</span>
          </div>

          <div onClick={() => onNavigate('programs')} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs cursor-pointer">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-2xl font-black text-slate-800 block">{toPersianDigits(programs.length)}</span>
            <span className="text-[11px] font-medium text-slate-500">طرح‌ها (۵ حوزه)</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <Share2 className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-2xl font-black text-slate-800 block">{toPersianDigits(overall.totalAssignments)}</span>
            <span className="text-[11px] font-medium text-slate-500">کل اجراها</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-black text-emerald-700 block">{toPersianDigits(overall.done)}</span>
            <span className="text-[11px] font-bold text-emerald-800">انجام شده</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/20">
            <div className="flex items-center justify-between text-amber-700 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-2xl font-black text-amber-700 block">{toPersianDigits(overall.late)}</span>
            <span className="text-[11px] font-bold text-amber-800">دیر انجام شده</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
            <div className="flex items-center justify-between text-rose-700 mb-2">
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <span className="text-2xl font-black text-rose-700 block">{toPersianDigits(overall.notDone)}</span>
            <span className="text-[11px] font-bold text-rose-800">انجام نشده</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs bg-gradient-to-b from-white to-emerald-50/30">
            <div className="text-[10px] font-bold text-slate-500 mb-2">📊 درصد پیشرفت</div>
            <span className="text-2xl font-black text-emerald-700 block">%{toPersianDigits(overall.progressPercent)}</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs bg-gradient-to-b from-white to-blue-50/30">
            <div className="text-[10px] font-bold text-slate-500 mb-2">⏱️ اجرای به‌موقع</div>
            <span className="text-2xl font-black text-blue-700 block">%{toPersianDigits(overall.onTimePercent)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Rankings Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Status Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">نمودار کلی وضعیت تکالیف منطقه</h3>
              <p className="text-xs text-slate-500">تحلیل تجمیعی تمام مدارس</p>
            </div>
          </div>

          <div className="py-2">
            <PieChart
              done={overall.done}
              late={overall.late}
              notDone={overall.notDone}
              size={210}
              centerSubtitle="کل تکالیف"
            />
          </div>

          <div className="w-full mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
            <span>تعداد مدارس: <strong>{toPersianDigits(schools.length)}</strong> آموزشگاه</span>
            <button
              onClick={() => onNavigate('schools_report')}
              className="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
            >
              مشاهده مدارس ←
            </button>
          </div>
        </div>

        {/* Top Performing Staff List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>همکاران برتر با بیشترین امتیاز وزنی مکتسبه</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  رتبه‌بندی با اعمال ضرایب ۱ تا ۳ برای هر طرح
                </p>
              </div>
              <button
                onClick={() => onNavigate('ranking')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                تابلوی کامل رتبه‌بندی ←
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {rankedEmployees.map(({ emp, stats }, idx) => (
                <div
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp)}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md group-hover:bg-emerald-600 transition-colors">
                      {emp.code}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {emp.fullName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {emp.schoolName} | <span className="text-slate-400">{emp.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-xs font-black text-amber-800 font-mono">
                        {toPersianDigits(stats.earnedWeightedScore)} امتیاز با ضریب
                      </div>
                      <div className="text-[11px] text-emerald-600 font-bold">
                        %{toPersianDigits(stats.progressPercent)} پیشرفت
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              onClick={onOpenNewEmployeeModal}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>ثبت همکار</span>
            </button>

            <button
              onClick={onOpenNewProgramModal}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>تعریف طرح</span>
            </button>

            <button
              onClick={onOpenAssignModal}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-teal-600" />
              <span>تخصیص</span>
            </button>

            {onExportHtml && (
              <button
                onClick={onExportHtml}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>خروجی HTML</span>
              </button>
            )}

            <button
              onClick={onExportExcel}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>خروجی اکسل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
