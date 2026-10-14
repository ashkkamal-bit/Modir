import React, { useState, useEffect } from 'react';
import { EmployeeProgram, Program, Employee, ExecutionStatus, DocumentationPlatform } from '../types';
import { calculateAutoStatus, getCurrentJalaliDate, toPersianDigits } from '../utils/jalali';
import { X, CheckCircle2, Clock, XCircle, Sparkles, Save, Calendar, Send, Award, Layers } from 'lucide-react';

interface StatusEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: EmployeeProgram | null;
  program: Program | null;
  employee: Employee | null;
  onSave: (updated: Partial<EmployeeProgram> & { id: string }) => void;
}

const PLATFORM_OPTIONS: { id: DocumentationPlatform; label: string; desc: string; color: string; activeColor: string }[] = [
  { id: 'ایتا', label: 'ایتا (Eitaa)', desc: 'پیام‌رسان سازمانی ایتا', color: 'border-amber-300 text-amber-700 bg-amber-50/50', activeColor: 'border-amber-500 bg-amber-500 text-white shadow-sm' },
  { id: 'شاد', label: 'شاد (Shad)', desc: 'شبکه آموزشی دانش‌آموزی', color: 'border-sky-300 text-sky-700 bg-sky-50/50', activeColor: 'border-sky-600 bg-sky-600 text-white shadow-sm' },
  { id: 'اتوماسیون', label: 'اتوماسیون اداری', desc: 'مکاتبات رسمی منطقه', color: 'border-indigo-300 text-indigo-700 bg-indigo-50/50', activeColor: 'border-indigo-600 bg-indigo-600 text-white shadow-sm' },
  { id: 'سایر', label: 'سایر روش‌ها', desc: 'تحویل حضوری و...', color: 'border-slate-300 text-slate-700 bg-slate-50', activeColor: 'border-slate-700 bg-slate-800 text-white shadow-sm' },
];

