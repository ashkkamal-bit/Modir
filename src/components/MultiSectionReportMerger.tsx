import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  ProgramSection,
  PROGRAM_SECTIONS,
  SYSTEM_DESIGNER_NAME,
  SYSTEM_DESIGNER_WEBSITE,
  SYSTEM_DESIGNER_PHONE,
} from '../types';
import { toPersianDigits, getCurrentJalaliDate, padZero } from '../utils/jalali';
import {
  parseSectionWorksheet,
  mergeSectionReports,
  exportMergedMultiSectionExcel,
  exportMergedMultiSectionHtml,
  downloadSectionSampleTemplate,
  SectionFileImport,
  ConsolidatedReportResult,
} from '../utils/sectionMerger';
import {
  Layers,
  Upload,
  Download,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Trophy,
  Building,
  Users,
  Eye,
  Check,
  X,
  ArrowRight,
  TrendingUp,
  FileText,
  Search,
  Filter,
} from 'lucide-react';

interface MultiSectionReportMergerProps {
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
  onNavigate?: (tab: string) => void;
}

const SECTION_THEMES: Record<
  ProgramSection,
  { bg: string; border: string; text: string; badge: string; iconBg: string }
> = {
  'پرورشی': {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800',
    iconBg: 'bg-emerald-600 text-white',
  },
  'آموزش ابتدایی': {
    bg: 'bg-amber-50/50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-800',
    iconBg: 'bg-amber-600 text-white',
  },
  'آموزش متوسطه اول': {
    bg: 'bg-blue-50/50',
    border: 'border-blue-300',
    text: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-800',
    iconBg: 'bg-blue-600 text-white',
  },
  'آموزش متوسطه دوم': {
    bg: 'bg-indigo-50/50',
    border: 'border-indigo-300',
    text: 'text-indigo-900',
    badge: 'bg-indigo-100 text-indigo-800',
    iconBg: 'bg-indigo-600 text-white',
  },
  'تربیت بدنی': {
    bg: 'bg-rose-50/50',
    border: 'border-rose-300',
    text: 'text-rose-900',
    badge: 'bg-rose-100 text-rose-800',
    iconBg: 'bg-rose-600 text-white',
  },
};

