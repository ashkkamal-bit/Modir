import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  Employee,
  Program,
  EmployeeProgram,
  ExecutionStatus,
  STANDARD_ROLES,
  StandardStaffRole,
} from '../types';
import { normalizePersianText } from '../utils/storage';
import { toPersianDigits, getCurrentJalaliDate, updateJalaliDateToCurrentYear } from '../utils/jalali';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Check,
  RefreshCw,
  Layers,
  ArrowRight,
  UserX,
} from 'lucide-react';

interface ExcelBulkImportProps {
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
  onNavigateToTab?: (tab: string) => void;
}

interface ParsedRow {
  rowIdx: number;
  schoolCode: string;
  schoolName: string;
  personnelCode: string;
  employeeCode: string;
  fullName: string;
  role: string;
  programTitle: string;
  programCode: string;
  statusText: string;
  executionDate: string;
  notes: string;
  matchedEmployee?: Employee;
  matchedProgram?: Program;
  resolvedStatus: ExecutionStatus;
  statusMatchReason: string;
  isDuplicate: boolean;
  isAmbiguous: boolean;
  matchType: 'personnel_code' | 'emp_code' | 'name' | 'unmatched';
}

export const ExcelBulkImport: React.FC<ExcelBulkImportProps> = ({
  db,
  onUpdateDatabase,
  onNavigateToTab,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);

  const [importMode, setImportMode] = useState<'completed_only' | 'full_scope'>('completed_only');
  const [targetProgramId, setTargetProgramId] = useState<string>(
    db.programs[0]?.id || '',
  );

  const [columnMap, setColumnMap] = useState<{
    personnelCode: string;
    employeeCode: string;
    fullName: string;
    schoolCode: string;
    schoolName: string;
    role: string;
    programTitle: string;
    status: string;
    date: string;
    notes: string;
  }>({
    personnelCode: '',
    employeeCode: '',
    fullName: '',
    schoolCode: '',
    schoolName: '',
    role: '',
    programTitle: '',
    status: '',
    date: '',
    notes: '',
  });

  const [updateRolesFromExcel, setUpdateRolesFromExcel] = useState(true);
  const [autoMarkUnlistedAsNotDone, setAutoMarkUnlistedAsNotDone] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    totalRows: number;
    matchedCount: number;
    updatedAssignmentsCount: number;
    createdAssignmentsCount: number;
    updatedRolesCount: number;
    unmatchedCount: number;
    duplicatesCount: number;
    message: string;
  } | null>(null);

  const autoDetectColumns = (headers: string[]) => {
    const map = {
      personnelCode: '',
      employeeCode: '',
      fullName: '',
      schoolCode: '',
      schoolName: '',
      role: '',
      programTitle: '',
      status: '',
      date: '',
      notes: '',
    };

    headers.forEach((h) => {
      const norm = normalizePersianText(h);
      if (norm.includes('پرسنلی') || norm.includes('شناسه') || norm.includes('کد ملی') || norm.includes('id')) {
        map.personnelCode = h;
      } else if ((norm.includes('کد') && norm.includes('همکار')) || norm === 'کد' || norm.includes('کد دو رقمی')) {
        map.employeeCode = h;
      } else if (norm.includes('نام') && (norm.includes('خانوادگی') || norm.includes('همکار') || norm.includes('فرد') || norm === 'نام')) {
        map.fullName = h;
      } else if (norm.includes('کد') && (norm.includes('مدرسه') || norm.includes('آموزشگاه'))) {
        map.schoolCode = h;
      } else if (norm.includes('نام') && (norm.includes('مدرسه') || norm.includes('آموزشگاه'))) {
        map.schoolName = h;
      } else if (norm.includes('سمت') || norm.includes('پست') || norm.includes('نقش') || norm.includes('شغل')) {
        map.role = h;
      } else if (norm.includes('طرح') || norm.includes('برنامه') || norm.includes('فعالیت') || norm.includes('عنوان')) {
        map.programTitle = h;
      } else if (norm.includes('وضعیت') || norm.includes('نتیجه') || norm.includes('اجرا')) {
        map.status = h;
      } else if (norm.includes('تاریخ') || norm.includes('مهلت') || norm.includes('زمان')) {
        map.date = h;
      } else if (norm.includes('توضیح') || norm.includes('یادداشت') || norm.includes('مستند')) {
        map.notes = h;
      }
    });

    return map;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setExecutionResult(null);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheet(wb, firstSheet);
        }
      } catch (err: any) {
        alert('خطا در خواندن فایل اکسل: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (json.length === 0) return;

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(json.length, 5); i++) {
      if (json[i].some((cell) => cell !== '')) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = json[headerRowIdx].map((c: any) => String(c || '').trim());
    const dataRows = json.slice(headerRowIdx + 1).filter((r) => r.some((c: any) => c !== ''));

    setRawHeaders(headers);
    setRawDataRows(dataRows);

    const detected = autoDetectColumns(headers);
    setColumnMap(detected);
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbook) {
      processSheet(workbook, newSheet);
    }
  };

  const analyzeAndPreview = () => {
    if (rawDataRows.length === 0) return;
    setIsProcessing(true);

    const normEmployees = db.employees.map((e) => ({
      ...e,
      normName: normalizePersianText(e.fullName),
      normCode: String(e.code || '').trim(),
      normPersonnel: normalizePersianText(e.personnelCode || ''),
    }));

    const normPrograms = db.programs.map((p) => ({
      ...p,
      normTitle: normalizePersianText(p.title),
      normCode: normalizePersianText(p.code),
    }));

    const rows: ParsedRow[] = [];
    const seenKeys = new Set<string>();

    rawDataRows.forEach((rawRow, idx) => {
      const getVal = (colName: string) => {
        if (!colName) return '';
        const colIdx = rawHeaders.indexOf(colName);
        return colIdx !== -1 ? String(rawRow[colIdx] || '').trim() : '';
      };

      const pCode = getVal(columnMap.personnelCode);
      const eCode = getVal(columnMap.employeeCode);
      const name = getVal(columnMap.fullName);
      const sCode = getVal(columnMap.schoolCode);
      const sName = getVal(columnMap.schoolName);
      const role = getVal(columnMap.role);
      const prgTitle = getVal(columnMap.programTitle);
      const statusText = getVal(columnMap.status);
      const date = getVal(columnMap.date);
      const notes = getVal(columnMap.notes);

      if (!pCode && !eCode && !name) return;

      let matchedEmp: Employee | undefined = undefined;
      let matchType: 'personnel_code' | 'emp_code' | 'name' | 'unmatched' = 'unmatched';

      if (pCode) {
        const normP = normalizePersianText(pCode);
        matchedEmp = normEmployees.find(
          (e) => e.normPersonnel === normP || e.normPersonnel.endsWith(normP),
        );
        if (matchedEmp) matchType = 'personnel_code';
      }

      if (!matchedEmp && eCode) {
        const padded = eCode.length === 1 ? '0' + eCode : eCode;
        matchedEmp = normEmployees.find((e) => e.normCode === padded || e.normCode === eCode);
        if (matchedEmp) matchType = 'emp_code';
      }

      if (!matchedEmp && name) {
        const normInputName = normalizePersianText(name);
        const exactMatches = normEmployees.filter((e) => e.normName === normInputName);
        if (exactMatches.length === 1) {
          matchedEmp = exactMatches[0];
          matchType = 'name';
        } else if (exactMatches.length > 1) {
          matchedEmp = exactMatches[0];
          matchType = 'name';
        }
      }

      let matchedPrg: Program | undefined = undefined;
      if (prgTitle) {
        const normPrgInput = normalizePersianText(prgTitle);
        matchedPrg = normPrograms.find(
          (p) =>
            p.normTitle === normPrgInput ||
            p.normCode === normPrgInput ||
            p.normTitle.includes(normPrgInput) ||
            normPrgInput.includes(p.normTitle),
        );
      }
      if (!matchedPrg && targetProgramId) {
        matchedPrg = db.programs.find((p) => p.id === targetProgramId);
      }

      let resolvedStatus: ExecutionStatus = 'done';
      let statusMatchReason = 'انجام شده';

      const normStat = normalizePersianText(statusText);
      if (normStat.includes('دیر') || normStat.includes('تاخیر') || normStat.includes('late')) {
        resolvedStatus = 'late';
        statusMatchReason = 'دیر انجام شده با تاخیر';
      } else if (
        normStat.includes('عدم') ||
        normStat.includes('نشده') ||
        normStat.includes('خیر') ||
        normStat.includes('not')
      ) {
        resolvedStatus = 'not_done';
        statusMatchReason = 'انجام نشده';
      } else {
        resolvedStatus = 'done';
        statusMatchReason = 'انجام شده در موعد مقرر';
      }

      const dedupeKey = `${matchedEmp?.id || name}_${matchedPrg?.id || prgTitle}`;
      const isDuplicate = seenKeys.has(dedupeKey);
      seenKeys.add(dedupeKey);

      rows.push({
        rowIdx: idx + 2,
        schoolCode: sCode,
        schoolName: sName,
        personnelCode: pCode,
        employeeCode: eCode,
        fullName: name,
        role,
        programTitle: prgTitle,
        programCode: matchedPrg?.code || '',
        statusText,
        executionDate: date ? updateJalaliDateToCurrentYear(date) : getCurrentJalaliDate(),
        notes,
        matchedEmployee: matchedEmp,
        matchedProgram: matchedPrg,
        resolvedStatus,
        statusMatchReason,
        isDuplicate,
        isAmbiguous: !matchedEmp && Boolean(name),
        matchType,
      });
    });

    setParsedRows(rows);
    setIsProcessing(false);
  };

  const handleCommitImport = () => {
    if (parsedRows.length === 0) return;

    const matchedItems = parsedRows.filter((r) => r.matchedEmployee && r.matchedProgram && !r.isDuplicate);
    if (matchedItems.length === 0) {
      alert('هیچ ردیف منطبقی برای ثبت یافت نشد.');
      return;
    }

    let updatedEmployees = [...db.employees];
    let updatedEmployeePrograms = [...db.employeePrograms];
    let updatedRolesCount = 0;
    let updatedAssignmentsCount = 0;
    let createdAssignmentsCount = 0;

    matchedItems.forEach((row) => {
      const emp = row.matchedEmployee!;
      const prg = row.matchedProgram!;

      if (updateRolesFromExcel && row.role) {
        const normRoleInput = row.role.trim();
        const matchedStd = STANDARD_ROLES.find(
          (sr) => sr === normRoleInput || normalizePersianText(sr) === normalizePersianText(normRoleInput),
        );
        const finalRole: StandardStaffRole | string = matchedStd || normRoleInput;

        const empIdx = updatedEmployees.findIndex((e) => e.id === emp.id);
        if (empIdx !== -1 && updatedEmployees[empIdx].role !== finalRole) {
          updatedEmployees[empIdx] = {
            ...updatedEmployees[empIdx],
            role: finalRole,
            customRoleTitle: !matchedStd ? normRoleInput : undefined,
          };
          updatedRolesCount++;
        }
      }

      const existingAssignIdx = updatedEmployeePrograms.findIndex(
        (ep) => ep.employeeId === emp.id && ep.programId === prg.id,
      );

      if (existingAssignIdx !== -1) {
        updatedEmployeePrograms[existingAssignIdx] = {
          ...updatedEmployeePrograms[existingAssignIdx],
          status: row.resolvedStatus,
          actualDate: row.executionDate || updatedEmployeePrograms[existingAssignIdx].actualDate || getCurrentJalaliDate(),
          executionDate: row.executionDate || updatedEmployeePrograms[existingAssignIdx].executionDate || getCurrentJalaliDate(),
          notes: row.notes || updatedEmployeePrograms[existingAssignIdx].notes,
          updatedAt: getCurrentJalaliDate(),
        };
        updatedAssignmentsCount++;
      } else {
        updatedEmployeePrograms.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          programId: prg.id,
          status: row.resolvedStatus,
          isManualOverride: false,
          actualDate: row.executionDate || getCurrentJalaliDate(),
          executionDate: row.executionDate || getCurrentJalaliDate(),
          notes: row.notes || 'ثبت خودکار از طریق ورود گروهی اکسل',
          updatedAt: getCurrentJalaliDate(),
        });
        createdAssignmentsCount++;
      }
    });

    const newDb: AppDatabase = {
      ...db,
      employees: updatedEmployees,
      employeePrograms: updatedEmployeePrograms,
    };

    onUpdateDatabase(newDb);

    setExecutionResult({
      success: true,
      totalRows: parsedRows.length,
      matchedCount: matchedItems.length,
      updatedAssignmentsCount,
      createdAssignmentsCount,
      updatedRolesCount,
      unmatchedCount: parsedRows.filter((r) => !r.matchedEmployee).length,
      duplicatesCount: parsedRows.filter((r) => r.isDuplicate).length,
      message: `ورود اطلاعات با موفقیت انجام شد. ${toPersianDigits(matchedItems.length)} تکلیف در پایگاه داده ثبت شد.`,
    });
  };

  const handleDownloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const sampleHeaders = [
      'کد مدرسه',
      'نام مدرسه',
      'شناسه پرسنلی',
      'کد همکار',
      'نام و نام خانوادگی',
      'سمت',
      'نام طرح',
      'وضعیت اجرا',
      'تاریخ اجرا',
      'توضیحات',
    ];

    const sampleData = [
      sampleHeaders,
      ['101', 'دبیرستان شهید بهشتی', '201001', '01', 'حسین صادقی', 'معاون پرورشی', 'مسابقات قرآن، عترت و نماز', 'انجام شده', getCurrentJalaliDate(), 'برگزاری موفق مسابقات'],
      ['102', 'دبیرستان فرزانگان', '201002', '02', 'زهره کریمی', 'معاون پرورشی', 'پویش یاریگران زندگی', 'انجام شده', getCurrentJalaliDate(), 'ارسال در ایتا'],
      ['103', 'دبستان انقلاب اسلامی', '201003', '03', 'رضا مرادی', 'آموزگار', 'ارزشیابی توصیفی', 'دیر انجام شده', getCurrentJalaliDate(), 'ارسال با تاخیر'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'الگو');
    XLSX.writeFile(wb, 'الگوی_ورود_اکسل.xlsx');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-teal-600" />
            <span>ورود گروهی اطلاعات و وضعیت اجرای طرح‌ها از فایل Excel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ثبت سریع وضعیت «انجام شده» و به‌روزرسانی تکالیف همکاران از طریق اکسل
          </p>
        </div>

        <button
          onClick={handleDownloadSampleExcel}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>دانلود فایل نمونه Excel</span>
        </button>
      </div>

      {executionResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{executionResult.message}</span>
          </div>
        </div>
      )}

      {/* Upload File */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all space-y-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <div className="font-bold text-sm text-slate-800">
            {fileName ? (
              <span className="text-teal-700">فایل: {fileName}</span>
            ) : (
              <span>کلیک برای انتخاب فایل اکسل (XLSX / XLS)</span>
            )}
          </div>
        </div>

        {sheetNames.length > 1 && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <Layers className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-bold text-slate-700">شیت:</span>
            <select
              value={selectedSheet}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="p-1.5 bg-white border border-slate-300 rounded-xl font-bold"
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {rawHeaders.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">تطبیق ستون‌ها</h3>
            <button
              onClick={() => setColumnMap(autoDetectColumns(rawHeaders))}
              className="flex items-center gap-1 text-xs text-teal-700 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تشخیص مجدد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">کد ۲ رقمی همکار:</label>
              <select
                value={columnMap.employeeCode}
                onChange={(e) => setColumnMap({ ...columnMap, employeeCode: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">نام همکار: *</label>
              <select
                value={columnMap.fullName}
                onChange={(e) => setColumnMap({ ...columnMap, fullName: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                <option value="">-- انتخاب ستون --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">طرح هدف (در صورت عدم وجود ستون):</label>
              <select
                value={targetProgramId}
                onChange={(e) => setTargetProgramId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                {db.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={analyzeAndPreview}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              تحلیل و پیش‌نمایش تطبیق‌ها ↵
            </button>
          </div>
        </div>
      )}

      {parsedRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800">پیش‌نمایش نتایج ({toPersianDigits(parsedRows.length)} سطر)</h3>
            <button
              onClick={handleCommitImport}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>تأیید و ثبت قطعی در سامانه</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-80 overflow-y-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-100 font-bold sticky top-0">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5">نام در فایل</th>
                  <th className="p-2.5">همکار منطبق</th>
                  <th className="p-2.5">طرح مشمول</th>
                  <th className="p-2.5 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((r) => (
                  <tr key={r.rowIdx} className={!r.matchedEmployee ? 'bg-rose-50' : ''}>
                    <td className="p-2.5 text-center font-bold text-slate-400">{toPersianDigits(r.rowIdx)}</td>
                    <td className="p-2.5 font-bold">{r.fullName || '---'}</td>
                    <td className="p-2.5">
                      {r.matchedEmployee ? (
                        <span className="text-emerald-700 font-bold">{r.matchedEmployee.fullName} (کد {r.matchedEmployee.code})</span>
                      ) : (
                        <span className="text-rose-600 font-bold">نامشخص</span>
                      )}
                    </td>
                    <td className="p-2.5">{r.matchedProgram?.title || '---'}</td>
                    <td className="p-2.5 text-center font-bold">{r.resolvedStatus === 'done' ? '🟢 انجام شده' : '🟠 تاخیر'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