export const StatusEditorModal: React.FC<StatusEditorModalProps> = ({
  isOpen,
  onClose,
  assignment,
  program,
  employee,
  onSave,
}) => {
  const [status, setStatus] = useState<ExecutionStatus>('not_done');
  const [actualDate, setActualDate] = useState<string>('');
  const [submissionDate, setSubmissionDate] = useState<string>('');
  const [submissionPlatform, setSubmissionPlatform] = useState<DocumentationPlatform>('ایتا');
  const [notes, setNotes] = useState<string>('');
  const [documentationNotes, setDocumentationNotes] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  useEffect(() => {
    if (assignment) {
      setStatus(assignment.status);
      const exec = assignment.executionDate || assignment.actualDate || '';
      setActualDate(exec);
      setSubmissionDate(assignment.submissionDate || assignment.docSubmissionDate || exec || '');
      setSubmissionPlatform(assignment.submissionPlatform || assignment.documentationPlatform || 'ایتا');
      setNotes(assignment.notes || '');
      setDocumentationNotes(assignment.documentationNotes || '');
      setIsManualOverride(assignment.isManualOverride || false);
    }
  }, [assignment, isOpen]);

  if (!isOpen || !assignment || !program || !employee) return null;

  const coeff = program.coefficient || 1;
  const sectionName = program.section || 'پرورشی';

  const handleDateChange = (dateVal: string) => {
    setActualDate(dateVal);
    if (!isManualOverride && dateVal.length >= 8) {
      const autoSt = calculateAutoStatus(program.deadline, dateVal);
      setStatus(autoSt);
    }
  };

  const handleApplyAutoDetection = () => {
    const autoSt = calculateAutoStatus(program.deadline, actualDate);
    setStatus(autoSt);
    setIsManualOverride(false);
  };

  const handleSetTodayActualDate = () => {
    const today = getCurrentJalaliDate();
    handleDateChange(today);
  };

  const handleSetTodaySubmissionDate = () => {
    const today = getCurrentJalaliDate();
    setSubmissionDate(today);
  };

  const handleManualStatusSelect = (st: ExecutionStatus) => {
    setStatus(st);
    setIsManualOverride(true);
    if ((st === 'done' || st === 'late') && !actualDate) {
      const targetDate = st === 'done' ? program.deadline : getCurrentJalaliDate();
      setActualDate(targetDate);
      if (!submissionDate) setSubmissionDate(targetDate);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const execDate = actualDate.trim() || undefined;
    const subDate = submissionDate.trim() || execDate;

    onSave({
      id: assignment.id,
      status,
      actualDate: execDate,
      executionDate: execDate,
      submissionDate: subDate,
      docSubmissionDate: subDate,
      submissionPlatform,
      documentationPlatform: submissionPlatform,
      notes: notes.trim(),
      documentationNotes: documentationNotes.trim(),
      isManualOverride,
      updatedAt: getCurrentJalaliDate(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-sm">
                کد همکار: {employee.code}
              </span>
              <h3 className="text-base font-bold">{employee.fullName}</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-300 truncate max-w-xs">
                طرح: {program.title}
              </span>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded text-[11px] font-bold">
                {sectionName}
              </span>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold">
                ضریب {toPersianDigits(coeff)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-amber-900">مهلت مقرر: </span>
              <span className="font-bold text-slate-900 font-mono text-sm ml-2">{program.deadline}</span>
              <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                ضریب وزنی: {toPersianDigits(coeff)} (به‌موقع: {toPersianDigits(coeff * 100)} امتیاز)
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyAutoDetection}
              className="flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>تشخیص خودکار</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>تاریخ اجرای طرح (شمسی):</span>
                <button
                  type="button"
                  onClick={handleSetTodayActualDate}
                  className="text-[11px] text-emerald-600 hover:text-emerald-800 font-normal cursor-pointer"
                >
                  امروز
                </button>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={actualDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  placeholder="مثال: 1403/08/25"
                  dir="ltr"
                  className="w-full text-center font-mono text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>تاریخ ارسال مستندات (شمسی):</span>
                <button
                  type="button"
                  onClick={handleSetTodaySubmissionDate}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-normal cursor-pointer"
                >
                  امروز
                </button>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={submissionDate}
                  onChange={(e) => setSubmissionDate(e.target.value)}
                  placeholder="مثال: 1403/08/26"
                  dir="ltr"
                  className="w-full text-center font-mono text-sm px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <Send className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              محل ارسال مستندات:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORM_OPTIONS.map((plat) => {
                const isSelected = submissionPlatform === plat.id;
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => setSubmissionPlatform(plat.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected ? plat.activeColor : `${plat.color} hover:shadow-xs`
                    }`}
                  >
                    <span className="font-bold text-xs">{plat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              وضعیت اجرای برنامه (امتیاز با ضریب {toPersianDigits(coeff)}):
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleManualStatusSelect('done')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  status === 'done'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <CheckCircle2 className={`w-6 h-6 mb-1 ${status === 'done' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">🟢 انجام شده</span>
                <span className="text-[10px] text-emerald-700 font-bold mt-0.5">+{toPersianDigits(coeff * 100)} امتیاز</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualStatusSelect('late')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  status === 'late'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <Clock className={`w-6 h-6 mb-1 ${status === 'late' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">🟠 دیر انجام شده</span>
                <span className="text-[10px] text-amber-700 font-bold mt-0.5">+{toPersianDigits(coeff * 60)} امتیاز</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualStatusSelect('not_done')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  status === 'not_done'
                    ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-sm ring-2 ring-rose-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <XCircle className={`w-6 h-6 mb-1 ${status === 'not_done' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">🔴 انجام نشده</span>
                <span className="text-[10px] text-slate-500 mt-0.5">۰ امتیاز</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات و مستندات:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نحوه اجرا، مشخصات پیوست، شماره ثبت..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره وضعیت</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
