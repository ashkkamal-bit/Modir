import React, { useState } from 'react';
import { Employee, Program, EmployeeProgram, ExecutionStatus, ProgramSection, PROGRAM_SECTIONS } from '../types';
import { calculateEmployeeDualScopeStats } from '../utils/storage';
import { toPersianDigits, padZero } from '../utils/jalali';
import { PieChart } from './PieChart';
import { StatusBadge } from './StatusBadge';
import { BatchStatusModal } from './BatchStatusModal';
import { StatusEditorModal } from './StatusEditorModal';
import {
  Building,
  GraduationCap,
  Briefcase,
  Phone,
  Zap,
  Printer,
  ChevronRight,
  ChevronLeft,
  FileEdit,
  PlusCircle,
  QrCode,
  Trash2,
  Layers,
  FileCode,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { IsfahanToranjWatermark, IsfahanArchBadge } from './IsfahanMotifs';

interface EmployeeCartableProps {
  employee: Employee;
  allEmployees: Employee[];
  programs: Program[];
  employeePrograms: EmployeeProgram[];
  onSelectEmployee: (emp: Employee) => void;
  onUpdateAssignment: (updated: Partial<EmployeeProgram> & { id: string }) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onSaveBatch: (updates: (Partial<EmployeeProgram> & { id: string })[]) => void;
  onOpenAssignModal: (preselectedEmployeeId: string) => void;
  onQuickCodeSearch: (code: string) => void;
  onExportHtml?: () => void;
}

const renderPlatformBadge = (plat?: string) => {
  if (!plat) return <span className="text-slate-300 font-normal">---</span>;
  if (plat === 'ایتا') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">🔶 ایتا</span>;
  }
  if (plat === 'شاد') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-bold">🔷 شاد</span>;
  }
  if (plat === 'اتوماسیون') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold">💼 اتوماسیون</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">📋 {plat}</span>;
};

