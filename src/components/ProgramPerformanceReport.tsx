import React, { useState } from 'react';
import { Program, Employee, EmployeeProgram, PROGRAM_SECTIONS } from '../types';
import { calculateProgramStats } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import { PieChart } from './PieChart';
import { StatusBadge } from './StatusBadge';
import { BookOpen, Printer, FileSpreadsheet, Share2, Plus, Award, Layers } from 'lucide-react';

interface ProgramPerformanceReportProps {
  programs: Program[];
  employees: Employee[];
  employeePrograms: EmployeeProgram[];
  onOpenNewProgramModal: () => void;
  onOpenAssignModal: (preselectedProgramId?: string) => void;
  onSelectEmployee: (emp: Employee) => void;
  onExportExcel: () => void;
  onUpdateStatus: (updated: Partial<EmployeeProgram> & { id: string }) => void;
}

export const ProgramPerformanceReport: React.FC<ProgramPerformanceReportProps> = ({
  programs,
  employees,
  employeePrograms,
  onOpenNewProgramModal,
  onOpenAssignModal,
  onSelectEmployee,
  onExportExcel,
  onUpdateStatus,
}) => {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id || '');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredPrograms = programs.filter((p) => {
    if (filterSection !== 'all' && (p.section || 'پرورشی') !== filterSection) return false;
    return true;
  });

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) || filteredPrograms[0] || programs[0];
  const pStats = selectedProgram
    ? calculateProgramStats(selectedProgram.id, employeePrograms)
    : { totalAssigned: 0, done: 0, late: 0, notDone: 0, progressPercent: 0, onTimePercent: 0 };

  const coeff = selectedProgram?.coefficient || 1;
  const sectionName = selectedProgram?.section || 'پرورشی';

  const assignments = selectedProgram
    ? employeePrograms.filter((ep) => ep.programId === selectedProgram.id)
    : [];

  const empMap = new Map(employees.map((e) => [e.id, e]));

  const filteredAssignments = assignments.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span>تحلیل و گزارش عملکرد به تفکیک برنامه و ۵ حوزه تخصصی</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مشاهده میزان تحقق هر طرح در سطح منطقه با ضرایب ۱ تا ۳
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ گزارش</span>
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>خروجی Excel</span>
          </button>
          <button
            onClick={onOpenNewProgramModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف برنامه جدید</span>
          </button>
        </div>
      </div>

      {/* Program Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">فیلتر حوزه:</span>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            >
              <option value="all">همه ۵ حوزه</option>
              {PROGRAM_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400">
            تعداد طرح‌ها: {toPersianDigits(filteredPrograms.length)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            طرح مورد نظر را انتخاب نمایید:
          </label>
          <select
            value={selectedProgram?.id || ''}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full text-sm font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
          >
            {filteredPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.title} - ({p.section || 'پرورشی'}) | ضریب: {toPersianDigits(p.coefficient || 1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedProgram && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>حوزه: {sectionName}</span>
                    </span>
                    <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>ضریب: {toPersianDigits(coeff)}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      کد: {selectedProgram.code}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2">{selectedProgram.title}</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block">مهلت نهایی:</span>
                    <strong className="font-mono text-rose-600">{selectedProgram.deadline}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">امتیاز به‌موقع / تاخیر:</span>
                    <strong className="text-amber-800 font-mono">
                      {toPersianDigits(coeff * 100)} / {toPersianDigits(coeff * 60)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">تعداد افراد مشمول:</span>
                    <strong className="text-slate-800">{toPersianDigits(pStats.totalAssigned)} نفر</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">درصد تحقق:</span>
                    <strong className="text-emerald-700">%{toPersianDigits(pStats.progressPercent)}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenAssignModal(selectedProgram.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>اختصاص به همکاران دیگر</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center">
              <PieChart
                done={pStats.done}
                late={pStats.late}
                notDone={pStats.notDone}
                size={160}
                centerSubtitle="مشمولین"
                title="نمودار وضعیت اجرای طرح"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-slate-800 text-sm">
              همکاران مشمول طرح «{selectedProgram.title}» ({toPersianDigits(assignments.length)} نفر)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 w-20 text-center">کد همکار</th>
                    <th className="p-3">نام و نام خانوادگی</th>
                    <th className="p-3">آموزشگاه</th>
                    <th className="p-3 text-center">تاریخ اجرا</th>
                    <th className="p-3 text-center">وضعیت</th>
                    <th className="p-3 text-center">امتیاز کسب‌شده</th>
                    <th className="p-3 text-center no-print">کارتابل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAssignments.map((a, idx) => {
                    const emp = empMap.get(a.employeeId);
                    if (!emp) return null;
                    const earnedScore = a.status === 'done' ? coeff * 100 : a.status === 'late' ? coeff * 60 : 0;

                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                        <td className="p-3 text-center font-mono font-bold">{emp.code}</td>
                        <td className="p-3 font-bold text-slate-800">{emp.fullName}</td>
                        <td className="p-3 text-slate-600">{emp.schoolName}</td>
                        <td className="p-3 text-center font-mono">{a.actualDate || '---'}</td>
                        <td className="p-3 text-center"><StatusBadge status={a.status} size="sm" /></td>
                        <td className="p-3 text-center font-bold text-emerald-700">+{toPersianDigits(earnedScore)}</td>
                        <td className="p-3 text-center no-print">
                          <button
                            onClick={() => onSelectEmployee(emp)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            کارتابل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