export const MultiSectionReportMerger: React.FC<MultiSectionReportMergerProps> = ({
  db,
  onUpdateDatabase,
  onNavigate,
}) => {
  const [sectionImports, setSectionImports] = useState<Partial<Record<ProgramSection, SectionFileImport>>>({});
  const [activeSectionPreview, setActiveSectionPreview] = useState<ProgramSection | null>(null);
  const [mergedResult, setMergedResult] = useState<ConsolidatedReportResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('all');

  const fileInputRefs = useRef<Partial<Record<ProgramSection, HTMLInputElement | null>>>({});
  const multiWorkbookInputRef = useRef<HTMLInputElement>(null);

  const activeCount = Object.values(sectionImports).filter((imp) => Boolean(imp?.records?.length)).length;

  // Handle single section file upload
  const handleSectionFileUpload = (
    section: ProgramSection,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        if (wb.SheetNames.length === 0) {
          setErrorMessage(`فایل اکسل انتخاب‌شده برای بخش «${section}» فاقد کاربرگ است.`);
          return;
        }

        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const parsed = parseSectionWorksheet(ws, section, file.name, firstSheet);

        setSectionImports((prev) => ({
          ...prev,
          [section]: parsed,
        }));

        setStatusMessage(
          `فایل بخش «${section}» با موفقیت بارگذاری شد (${toPersianDigits(parsed.validRows)} ردیف عملکرد از ${toPersianDigits(parsed.colleaguesCount)} همکار).`,
        );
        setTimeout(() => setStatusMessage(null), 4000);
      } catch (err: any) {
        setErrorMessage(`خطا در پردازش فایل اکسل بخش ${section}: ` + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Handle single multi-sheet workbook upload
  const handleMultiSheetWorkbookUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const newImports: Partial<Record<ProgramSection, SectionFileImport>> = { ...sectionImports };
        let matchedSections = 0;

        wb.SheetNames.forEach((sheetName) => {
          const normSheet = sheetName.trim();
          const matchedSection = PROGRAM_SECTIONS.find(
            (sec) =>
              normSheet === sec ||
              normSheet.includes(sec) ||
              (sec === 'پرورشی' && normSheet.includes('پرورش')) ||
              (sec === 'آموزش ابتدایی' && normSheet.includes('ابتدایی')) ||
              (sec === 'آموزش متوسطه اول' && (normSheet.includes('متوسطه اول') || normSheet.includes('راهنمایی'))) ||
              (sec === 'آموزش متوسطه دوم' && (normSheet.includes('متوسطه دوم') || normSheet.includes('دبیرستان'))) ||
              (sec === 'تربیت بدنی' && (normSheet.includes('تربیت') || normSheet.includes('ورزش'))),
          );

          if (matchedSection) {
            const ws = wb.Sheets[sheetName];
            const parsed = parseSectionWorksheet(ws, matchedSection, file.name, sheetName);
            newImports[matchedSection] = parsed;
            matchedSections++;
          }
        });

        if (matchedSections === 0) {
          // If sheets didn't match names, parse first sheet into پرورشی
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          const parsed = parseSectionWorksheet(ws, 'پرورشی', file.name, firstSheet);
          newImports['پرورشی'] = parsed;
          matchedSections = 1;
        }

        setSectionImports(newImports);
        setStatusMessage(
          `فایل جامع اکسل پردازش شد و ${toPersianDigits(matchedSections)} بخش شناسایی و جایگذاری گردید.`,
        );
        setTimeout(() => setStatusMessage(null), 4000);
      } catch (err: any) {
        setErrorMessage('خطا در خواندن فایل اکسل جامع: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Quick Demo: Load realistic sample data for all 5 sections
  const handleLoadDemoMultiSectionData = () => {
    const demoImports: Partial<Record<ProgramSection, SectionFileImport>> = {};

    PROGRAM_SECTIONS.forEach((sec) => {
      const records = db.employeePrograms
        .filter((ep) => {
          const prg = db.programs.find((p) => p.id === ep.programId);
          return prg?.section === sec;
        })
        .map((ep) => {
          const emp = db.employees.find((e) => e.id === ep.employeeId);
          const prg = db.programs.find((p) => p.id === ep.programId);
          const coeff = prg?.coefficient || 1;
          const maxScore = coeff * 100;
          let earnedScore = 0;
          if (ep.status === 'done') earnedScore = maxScore;
          else if (ep.status === 'late') earnedScore = coeff * 60;

          return {
            employeeCode: emp?.code,
            personnelCode: emp?.personnelCode || emp?.code,
            nationalId: emp?.nationalId || `128${emp?.code}0000`,
            fullName: emp?.fullName || 'همکار',
            schoolName: emp?.schoolName || 'آموزشگاه',
            grade: emp?.grade,
            role: emp?.role,
            programTitle: prg?.title || `طرح ${sec}`,
            coefficient: coeff,
            status: ep.status,
            executionDate: ep.executionDate || ep.actualDate,
            earnedScore,
            maxScore,
          };
        });

      demoImports[sec] = {
        section: sec,
        fileName: `گزارش_رسمی_بخش_${sec}.xlsx`,
        sheetName: sec,
        uploadedAt: getCurrentJalaliDate(),
        totalRows: records.length,
        validRows: records.length,
        colleaguesCount: new Set(records.map((r) => r.fullName)).size,
        programsCount: new Set(records.map((r) => r.programTitle)).size,
        records,
      };
    });

    setSectionImports(demoImports);
    const merged = mergeSectionReports(demoImports, db.settings);
    setMergedResult(merged);

    setStatusMessage('داده‌های نمونه هر ۵ بخش با موفقیت بارگذاری، میکس و گزارش نهایی تولید شد.');
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Perform Merge Action
  const handleExecuteMerge = () => {
    if (activeCount === 0) {
      setErrorMessage('حداقل باید فایل اکسل یک بخش را بارگذاری فرمایید.');
      return;
    }
    setErrorMessage(null);
    const result = mergeSectionReports(sectionImports, db.settings);
    setMergedResult(result);
    setStatusMessage(
      `میکس گزارش‌های ${toPersianDigits(result.sectionsCount)} بخش با موفقیت انجام شد. کارنامه نهایی آماده مشاهده و دریافت است.`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Commit merged results into system database
  const handleCommitMergedToDatabase = () => {
    if (!mergedResult) return;

    let updatedEmployees = [...db.employees];
    let createdStaffCount = 0;

    mergedResult.colleagues.forEach((c) => {
      const existing = updatedEmployees.find(
        (e) =>
          (c.nationalId && e.nationalId === c.nationalId) ||
          (c.personnelCode && e.personnelCode === c.personnelCode) ||
          e.fullName === c.fullName,
      );

      if (!existing) {
        updatedEmployees.push({
          id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          code: c.employeeCode || padZero(updatedEmployees.length + 1),
          fullName: c.fullName,
          nationalId: c.nationalId,
          personnelCode: c.personnelCode,
          schoolId: '',
          schoolName: c.schoolName,
          grade: c.grade as any,
          role: c.role,
          phone: '',
          createdAt: getCurrentJalaliDate(),
        });
        createdStaffCount++;
      }
    });

    onUpdateDatabase({
      ...db,
      employees: updatedEmployees,
    });

    setStatusMessage(
      `نتایج میکس در پایگاه داده سامانه ذخیره شد (${toPersianDigits(createdStaffCount)} همکار جدید ثبت شد).`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Clear a section
  const handleClearSection = (sec: ProgramSection) => {
    const updated = { ...sectionImports };
    delete updated[sec];
    setSectionImports(updated);
    if (mergedResult) {
      setMergedResult(mergeSectionReports(updated, db.settings));
    }
  };

  // Filter colleagues in merged table
  const filteredColleagues = mergedResult
    ? mergedResult.colleagues.filter((c) => {
        if (selectedSchoolFilter !== 'all' && c.schoolName !== selectedSchoolFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = c.fullName.toLowerCase().includes(q);
          const matchSchool = c.schoolName.toLowerCase().includes(q);
          const matchNid = (c.nationalId || '').includes(q);
          const matchPid = (c.personnelCode || '').includes(q);
          const matchCode = (c.employeeCode || '').includes(q);
          return matchName || matchSchool || matchNid || matchPid || matchCode;
        }
        return true;
      })
    : [];

  const uniqueSchools = mergedResult
    ? Array.from(new Set(mergedResult.colleagues.map((c) => c.schoolName))).sort()
    : [];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
              🏛️ {db.settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}
            </span>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              قابلیت جدید: میکس چندبخشی
            </span>
            <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
              طراح: <strong className="text-slate-900">{SYSTEM_DESIGNER_NAME}</strong>
            </span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
              {SYSTEM_DESIGNER_WEBSITE}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {SYSTEM_DESIGNER_PHONE}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            <span>میکس و تجمیع گزارش‌های اکسل بخش‌های مختلف</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            بارگذاری فایل‌های اکسل مجزای هر معاونت (پرورشی، ابتدایی، متوسطه اول، متوسطه دوم، تربیت بدنی) و صدور یک گزارش نهایی جامع و یکپارچه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadDemoMultiSectionData}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="بارگذاری داده‌های آزمایشی هر ۵ بخش جهت مشاهده فوری نحوه میکس گزارش‌ها"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>تست آزمایشی با داده‌های نمونه</span>
          </button>

          <input
            type="file"
            ref={multiWorkbookInputRef}
            onChange={handleMultiSheetWorkbookUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <button
            onClick={() => multiWorkbookInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="اگر تمام بخش‌ها در قالب یک فایل با چند کاربرگ ذخیره شده‌اند، از اینجا بارگذاری کنید"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <span>بارگذاری اکسل جامع چندکاربرگه</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900 px-2 cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-950 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 px-2 cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 5 Section Uploader Slots */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
              ۱
            </span>
            <span>بارگذاری گزارش‌های اکسل به تفکیک بخش‌ها ({toPersianDigits(activeCount)} از ۵ بخش بارگذاری شده)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSectionImports({});
                setMergedResult(null);
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 font-bold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی تمام بخش‌ها</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROGRAM_SECTIONS.map((section, idx) => {
            const imp = sectionImports[section];
            const theme = SECTION_THEMES[section];
            const isUploaded = Boolean(imp && imp.records.length > 0);

            return (
              <div
                key={section}
                className={`p-4 rounded-2xl border transition-all relative ${
                  isUploaded
                    ? `${theme.bg} ${theme.border} shadow-sm`
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="file"
                  ref={(el) => {
                    fileInputRefs.current[section] = el;
                  }}
                  onChange={(e) => handleSectionFileUpload(section, e)}
                  accept=".xlsx,.xls"
                  className="hidden"
                />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <span className="font-bold text-sm text-slate-800">{section}</span>
                  </div>

                  {isUploaded ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>دریافت شد</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">بدون فایل</span>
                  )}
                </div>

                {isUploaded && imp ? (
                  <div className="space-y-2 mb-3 text-xs">
                    <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[11px] text-slate-600 truncate font-mono">
                        📁 {imp.fileName}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>همکاران: <strong className="text-slate-800 font-mono">{toPersianDigits(imp.colleaguesCount)} نفر</strong></span>
                        <span>تکالیف: <strong className="text-emerald-700 font-mono">{toPersianDigits(imp.validRows)} مورد</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    فایل اکسل ارسالی این حوزه شامل نام همکار، کد ملی/پرسنلی، عنوان طرح و وضعیت اجرا را بارگذاری فرمایید.
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => fileInputRefs.current[section]?.click()}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isUploaded
                        ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploaded ? 'تغییر فایل' : 'انتخاب اکسل'}</span>
                  </button>

                  <button
                    onClick={() => downloadSectionSampleTemplate(section)}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-emerald-700 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                    title={`دانلود الگوی نمونه اکسل بخش ${section}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {isUploaded && (
                    <button
                      onClick={() => handleClearSection(section)}
                      className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="حذف فایل این بخش"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Mixing Trigger Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-teal-950 text-white flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center text-xs">
                  ⚡
                </span>
                <span className="font-bold text-sm text-white">موتور ادغام و میکس</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                تطبیق هوشمند همکاران بر اساس کد ملی، پرسنلی و نام، تجمیع ضرایب ۱ تا ۳ و استخراج کارنامه یکپارچه.
              </p>
              <div className="text-xs bg-white/10 p-2.5 rounded-xl border border-white/10 mb-4">
                بخش‌های آماده میکس: <strong className="text-emerald-300 font-mono text-sm">{toPersianDigits(activeCount)} بخش</strong>
              </div>
            </div>

            <button
              onClick={handleExecuteMerge}
              disabled={activeCount === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers className="w-4 h-4" />
              <span>میکس و صدور گزارش نهایی ↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FINAL CONSOLIDATED REPORT DASHBOARD */}
      {/* ======================================================== */}
      {mergedResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Result Banner & Master Download Buttons */}
          <div className="bg-gradient-to-br from-teal-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-emerald-800/40 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>گزارش کلی و نهایی سامانه آماده است</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  کارنامه نهایی تجمیعی و میکس بخش‌های پنج‌گانه
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  حاصل ادغام فایل‌های اکسل بخش‌های {mergedResult.sectionsList.join('، ')} با احتساب کلیه ضرایب و رتبه‌بندی منطقه‌ای
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => exportMergedMultiSectionHtml(mergedResult, db.settings)}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title="دانلود گزارش کامل و مستقل در قالب فایل HTML آماده پرینت و PDF"
                >
                  <FileCode className="w-4 h-4 text-emerald-100" />
                  <span>دانلود خروجی HTML نهایی</span>
                </button>

                <button
                  onClick={() => exportMergedMultiSectionExcel(mergedResult, db.settings)}
                  className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title="دانلود فایل اکسل چندکاربرگه گزارش نهایی"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>دانلود فایل Excel نهایی (.xlsx)</span>
                </button>

                <button
                  onClick={handleCommitMergedToDatabase}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="انتقال و ذخیره همکاران جدید در پایگاه داده اصلی نرم‌افزار"
                >
                  <Check className="w-4 h-4 text-teal-400" />
                  <span>اعمال در دیتابیس سامانه</span>
                </button>
              </div>
            </div>

            {/* Overall KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-white/10 text-center">
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <span className="text-slate-300 block text-[11px] mb-1">همکاران ارزیابی‌شده</span>
                <strong className="text-2xl font-black text-white font-mono">
                  {toPersianDigits(mergedResult.totalColleagues)} نفر
                </strong>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <span className="text-slate-300 block text-[11px] mb-1">آموزشگاه‌ها و مدارس</span>
                <strong className="text-2xl font-black text-white font-mono">
                  {toPersianDigits(mergedResult.totalSchools)} مدرسه
                </strong>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <span className="text-slate-300 block text-[11px] mb-1">کل تکالیف تمام بخش‌ها</span>
                <strong className="text-2xl font-black text-teal-300 font-mono">
                  {toPersianDigits(mergedResult.totalTasksAllSections)} مورد
                </strong>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <span className="text-slate-300 block text-[11px] mb-1">میانگین امتیاز کل</span>
                <strong className="text-2xl font-black text-amber-300 font-mono">
                  {toPersianDigits(mergedResult.overallAverageScore)}
                </strong>
              </div>

              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                <span className="text-slate-300 block text-[11px] mb-1">درصد تحقق کل منطقه</span>
                <strong className="text-2xl font-black text-emerald-300 font-mono">
                  %{toPersianDigits(mergedResult.overallAverageProgress)}
                </strong>
              </div>
            </div>
          </div>

          {/* Section Comparative Matrix */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>ماتریس مقایسه تحلیلی بخش‌های پنج‌گانه در گزارش نهایی</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {PROGRAM_SECTIONS.map((sec) => {
                const st = mergedResult.sectionStats[sec];
                const theme = SECTION_THEMES[sec];

                return (
                  <div
                    key={sec}
                    className={`p-4 rounded-2xl border ${
                      st.hasFile ? `${theme.bg} ${theme.border}` : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-800">{sec}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${st.hasFile ? theme.badge : 'bg-slate-200 text-slate-600'}`}>
                        {st.hasFile ? 'فعال' : 'فاقد فایل'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>تکالیف:</span>
                        <strong className="text-slate-800 font-mono">{toPersianDigits(st.totalTasks)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>همکاران:</span>
                        <strong className="text-slate-800 font-mono">{toPersianDigits(st.colleaguesCount)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>میانگین نمره:</span>
                        <strong className="text-emerald-700 font-mono font-bold">{toPersianDigits(st.averageScore)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/60">
                        <span>تحقق:</span>
                        <strong className="text-blue-700 font-mono font-bold">%{toPersianDigits(st.progressPercent)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master Ranking of Colleagues Table */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span>کارنامه جامع و تابلوی رتبه‌بندی نهایی تمام همکاران ({toPersianDigits(filteredColleagues.length)} نفر)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  تفکیک نمرات در هر ۵ حوزه، مجموع امتیاز وزنی و درصد تحقق ترکیبی
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجوی نام، کد ملی، پرسنلی..."
                    className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white outline-hidden font-medium"
                  />
                </div>

                <select
                  value={selectedSchoolFilter}
                  onChange={(e) => setSelectedSchoolFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="all">تمام مدارس</option>
                  {uniqueSchools.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-96 overflow-y-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-12">رتبه</th>
                    <th className="p-2.5 text-center w-16">کد</th>
                    <th className="p-2.5">نام و نام خانوادگی</th>
                    <th className="p-2.5 text-center">کد ملی</th>
                    <th className="p-2.5 text-center">کد پرسنلی</th>
                    <th className="p-2.5">آموزشگاه</th>
                    <th className="p-2.5">مقطع</th>
                    <th className="p-2.5 text-center bg-emerald-50 text-emerald-900">پرورشی</th>
                    <th className="p-2.5 text-center bg-amber-50 text-amber-900">ابتدایی</th>
                    <th className="p-2.5 text-center bg-blue-50 text-blue-900">متوسطه ۱</th>
                    <th className="p-2.5 text-center bg-indigo-50 text-indigo-900">متوسطه ۲</th>
                    <th className="p-2.5 text-center bg-rose-50 text-rose-900">تربیت بدنی</th>
                    <th className="p-2.5 text-center bg-slate-900 text-white">مجموع امتیاز</th>
                    <th className="p-2.5 text-center">تحقق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredColleagues.map((c) => {
                    const isTop3 = c.rank && c.rank <= 3;
                    return (
                      <tr
                        key={c.key}
                        className={`hover:bg-slate-50 transition-colors ${
                          c.rank === 1
                            ? 'bg-amber-50/40'
                            : c.rank === 2
                            ? 'bg-slate-100/40'
                            : c.rank === 3
                            ? 'bg-orange-50/30'
                            : ''
                        }`}
                      >
                        <td className="p-2.5 text-center font-bold font-mono">
                          {c.rank === 1 ? (
                            <span className="text-amber-500 font-bold text-sm">🥇 ۱</span>
                          ) : c.rank === 2 ? (
                            <span className="text-slate-500 font-bold text-sm">🥈 ۲</span>
                          ) : c.rank === 3 ? (
                            <span className="text-amber-700 font-bold text-sm">🥉 ۳</span>
                          ) : (
                            toPersianDigits(c.rank)
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {c.employeeCode || '---'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{c.fullName}</td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{c.nationalId || '---'}</td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{c.personnelCode || '---'}</td>
                        <td className="p-2.5 text-slate-700">{c.schoolName}</td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{c.grade}</td>

                        {/* 5 Section Scores */}
                        <td className="p-2.5 text-center font-mono font-bold bg-emerald-50/40 text-emerald-900">
                          {c.sectionScores['پرورشی'].totalTasks > 0
                            ? toPersianDigits(c.sectionScores['پرورشی'].earnedScore)
                            : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold bg-amber-50/40 text-amber-900">
                          {c.sectionScores['آموزش ابتدایی'].totalTasks > 0
                            ? toPersianDigits(c.sectionScores['آموزش ابتدایی'].earnedScore)
                            : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold bg-blue-50/40 text-blue-900">
                          {c.sectionScores['آموزش متوسطه اول'].totalTasks > 0
                            ? toPersianDigits(c.sectionScores['آموزش متوسطه اول'].earnedScore)
                            : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold bg-indigo-50/40 text-indigo-900">
                          {c.sectionScores['آموزش متوسطه دوم'].totalTasks > 0
                            ? toPersianDigits(c.sectionScores['آموزش متوسطه دوم'].earnedScore)
                            : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold bg-rose-50/40 text-rose-900">
                          {c.sectionScores['تربیت بدنی'].totalTasks > 0
                            ? toPersianDigits(c.sectionScores['تربیت بدنی'].earnedScore)
                            : '-'}
                        </td>

                        {/* Total Score */}
                        <td className="p-2.5 text-center font-mono font-black text-sm bg-slate-50 text-slate-900">
                          {toPersianDigits(c.totalEarnedScore)}
                        </td>

                        {/* Progress */}
                        <td className="p-2.5 text-center font-bold font-mono text-emerald-700">
                          %{toPersianDigits(c.overallScorePercent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* School Comparisons Table */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Building className="w-5 h-5 text-teal-600" />
              <span>جدول تجمیعی رتبه‌بندی آموزشگاه‌ها و مدارس در مجموع بخش‌ها ({toPersianDigits(mergedResult.schools.length)} آموزشگاه)</span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs max-h-80 overflow-y-auto">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-12">رتبه</th>
                    <th className="p-2.5">نام آموزشگاه</th>
                    <th className="p-2.5">مقطع</th>
                    <th className="p-2.5 text-center">همکاران</th>
                    <th className="p-2.5 text-center">میانگین پرورشی</th>
                    <th className="p-2.5 text-center">میانگین ابتدایی</th>
                    <th className="p-2.5 text-center">متوسطه اول</th>
                    <th className="p-2.5 text-center">متوسطه دوم</th>
                    <th className="p-2.5 text-center">تربیت بدنی</th>
                    <th className="p-2.5 text-center bg-teal-50 text-teal-900">مجموع امتیاز</th>
                    <th className="p-2.5 text-center">درصد تحقق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {mergedResult.schools.map((s) => (
                    <tr key={s.schoolName} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold font-mono">{toPersianDigits(s.rank)}</td>
                      <td className="p-2.5 font-bold text-slate-900">{s.schoolName}</td>
                      <td className="p-2.5 text-slate-500">{s.grade}</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.staffCount)} نفر</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.sectionAverages['پرورشی'])}</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.sectionAverages['آموزش ابتدایی'])}</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.sectionAverages['آموزش متوسطه اول'])}</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.sectionAverages['آموزش متوسطه دوم'])}</td>
                      <td className="p-2.5 text-center font-mono">{toPersianDigits(s.sectionAverages['تربیت بدنی'])}</td>
                      <td className="p-2.5 text-center font-mono font-bold bg-teal-50 text-teal-900">
                        {toPersianDigits(s.totalEarnedScore)}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                        %{toPersianDigits(s.overallProgressPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