export const EmployeeCartable: React.FC<EmployeeCartableProps> = ({
  employee,
  allEmployees,
  programs,
  employeePrograms,
  onSelectEmployee,
  onUpdateAssignment,
  onDeleteAssignment,
  onSaveBatch,
  onOpenAssignModal,
  onQuickCodeSearch,
  onExportHtml,
}) => {
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<EmployeeProgram | null>(null);
  const [confirmDeleteAssignment, setConfirmDeleteAssignment] = useState<{ id: string; title: string } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [quickJumpCode, setQuickJumpCode] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'همگانی' | 'اختصاصی'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Active Pie Chart Tab ('both' | 'general' | 'specific')
  const [pieChartTab, setPieChartTab] = useState<'both' | 'general' | 'specific'>('both');

  // Detailed Dual Scope Stats: both General and Specific programs
  const dualStats = calculateEmployeeDualScopeStats(employee.id, employeePrograms, programs);
  const { general, specific, officialScore } = dualStats;

  // Assignments for this employee
  const assignments = employeePrograms.filter((ep) => ep.employeeId === employee.id);
  const prgMap = new Map(programs.map((p) => [p.id, p]));

  // Navigation
  const currentIndex = allEmployees.findIndex((e) => e.id === employee.id);
  const prevEmployee = currentIndex > 0 ? allEmployees[currentIndex - 1] : null;
  const nextEmployee = currentIndex < allEmployees.length - 1 ? allEmployees[currentIndex + 1] : null;

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    const prg = prgMap.get(a.programId);
    if (!prg) return false;
    if (filterSection !== 'all') {
      const pSec = prg.section || 'پرورشی';
      if (pSec !== filterSection) return false;
    }
    if (filterScope !== 'all') {
      const pScope = prg.scope || 'همگانی';
      if (pScope !== filterScope) return false;
    }
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const handleQuickJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickJumpCode.trim()) {
      onQuickCodeSearch(padZero(quickJumpCode.trim()));
      setQuickJumpCode('');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeEditingProgram = editingAssignment
    ? prgMap.get(editingAssignment.programId) || null
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Quick Navigation & Jump Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 no-print">
        {/* Next / Prev buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevEmployee}
            onClick={() => prevEmployee && onSelectEmployee(prevEmployee)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              prevEmployee
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                : 'border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
            <span>همکار قبلی ({prevEmployee ? `کد ${prevEmployee.code}` : '---'})</span>
          </button>

          <button
            type="button"
            disabled={!nextEmployee}
            onClick={() => nextEmployee && onSelectEmployee(nextEmployee)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              nextEmployee
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                : 'border-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <span>همکار بعدی ({nextEmployee ? `کد ${nextEmployee.code}` : '---'})</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Quick jump to another code inside cartable */}
        <form onSubmit={handleQuickJumpSubmit} className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">پرش به کد دیگر:</span>
          <div className="relative">
            <input
              type="text"
              maxLength={4}
              value={quickJumpCode}
              onChange={(e) => setQuickJumpCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="کد مثلاً 05"
              className="w-24 text-center font-mono font-bold text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            برو
          </button>
        </form>

        {/* Actions (Batch, Print, HTML) */}
        <div className="flex items-center gap-2">
          {onExportHtml && (
            <button
              type="button"
              onClick={onExportHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="خروجی کامل کارنامه و گزارش به صورت فایل HTML"
            >
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>خروجی HTML</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="کارت شناسایی همکار"
          >
            <QrCode className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">کارت همکار</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ کارنامه</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>ثبت سریع وضعیت‌ها</span>
          </button>
        </div>
      </div>

      {/* Main Colleague Header Profile Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <IsfahanToranjWatermark className="w-64 h-64 absolute -left-12 -bottom-12 text-teal-400 pointer-events-none" opacity={0.12} />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 text-white rounded-2xl shadow-lg border-2 border-teal-300/50 shrink-0">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-wider">
                {employee.code}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-teal-100 uppercase tracking-widest mt-0.5">
                کد همکار
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-black">{employee.fullName}</h1>
                <span className="text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  کارتابل فعال
                </span>
                <IsfahanArchBadge title="ناحیه ۶ اصفهان" subtitle="ارزشیابی عملکرد" className="no-print" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-1.5 text-xs text-slate-300 mt-2">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="font-semibold text-white">{employee.schoolName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>{employee.grade}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>
                    {employee.role === 'سایر' && employee.customRoleTitle
                      ? `سایر: ${employee.customRoleTitle}`
                      : employee.role}
                  </span>
                </div>
                {employee.personnelCode && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-teal-400 font-bold text-[11px]">پرسنلی:</span>
                    <span className="font-mono text-white">{employee.personnelCode}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span dir="ltr">{employee.phone}</span>
                  </div>
                )}
              </div>

              {employee.notes && (
                <p className="text-xs text-slate-400 mt-3 pt-2.5 border-t border-slate-700/60 leading-relaxed max-w-2xl">
                  <strong>یادداشت کارشناس: </strong> {employee.notes}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap md:flex-col gap-2 w-full md:w-auto shrink-0 bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-amber-300 font-bold">امتیاز کل با ضریب:</span>
              <span className="font-mono font-black text-amber-400 text-lg">
                {toPersianDigits(officialScore)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-300">پیشرفت همگانی:</span>
              <span className="font-mono font-black text-emerald-400 text-base">
                %{toPersianDigits(general.progressPercent)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-300">طرح‌های اختصاصی:</span>
              <span className="font-mono font-black text-purple-300 text-base">
                {toPersianDigits(specific.total)} طرح
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* REQUIREMENT #2: DUAL PIE CHARTS (BOTH GENERAL AND SPECIFIC PROGRAMS!) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                نمودارهای دایره‌ای عملکرد همکار: تفکیک «طرح‌های همگانی» و «طرح‌های اختصاصی»
              </h3>
              <p className="text-xs text-slate-500">
                بررسی مجزا و شفاف وضعیت اجرای طرح‌های مشمول رتبه‌بندی (همگانی) و طرح‌های موردی (اختصاصی)
              </p>
            </div>
          </div>

          {/* Switch Tab Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setPieChartTab('both')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                pieChartTab === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نمایش هر دو نمودار کنار هم
            </button>
            <button
              type="button"
              onClick={() => setPieChartTab('general')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                pieChartTab === 'general' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              🌐 فقط طرح‌های همگانی ({toPersianDigits(general.total)})
            </button>
            <button
              type="button"
              onClick={() => setPieChartTab('specific')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                pieChartTab === 'specific' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              ⭐ فقط طرح‌های اختصاصی ({toPersianDigits(specific.total)})
            </button>
          </div>
        </div>

        {/* Charts Grid */}
        <div className={`grid gap-6 ${pieChartTab === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-lg mx-auto'}`}>
          {/* Chart 1: General Programs (طرح‌های همگانی) */}
          {(pieChartTab === 'both' || pieChartTab === 'general') && (
            <div className="bg-gradient-to-b from-blue-50/30 to-white p-5 rounded-2xl border border-blue-200/80 flex flex-col items-center justify-between shadow-2xs">
              <div className="w-full flex items-center justify-between mb-3 border-b border-blue-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                  <h4 className="font-bold text-xs text-blue-950">نمودار دایره‌ای طرح‌های همگانی</h4>
                </div>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                  مؤثر در امتیاز با ضرایب ({toPersianDigits(officialScore)} امتیاز)
                </span>
              </div>

              <PieChart
                done={general.done}
                late={general.late}
                notDone={general.notDone}
                size={170}
                centerSubtitle="طرح همگانی"
              />

              <div className="w-full mt-3 pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] text-blue-900">
                <span>پیشرفت همگانی: <strong>%{toPersianDigits(general.progressPercent)}</strong></span>
                <span>به‌موقع: <strong>%{toPersianDigits(general.onTimePercent)}</strong></span>
                <span>کل: <strong>{toPersianDigits(general.total)} مورد</strong></span>
              </div>
            </div>
          )}

          {/* Chart 2: Specific Programs (طرح‌های اختصاصی) */}
          {(pieChartTab === 'both' || pieChartTab === 'specific') && (
            <div className="bg-gradient-to-b from-purple-50/30 to-white p-5 rounded-2xl border border-purple-200/80 flex flex-col items-center justify-between shadow-2xs">
              <div className="w-full flex items-center justify-between mb-3 border-b border-purple-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
                  <h4 className="font-bold text-xs text-purple-950">نمودار دایره‌ای طرح‌های اختصاصی</h4>
                </div>
                <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                  طرح‌های موردی و ویژه (بدون تأثیر در رتبه)
                </span>
              </div>

              <PieChart
                done={specific.done}
                late={specific.late}
                notDone={specific.notDone}
                size={170}
                centerSubtitle="طرح اختصاصی"
              />

              <div className="w-full mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px] text-purple-900">
                <span>پیشرفت اختصاصی: <strong>%{toPersianDigits(specific.progressPercent)}</strong></span>
                <span>انجام شده: <strong>{toPersianDigits(specific.done)} مورد</strong></span>
                <span>کل: <strong>{toPersianDigits(specific.total)} مورد</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assigned Programs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Filters */}
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              لیست تکالیف و برنامه‌های این همکار
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              فیلتر بر اساس ۵ حوزه (پرورشی، ابتدایی، متوسطه اول، متوسطه دوم، تربیت بدنی) یا دامنه برنامه
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 no-print">
            {/* Filter by 5 Sections */}
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="text-xs p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
            >
              <option value="all">همه ۵ حوزه تخصصی</option>
              {PROGRAM_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {/* Filter by scope */}
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value as any)}
              className="text-xs p-2 font-bold bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
            >
              <option value="all">همه برنامه‌ها (همگانی و اختصاصی)</option>
              <option value="همگانی">🌐 فقط همگانی</option>
              <option value="اختصاصی">⭐ فقط اختصاصی</option>
            </select>

            {/* Filter by status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
            >
              <option value="all">تمام وضعیت‌ها</option>
              <option value="done">فقط انجام شده</option>
              <option value="late">فقط دیر انجام شده</option>
              <option value="not_done">فقط انجام نشده</option>
            </select>

            <button
              type="button"
              onClick={() => onOpenAssignModal(employee.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>اختصاص برنامه جدید</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5">عنوان برنامه / طرح</th>
                <th className="p-3.5 text-center">حوزه (از ۵ بخش)</th>
                <th className="p-3.5 text-center">ضریب طرح</th>
                <th className="p-3.5 text-center">مهلت مقرر</th>
                <th className="p-3.5 text-center">تاریخ اجرای طرح</th>
                <th className="p-3.5 text-center">محل ارسال</th>
                <th className="p-3.5 text-center">وضعیت</th>
                <th className="p-3.5 text-center">امتیاز مکتسبه</th>
                <th className="p-3.5">توضیحات و مستندات</th>
                <th className="p-3.5 text-center no-print">تغییر وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    هیچ برنامه‌ای با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment, idx) => {
                  const prg = prgMap.get(assignment.programId);
                  if (!prg) return null;

                  const execDate = assignment.executionDate || assignment.actualDate;
                  const platform = assignment.submissionPlatform || assignment.documentationPlatform;
                  const isSpecific = prg.scope === 'اختصاصی';
                  const coeff = prg.coefficient || 1;
                  const sectionName = prg.section || 'پرورشی';

                  let taskPoints = 0;
                  if (!isSpecific) {
                    if (assignment.status === 'done') taskPoints = coeff * 100;
                    else if (assignment.status === 'late') taskPoints = coeff * 60;
                  }

                  return (
                    <tr
                      key={assignment.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="p-3.5 text-center text-slate-400 font-bold">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{prg.title}</span>
                          {isSpecific ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              ⭐ اختصاصی
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              🌐 همگانی
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          کد طرح: {prg.code}
                        </div>
                      </td>

                      {/* Section Badge */}
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-bold">
                          <Layers className="w-3 h-3 text-indigo-600" />
                          <span>{sectionName}</span>
                        </span>
                      </td>

                      {/* Coefficient Column */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                          coeff === 3
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : coeff === 2
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          <span>ضریب {toPersianDigits(coeff)}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-center font-mono font-medium text-slate-600">
                        {prg.deadline}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                        {execDate || <span className="text-slate-300 font-normal">---</span>}
                      </td>

                      <td className="p-3.5 text-center">
                        {renderPlatformBadge(platform)}
                      </td>

                      <td className="p-3.5 text-center">
                        <StatusBadge status={assignment.status} size="md" />
                      </td>

                      <td className="p-3.5 text-center">
                        {isSpecific ? (
                          <span className="text-slate-400 text-[11px]">بدون امتیاز</span>
                        ) : (
                          <span className={`font-mono font-bold text-xs ${
                            taskPoints > 0 ? 'text-emerald-700' : 'text-slate-400'
                          }`}>
                            +{toPersianDigits(taskPoints)}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-xs">
                        {assignment.notes ? (
                          <p className="text-slate-700 line-clamp-2">{assignment.notes}</p>
                        ) : (
                          <span className="text-slate-300">بدون یادداشت</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="علامت‌گذاری انجام شده"
                            onClick={() =>
                              onUpdateAssignment({
                                id: assignment.id,
                                status: 'done',
                                actualDate: execDate || prg.deadline,
                                executionDate: execDate || prg.deadline,
                                submissionPlatform: platform || 'ایتا',
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              assignment.status === 'done'
                                ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            🟢
                          </button>

                          <button
                            type="button"
                            title="علامت‌گذاری با تاخیر"
                            onClick={() =>
                              onUpdateAssignment({
                                id: assignment.id,
                                status: 'late',
                                actualDate: execDate || prg.deadline,
                                executionDate: execDate || prg.deadline,
                                submissionPlatform: platform || 'ایتا',
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              assignment.status === 'late'
                                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            🟠
                          </button>

                          <button
                            type="button"
                            title="علامت‌گذاری انجام نشده"
                            onClick={() =>
                              onUpdateAssignment({
                                id: assignment.id,
                                status: 'not_done',
                                actualDate: undefined,
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              assignment.status === 'not_done'
                                ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-400'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            🔴
                          </button>

                          <button
                            type="button"
                            title="ویرایش کامل، ثبت تاریخ و یادداشت"
                            onClick={() => setEditingAssignment(assignment)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileEdit className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="حذف این برنامه برای این همکار"
                            onClick={() => setConfirmDeleteAssignment({ id: assignment.id, title: prg.title })}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Removing Program from Employee */}
      {confirmDeleteAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden p-6 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              حذف برنامه از کارتابل همکار
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              آیا از حذف برنامه <strong>«{confirmDeleteAssignment.title}»</strong> برای همکار <strong>«{employee.fullName}»</strong> اطمینان دارید؟
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteAssignment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAssignment(confirmDeleteAssignment.id);
                  setConfirmDeleteAssignment(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                بله، این برنامه را برای این همکار حذف کن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      {isBatchModalOpen && (
        <BatchStatusModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          employee={employee}
          assignments={assignments}
          programs={programs}
          onSaveBatch={onSaveBatch}
        />
      )}

      {/* Single Status Editor Modal */}
      {editingAssignment && (
        <StatusEditorModal
          isOpen={Boolean(editingAssignment)}
          onClose={() => setEditingAssignment(null)}
          assignment={editingAssignment}
          program={activeEditingProgram}
          employee={employee}
          onSave={onUpdateAssignment}
        />
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden p-6 text-center animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">کارت هوشمند و شناسه همکار</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mb-3">
              <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center shadow-md mx-auto">
                <span className="text-2xl font-mono font-black">{employee.code}</span>
                <span className="text-[8px] text-emerald-400">شناسه</span>
              </div>
            </div>
            <h4 className="text-base font-bold text-slate-800">{employee.fullName}</h4>
            <p className="text-xs text-slate-500 mt-1">{employee.schoolName}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
