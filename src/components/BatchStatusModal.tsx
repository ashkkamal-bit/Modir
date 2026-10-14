import React, { useState } from 'react';
import { Employee, Program, EmployeeProgram, ExecutionStatus, DocumentationPlatform } from '../types';
import { getCurrentJalaliDate, toPersianDigits } from '../utils/jalali';
import { X, CheckCircle2, Clock, XCircle, Zap, Save, CheckCheck } from 'lucide-react';

interface BatchStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  assignments: EmployeeProgram[];
  programs: Program[];
  onSaveBatch: (updates: (Partial<EmployeeProgram> & { id: string })[]) => void;
}

export const BatchStatusModal: React.FC<BatchStatusModalProps> = ({
  isOpen,
  onClose,
  employee,
  assignments,
  programs,
  onSaveBatch,
}) => {
  const [rows, setRows] = useState<
    {
      id: string;
      programId: string;
      status: ExecutionStatus;
      actualDate: string;
      submissionDate: string;
      submissionPlatform: DocumentationPlatform;
      notes: string;
    }[]
  >(() =>
    assignments.map((a) => {
      const exec = a.executionDate || a.actualDate || '';
      return {
        id: a.id,
        programId: a.programId,
        status: a.status,
        actualDate: exec,
        submissionDate: a.submissionDate || a.docSubmissionDate || exec,
        submissionPlatform: a.submissionPlatform || a.documentationPlatform || 'ایتا',
        notes: a.notes || '',
      };
    }),
  );

  React.useEffect(() => {
    setRows(
      assignments.map((a) => {
        const exec = a.executionDate || a.actualDate || '';
        return {
          id: a.id,
          programId: a.programId,
          status: a.status,
          actualDate: exec,
          submissionDate: a.submissionDate || a.docSubmissionDate || exec,
          submissionPlatform: a.submissionPlatform || a.documentationPlatform || 'ایتا',
          notes: a.notes || '',
        };
      }),
    );
  }, [assignments, isOpen]);

  if (!isOpen) return null;

  const prgMap = new Map(programs.map((p) => [p.id, p]));

  const handleSetRowStatus = (id: string, newStatus: ExecutionStatus) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const prg = prgMap.get(r.programId);
        let actual = r.actualDate;
        let sub = r.submissionDate;
        if (newStatus === 'done' && !actual) {
          actual = prg ? prg.deadline : getCurrentJalaliDate();
          if (!sub) sub = actual;
        } else if (newStatus === 'late' && !actual) {
          actual = getCurrentJalaliDate();
          if (!sub) sub = actual;
        }
        return { ...r, status: newStatus, actualDate: actual, submissionDate: sub };
      }),
    );
  };

  const handleSetAll = (status: ExecutionStatus) => {
    setRows((prev) =>
      prev.map((r) => {
        const prg = prgMap.get(r.programId);
        let actual = r.actualDate;
        let sub = r.submissionDate;
        if (status === 'done') {
          actual = prg ? prg.deadline : getCurrentJalaliDate();
          if (!sub) sub = actual;
        } else if (status === 'late') {
          actual = getCurrentJalaliDate();
          if (!sub) sub = actual;
        } else {
          actual = '';
          sub = '';
        }
        return { ...r, status, actualDate: actual, submissionDate: sub };
      }),
    );
  };

  const handleSetAllPlatform = (platform: DocumentationPlatform) => {
    setRows((prev) => prev.map((r) => ({ ...r, submissionPlatform: platform })));
  };

  const handleSave = () => {
    onSaveBatch(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        actualDate: r.actualDate ? r.actualDate.trim() : undefined,
        executionDate: r.actualDate ? r.actualDate.trim() : undefined,
        submissionDate: r.submissionDate ? r.submissionDate.trim() : undefined,
        docSubmissionDate: r.submissionDate ? r.submissionDate.trim() : undefined,
        submissionPlatform: r.submissionPlatform,
        documentationPlatform: r.submissionPlatform,
        notes: r.notes.trim(),
      })),
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-sm">
                  کد {employee.code}
                </span>
                <h3 className="text-lg font-bold">ثبت سریع و یکجای وضعیت برنامه‌ها</h3>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                همکار: {employee.fullName} ({employee.schoolName})
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

        {/* Quick Batch Action Bar */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700">اقدام سریع وضعیت:</span>
            <button
              type="button"
              onClick={() => handleSetAll('done')}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>همه انجام شده</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetAll('late')}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>همه با تاخیر</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetAll('not_done')}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>همه انجام نشده</span>
            </button>

            <span className="text-slate-300 mx-1">|</span>

            <span className="font-bold text-slate-700">بستر ارسال:</span>
            {(['ایتا', 'شاد', 'اتوماسیون', 'سایر'] as DocumentationPlatform[]).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => handleSetAllPlatform(plat)}
                className="px-2 py-0.5 bg-white hover:bg-slate-200 border border-slate-300 rounded-md text-[11px] font-medium cursor-pointer"
              >
                {plat}
              </button>
            ))}
          </div>
          <span className="text-slate-500">
            تعداد: <strong>{toPersianDigits(rows.length)}</strong> مورد
          </span>
        </div>

        {/* Rows Table */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[250px]">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">عنوان برنامه</th>
                  <th className="p-2.5 text-center">حوزه تخصصی</th>
                  <th className="p-2.5 w-24 text-center">مهلت</th>
                  <th className="p-2.5 w-48 text-center">وضعیت اجرا</th>
                  <th className="p-2.5 w-28 text-center">تاریخ اجرا</th>
                  <th className="p-2.5 w-28 text-center">محل ارسال</th>
                  <th className="p-2.5">یادداشت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, idx) => {
                  const prg = prgMap.get(row.programId);
                  if (!prg) return null;
                  const coeff = prg.coefficient || 1;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 text-center text-slate-400 font-bold">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 text-xs">{prg.title}</span>
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold text-[10px]">
                            ضریب {toPersianDigits(coeff)}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px]">
                          {prg.section || 'پرورشی'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-600 text-xs">
                        {prg.deadline}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(row.id, 'done')}
                            className={`px-1.5 py-1 rounded font-bold transition-all text-[11px] flex items-center gap-0.5 cursor-pointer ${
                              row.status === 'done'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>انجام شده</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(row.id, 'late')}
                            className={`px-1.5 py-1 rounded font-bold transition-all text-[11px] flex items-center gap-0.5 cursor-pointer ${
                              row.status === 'late'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>دیر</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(row.id, 'not_done')}
                            className={`px-1.5 py-1 rounded font-bold transition-all text-[11px] flex items-center gap-0.5 cursor-pointer ${
                              row.status === 'not_done'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>نشده</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="text"
                          value={row.actualDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, actualDate: val } : r)),
                            );
                          }}
                          placeholder={row.status === 'not_done' ? '---' : prg.deadline}
                          dir="ltr"
                          className="w-full text-center font-mono text-xs p-1 border border-slate-300 rounded bg-slate-50 focus:bg-white outline-hidden"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <select
                          value={row.submissionPlatform}
                          onChange={(e) => {
                            const val = e.target.value as DocumentationPlatform;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, submissionPlatform: val } : r)),
                            );
                          }}
                          className="w-full text-xs p-1 border border-slate-300 rounded bg-slate-50 font-bold text-slate-700 outline-hidden"
                        >
                          <option value="ایتا">ایتا</option>
                          <option value="شاد">شاد</option>
                          <option value="اتوماسیون">اتوماسیون</option>
                          <option value="سایر">سایر</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, notes: val } : r)),
                            );
                          }}
                          placeholder="یادداشت..."
                          className="w-full text-xs p-1 border border-slate-300 rounded bg-slate-50 focus:bg-white outline-hidden"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            با کلیک بر روی ذخیره، تمامی وضعیت‌ها یکجا اعمال می‌شوند.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره کلیه وضعیت‌ها</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
