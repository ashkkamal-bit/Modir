import React, { useState } from 'react';
import { School, Employee, EmployeeProgram, Program } from '../types';
import { calculateSchoolStats } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import { Building2, Printer, FileSpreadsheet, Search, Plus, Edit2, Trash2, Users } from 'lucide-react';

interface SchoolPerformanceReportProps {
  schools: School[];
  employees: Employee[];
  employeePrograms: EmployeeProgram[];
  programs?: Program[];
  onOpenNewSchoolModal: () => void;
  onEditSchool?: (school: School) => void;
  onDeleteSchool?: (schoolId: string) => void;
  onExportExcel: () => void;
  onFilterBySchool: (schoolId: string) => void;
}

export const SchoolPerformanceReport: React.FC<SchoolPerformanceReportProps> = ({
  schools,
  employees,
  employeePrograms,
  programs,
  onOpenNewSchoolModal,
  onEditSchool,
  onDeleteSchool,
  onExportExcel,
  onFilterBySchool,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'progress' | 'staff'>('score');

  const schoolStatsList = schools.map((school) => {
    const stats = calculateSchoolStats(school.id, employees, employeePrograms, programs);
    return {
      school,
      stats,
    };
  });

  const sortedAndFiltered = schoolStatsList
    .filter(({ school }) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        school.name.toLowerCase().includes(q) ||
        school.code.toLowerCase().includes(q) ||
        school.grade.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        if (b.stats.earnedWeightedScore !== a.stats.earnedWeightedScore) {
          return b.stats.earnedWeightedScore - a.stats.earnedWeightedScore;
        }
        return b.stats.progressPercent - a.stats.progressPercent;
      }
      if (sortBy === 'progress') {
        return b.stats.progressPercent - a.stats.progressPercent;
      }
      return b.stats.staffCount - a.stats.staffCount;
    });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>گزارش تجمیعی و رتبه‌بندی آموزشگاه‌ها و مدارس (با ضرایب طرح‌ها)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            محاسبه امتیاز نهایی مدارس بر اساس ضرایب ۱ تا ۳ طرح‌های انجام‌شده توسط نیروهای هر آموزشگاه
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ گزارش مدارس</span>
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>خروجی Excel</span>
          </button>
          <button
            onClick={onOpenNewSchoolModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت آموزشگاه جدید</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام یا کد آموزشگاه..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
          >
            <option value="score">🏆 بیشترین امتیاز وزنی مکتسبه</option>
            <option value="progress">📈 بالاترین درصد پیشرفت</option>
            <option value="staff">👥 تعداد نیروها</option>
          </select>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          تعداد مدارس: <strong>{toPersianDigits(sortedAndFiltered.length)}</strong> آموزشگاه
        </span>
      </div>

      {/* Schools Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">رتبه</th>
                <th className="p-3.5 w-24 text-center">کد مدرسه</th>
                <th className="p-3.5">نام آموزشگاه</th>
                <th className="p-3.5">مقطع و جنسیت</th>
                <th className="p-3.5 text-center">تعداد نیروها</th>
                <th className="p-3.5 text-center">کل تکالیف</th>
                <th className="p-3.5 text-center text-emerald-800">🟢 به‌موقع</th>
                <th className="p-3.5 text-center text-amber-800">🟠 با تأخیر</th>
                <th className="p-3.5 text-center text-rose-800">🔴 عدم اجرا</th>
                <th className="p-3.5 text-center bg-emerald-50/50">درصد پیشرفت</th>
                <th className="p-3.5 text-center bg-amber-50/50">امتیاز وزنی مدرسه</th>
                <th className="p-3.5 text-center">میانگین هر نیرو</th>
                <th className="p-3.5 text-center no-print">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedAndFiltered.map(({ school, stats }, idx) => (
                <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-slate-600">{school.code}</td>
                  <td className="p-3.5 font-bold text-slate-800 text-sm">{school.name}</td>
                  <td className="p-3.5 text-slate-600">{school.grade} ({school.gender})</td>
                  <td className="p-3.5 text-center font-bold text-slate-700">{toPersianDigits(stats.staffCount)} نفر</td>
                  <td className="p-3.5 text-center font-bold text-slate-800">{toPersianDigits(stats.totalPrograms)}</td>
                  <td className="p-3.5 text-center font-bold text-emerald-600 bg-emerald-50/30">{toPersianDigits(stats.done)}</td>
                  <td className="p-3.5 text-center font-bold text-amber-600 bg-amber-50/30">{toPersianDigits(stats.late)}</td>
                  <td className="p-3.5 text-center font-bold text-rose-600 bg-rose-50/30">{toPersianDigits(stats.notDone)}</td>
                  <td className="p-3.5 text-center font-black text-emerald-700 bg-emerald-50/60 font-mono">%{toPersianDigits(stats.progressPercent)}</td>
                  <td className="p-3.5 text-center font-black text-amber-900 bg-amber-50/60 font-mono text-sm">{toPersianDigits(stats.earnedWeightedScore)}</td>
                  <td className="p-3.5 text-center font-bold text-slate-700 font-mono">{toPersianDigits(stats.averageStaffScore)}</td>
                  <td className="p-3.5 text-center no-print">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onFilterBySchool(school.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        نیروها
                      </button>
                      {onEditSchool && (
                        <button
                          onClick={() => onEditSchool(school)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteSchool && (
                        <button
                          onClick={() => onDeleteSchool(school.id)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
