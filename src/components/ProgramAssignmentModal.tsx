import React, { useState } from 'react';
import { Program, Employee, EmployeeProgram, PROGRAM_SECTIONS } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { X, CheckSquare, Square, Share2, Check, Trash2, Layers } from 'lucide-react';

interface ProgramAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: Program[];
  employees: Employee[];
  existingAssignments: EmployeeProgram[];
  onAssign: (programId: string, employeeIds: string[]) => void;
  onUnassign?: (programId: string, employeeId: string) => void;
  preselectedProgramId?: string;
  preselectedEmployeeId?: string;
}

export const ProgramAssignmentModal: React.FC<ProgramAssignmentModalProps> = ({
  isOpen,
  onClose,
  programs,
  employees,
  existingAssignments,
  onAssign,
  onUnassign,
  preselectedProgramId,
  preselectedEmployeeId,
}) => {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    preselectedProgramId || programs[0]?.id || '',
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    new Set(preselectedEmployeeId ? [preselectedEmployeeId] : []),
  );

  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [assignmentView, setAssignmentView] = useState<'all' | 'unassigned' | 'assigned'>('all');

  if (!isOpen) return null;

  const currentProgram = programs.find((p) => p.id === selectedProgramId);
  const currentCoeff = currentProgram?.coefficient || 1;
  const currentSection = currentProgram?.section || 'پرورشی';

  const alreadyAssignedSet = new Set(
    existingAssignments
      .filter((ep) => ep.programId === selectedProgramId)
      .map((ep) => ep.employeeId),
  );

  const filteredEmployees = employees.filter((emp) => {
    const isAssigned = alreadyAssignedSet.has(emp.id);
    if (assignmentView === 'assigned' && !isAssigned) return false;
    if (assignmentView === 'unassigned' && isAssigned) return false;
    if (filterSchool !== 'all' && emp.schoolId !== filterSchool) return false;
    if (filterGrade !== 'all' && emp.grade !== filterGrade) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchCode = emp.code.includes(q);
      const matchName = emp.fullName.toLowerCase().includes(q);
      const matchSchool = emp.schoolName.toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchSchool) return false;
    }
    return true;
  });

  const handleToggleEmployee = (id: string) => {
    const next = new Set(selectedEmployeeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedEmployeeIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedEmployeeIds);
    for (const emp of filteredEmployees) {
      if (!alreadyAssignedSet.has(emp.id)) {
        next.add(emp.id);
      }
    }
    setSelectedEmployeeIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedEmployeeIds(new Set());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgramId) return;
    if (selectedEmployeeIds.size === 0) return;

    onAssign(selectedProgramId, Array.from(selectedEmployeeIds));
    onClose();
  };

  const distinctSchools = Array.from(
    new Map(employees.map((e) => [e.schoolId, { id: e.schoolId, name: e.schoolName }])).values(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-6 h-6 text-teal-200" />
            <div>
              <h3 className="text-lg font-bold">اختصاص گروهی طرح به همکاران</h3>
              <p className="text-xs text-teal-100 mt-0.5">
                تخصیص یکجا برای ۵ حوزه تخصصی با اعمال ضرایب ۱ تا ۳
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
          {/* Program Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              طرح مورد نظر را انتخاب کنید:
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedEmployeeIds(new Set());
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 outline-hidden font-medium text-sm"
              required
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.title} - ({p.section || 'پرورشی'}) | ضریب: {p.coefficient || 1} | مهلت: {p.deadline}
                </option>
              ))}
            </select>
            {currentProgram && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-md font-bold text-[11px] flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>حوزه: {currentSection}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold text-[11px]">
                    ضریب: {toPersianDigits(currentCoeff)} ({toPersianDigits(currentCoeff * 100)} امتیاز به‌موقع)
                  </span>
                  <span className="text-slate-500">
                    مهلت: {currentProgram.deadline}
                  </span>
                </div>
                <span className="font-semibold text-slate-600">
                  اختصاص یافته به: {toPersianDigits(alreadyAssignedSet.size)} همکار
                </span>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block font-bold text-slate-600 mb-1">فیلتر آموزشگاه:</label>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg outline-hidden"
              >
                <option value="all">تمام آموزشگاه‌ها</option>
                {distinctSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">فیلتر مقطع:</label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg outline-hidden"
              >
                <option value="all">همه مقاطع</option>
                <option value="ابتدایی دوره اول">ابتدایی دوره اول</option>
                <option value="ابتدایی دوره دوم">ابتدایی دوره دوم</option>
                <option value="متوسطه اول">متوسطه اول</option>
                <option value="متوسطه دوم نظری">متوسطه دوم نظری</option>
                <option value="هنرستان فنی و حرفه‌ای و کاردانش">هنرستان</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">جستجو:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="کد یا نام همکار..."
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg outline-hidden"
              />
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setAssignmentView('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                assignmentView === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(employees.length)})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentView('unassigned')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                assignmentView === 'unassigned'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فاقد این طرح ({toPersianDigits(employees.length - alreadyAssignedSet.size)})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentView('assigned')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                assignmentView === 'assigned'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              دارای این طرح ({toPersianDigits(alreadyAssignedSet.size)})
            </button>
          </div>

          {/* Selection Actions */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>انتخاب فاقدین برنامه ({toPersianDigits(filteredEmployees.filter((e) => !alreadyAssignedSet.has(e.id)).length)})</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium transition-colors cursor-pointer"
              >
                لغو انتخاب
              </button>
            </div>
            <span className="font-bold text-emerald-700">
              {toPersianDigits(selectedEmployeeIds.size)} همکار جدید انتخاب شده
            </span>
          </div>

          {/* Employees List */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 min-h-[180px] bg-white">
            {filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                همکاری پیدا نشد.
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isAlready = alreadyAssignedSet.has(emp.id);
                const isChecked = selectedEmployeeIds.has(emp.id);

                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      if (!isAlready) handleToggleEmployee(emp.id);
                    }}
                    className={`p-3 flex items-center justify-between transition-colors ${
                      isAlready
                        ? 'bg-slate-50/80 hover:bg-slate-100/80'
                        : isChecked
                        ? 'bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400 shrink-0">
                        {isAlready ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200">
                            <Check className="w-3 h-3 text-teal-700" />
                            تخصیص‌یافته
                          </span>
                        ) : isChecked ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <span className="font-mono font-bold text-xs bg-slate-800 text-white px-2 py-0.5 rounded-md">
                        کد {emp.code}
                      </span>

                      <div>
                        <span className="font-bold text-sm text-slate-800 ml-2">{emp.fullName}</span>
                        <span className="text-xs text-slate-500">
                          {emp.schoolName} ({emp.role})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 hidden sm:inline">{emp.grade}</span>

                      {isAlready && onUnassign && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnassign(selectedProgramId, emp.id);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="حذف این برنامه برای این همکار"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>حذف از این همکار</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
            <div className="text-xs text-slate-500">
              با تایید، این برنامه با ضریب {toPersianDigits(currentCoeff)} برای همکاران ثبت می‌شود.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={selectedEmployeeIds.size === 0}
                className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer ${
                  selectedEmployeeIds.size > 0
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>اختصاص به {toPersianDigits(selectedEmployeeIds.size)} همکار</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
