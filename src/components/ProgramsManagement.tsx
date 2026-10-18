import React, { useState } from 'react';
import { Program, ProgramSection, PROGRAM_SECTIONS } from '../types';
import { toPersianDigits } from '../utils/jalali';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  Share2,
  Calendar,
  AlertTriangle,
  Layers,
  Upload,
  FileSpreadsheet,
} from 'lucide-react';

interface ProgramsManagementProps {
  programs: Program[];
  onOpenNewProgramModal: () => void;
  onEditProgram: (program: Program) => void;
  onDeleteProgram: (programId: string) => void;
  onOpenAssignModal: (programId: string) => void;
  onToggleActive: (programId: string) => void;
  onNavigateToExcelImport?: () => void;
  onNavigateToPerProgramBulk?: (programId: string) => void;
}

export const ProgramsManagement: React.FC<ProgramsManagementProps> = ({
  programs,
  onOpenNewProgramModal,
  onEditProgram,
  onDeleteProgram,
  onOpenAssignModal,
  onToggleActive,
  onNavigateToExcelImport,
  onNavigateToPerProgramBulk,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<'all' | 'همگانی' | 'اختصاصی'>('all');
  const [filterCoefficient, setFilterCoefficient] = useState<string>('all');

  // In-app deletion confirmation modal (no window.confirm!)
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);

  const filtered = programs.filter((p) => {
    if (filterSection !== 'all') {
      const pSec = p.section || 'پرورشی';
      if (pSec !== filterSection) return false;
    }
    if (filterScope !== 'all') {
      const pScope = p.scope || 'همگانی';
      if (pScope !== filterScope) return false;
    }
    if (filterCoefficient !== 'all') {
      const coeff = p.coefficient || 1;
      if (String(coeff) !== filterCoefficient) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        p.code.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.section && p.section.toLowerCase().includes(q)) ||
        (p.axis && p.axis.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const renderCoefficientBadge = (coeff: number = 1) => {
    if (coeff === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-black shadow-xs" title="ضریب ۳: ویژه (۳۰۰ امتیاز به‌موقع)">
          <span>⭐⭐⭐</span>
          <span>ضریب ۳ (ویژه)</span>
        </span>
      );
    }
    if (coeff === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold" title="ضریب ۲: بااهمیت (۲۰۰ امتیاز به‌موقع)">
          <span>⭐⭐</span>
          <span>ضریب ۲ (مهم)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold" title="ضریب ۱: عادی (۱۰۰ امتیاز به‌موقع)">
        <span>⭐</span>
        <span>ضریب ۱ (عادی)</span>
      </span>
    );
  };

  const getSectionBadgeColor = (sec?: ProgramSection) => {
    switch (sec) {
      case 'پرورشی':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'آموزش ابتدایی':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'آموزش متوسطه اول':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'آموزش متوسطه دوم':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'تربیت بدنی':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleConfirmDelete = () => {
    if (programToDelete) {
      onDeleteProgram(programToDelete.id);
      setProgramToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span>تعریف و مدیریت طرح‌ها و برنامه‌ها (۵ حوزه تخصصی)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            دسته‌بندی طرح‌ها در ۵ بخش (پرورشی، آموزش ابتدایی، آموزش متوسطه اول، آموزش متوسطه دوم، تربیت بدنی) با ضرایب ۱ تا ۳
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToExcelImport && (
            <button
              onClick={onNavigateToExcelImport}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>ورود گروهی طرح‌ها از Excel</span>
            </button>
          )}

          <button
            onClick={onOpenNewProgramModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف برنامه / طرح جدید</span>
          </button>
        </div>
      </div>

      {/* 5 Sections Quick Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto text-xs font-bold">
        <span className="text-slate-400 pl-2 shrink-0">حوزه‌های پنج‌گانه:</span>
        <button
          onClick={() => setFilterSection('all')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            filterSection === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          همه حوزه‌ها ({toPersianDigits(programs.length)})
        </button>
        {PROGRAM_SECTIONS.map((sec) => {
          const count = programs.filter((p) => (p.section || 'پرورشی') === sec).length;
          const isSelected = filterSection === sec;
          return (
            <button
              key={sec}
              onClick={() => setFilterSection(sec)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{sec}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {toPersianDigits(count)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-3xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس کد، عنوان، حوزه یا توضیحات..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <select
            value={filterCoefficient}
            onChange={(e) => setFilterCoefficient(e.target.value)}
            className="py-2 px-3 text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 rounded-xl focus:bg-white outline-hidden"
          >
            <option value="all">همه ضرایب (۱، ۲ و ۳)</option>
            <option value="3">⭐⭐⭐ فقط طرح‌های ضریب ۳ (ویژه)</option>
            <option value="2">⭐⭐ فقط طرح‌های ضریب ۲ (مهم)</option>
            <option value="1">⭐ فقط طرح‌های ضریب ۱ (عادی)</option>
          </select>

          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as any)}
            className="py-2 px-3 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
          >
            <option value="all">همه انواع (همگانی و اختصاصی)</option>
            <option value="همگانی">🌐 فقط برنامه‌های همگانی (مؤثر در رتبه)</option>
            <option value="اختصاصی">⭐ فقط برنامه‌های اختصاصی (بدون امتیاز)</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          نمایش: <strong>{toPersianDigits(filtered.length)}</strong> از {toPersianDigits(programs.length)} طرح
        </span>
      </div>

      {/* Grid of Programs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((prg) => {
          const isSpecific = prg.scope === 'اختصاصی';
          const coeff = prg.coefficient || 1;
          const sectionName = prg.section || 'پرورشی';

          return (
            <div
              key={prg.id}
              className={`bg-white p-5 rounded-2xl border shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between ${
                coeff === 3
                  ? 'border-amber-300 bg-gradient-to-b from-white to-amber-50/20'
                  : isSpecific
                  ? 'border-purple-200'
                  : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                      {prg.code}
                    </span>

                    {/* Section Badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-lg text-xs font-bold ${getSectionBadgeColor(sectionName)}`}>
                      <Layers className="w-3 h-3" />
                      <span>{sectionName}</span>
                    </span>

                    {/* Coefficient Badge */}
                    {renderCoefficientBadge(coeff)}

                    {isSpecific ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold rounded-md">
                        ⭐ اختصاصی
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold rounded-md">
                        🌐 همگانی
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleActive(prg.id)}
                      title={prg.isActive ? 'غیرفعال کردن' : 'فعال‌سازی'}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        prg.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {prg.isActive ? 'فعال' : 'غیرفعال'}
                    </button>

                    <button
                      onClick={() => onEditProgram(prg)}
                      title="ویرایش برنامه و ضریب آن"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* DELETE BUTTON with In-App Confirmation Modal */}
                    <button
                      onClick={() => setProgramToDelete(prg)}
                      title="حذف کامل این برنامه از کل سیستم"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-800 mb-1">{prg.title}</h3>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {prg.axis && (
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md">
                      موضوع: {prg.axis}
                    </span>
                  )}
                  <span className="text-[11px] text-amber-800 font-bold">
                    امتیاز به‌موقع: {toPersianDigits(coeff * 100)} | تاخیر: {toPersianDigits(coeff * 60)}
                  </span>
                </div>

                {prg.description && (
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-3">
                    {prg.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>شروع: </span>
                    <strong className="font-mono text-slate-700">{prg.startDate}</strong>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span>مهلت نهایی: </span>
                    <strong className="font-mono text-rose-600">{prg.deadline}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  وزن در رتبه‌بندی: <strong>{toPersianDigits(coeff)} برابر</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  {onNavigateToPerProgramBulk && (
                    <button
                      type="button"
                      onClick={() => onNavigateToPerProgramBulk(prg.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      title="ورود گروهی عملکرد این طرح از اکسل یا ثبت مستقیم"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>ورود گروهی این طرح</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenAssignModal(prg.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>تخصیص</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* In-App Deletion Confirmation Modal (Reliable in iframes!) */}
      {programToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden p-6 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              حذف قطعی برنامه از سامانه
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              آیا از حذف کامل طرح <strong>«{programToDelete.title}»</strong> (کد {programToDelete.code}) اطمینان دارید؟
              <br />
              <span className="text-rose-600 font-semibold block mt-1">
                توجه: تمامی سوابق تکالیف این برنامه برای کلیه همکاران نیز حذف خواهد شد.
              </span>
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setProgramToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                بله، این برنامه را حذف کن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
