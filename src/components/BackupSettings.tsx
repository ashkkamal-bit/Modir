import React, { useState, useRef, useEffect } from 'react';
import {
  AppDatabase,
  SystemSettings,
  SYSTEM_DESIGNER_NAME,
  SYSTEM_DESIGNER_FULL_TITLE,
  SYSTEM_DESIGNER_WEBSITE,
  SYSTEM_DESIGNER_PHONE,
  SYSTEM_DESIGNER_PHONE_FA,
  SYSTEM_DEVELOPER_PROFILE,
} from '../types';
import {
  exportDatabaseAsJson,
  importDatabaseFromJson,
  resetDatabaseToDefault,
  inspectBackupJson,
  BackupInspectionResult,
  saveLocalSnapshot,
  getLocalSnapshots,
  restoreLocalSnapshot,
  deleteLocalSnapshot,
  LocalDatabaseSnapshot,
} from '../utils/storage';
import { exportFullHtmlReport } from '../utils/htmlExport';
import { toPersianDigits } from '../utils/jalali';
import {
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Save,
  Trash2,
  AlertTriangle,
  Building,
  CheckCircle,
  FileCode,
  ExternalLink,
  Lock,
  Phone,
  Globe,
  History,
  Sparkles,
  Database,
  HardDrive,
  FileJson,
  Check,
  Eye,
  RefreshCw,
  MessageSquare,
  Clock,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Info,
} from 'lucide-react';
import { OfflineHtmlModal } from './OfflineHtmlModal';
import { IsfahanToranjWatermark, IsfahanEmblem } from './IsfahanMotifs';

interface BackupSettingsProps {
  db: AppDatabase;
  onUpdateDatabase: (newDb: AppDatabase) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
  db,
  onUpdateDatabase,
  onUpdateSettings,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(db.settings);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState('');
  const [snapshots, setSnapshots] = useState<LocalDatabaseSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'history' | 'settings'>('backup');

  // Staged restore inspection
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [inspection, setInspection] = useState<BackupInspectionResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modals confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSnapshots(getLocalSnapshots());
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SystemSettings = {
      ...settings,
      developerName: SYSTEM_DESIGNER_NAME,
      developerWebsite: SYSTEM_DESIGNER_WEBSITE,
      developerPhone: SYSTEM_DESIGNER_PHONE,
    };
    setSettings(updated);
    onUpdateSettings(updated);
    setSuccessMessage('تنظیمات سربرگ اداری با موفقیت ذخیره شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleDownloadBackup = () => {
    exportDatabaseAsJson(db);
    setSnapshots(getLocalSnapshots());
    setSuccessMessage('فایل پشتیبان کامل JSON با موفقیت دریافت و در حافظه سیستم ذخیره شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleCreateSnapshotManually = () => {
    const updated = saveLocalSnapshot(db, 'نسخه پشتیبان دستی (حافظه مرورگر)');
    setSnapshots(updated);
    setSuccessMessage('نسخه پشتیبان جدید در تاریخچه مرورگر ثبت شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const processJsonForRestore = (text: string) => {
    setErrorMessage('');
    const inspected = inspectBackupJson(text);
    if (!inspected.isValid) {
      setErrorMessage(inspected.error || 'فایل نامعتبر است.');
      setPendingJson(null);
      setInspection(null);
      return;
    }
    setPendingJson(text);
    setInspection(inspected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processJsonForRestore(text);
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processJsonForRestore(text);
    };
    reader.readAsText(file);
  };

  const handleApplyPendingRestore = () => {
    if (!pendingJson) return;
    try {
      const restored = importDatabaseFromJson(pendingJson);
      onUpdateDatabase(restored);
      setSettings(restored.settings);
      setSnapshots(getLocalSnapshots());
      setSuccessMessage(
        `بازیابی موفق: ${toPersianDigits(restored.employees.length)} همکار، ${toPersianDigits(restored.programs.length)} طرح و ${toPersianDigits(restored.employeePrograms.length)} تکلیف با موفقیت اعمال گردید.`
      );
      setPendingJson(null);
      setInspection(null);
      setJsonPasteText('');
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در اعمال بازیابی.');
    }
  };

  const handleCancelPendingRestore = () => {
    setPendingJson(null);
    setInspection(null);
  };

  const handlePasteInspect = () => {
    if (!jsonPasteText.trim()) {
      setErrorMessage('لطفاً ابتدا کد یا متن فایل JSON را در کادر الصاق فرمایید.');
      return;
    }
    processJsonForRestore(jsonPasteText.trim());
  };

  const handleRestoreSnapshot = (id: string) => {
    const restored = restoreLocalSnapshot(id);
    if (restored) {
      onUpdateDatabase(restored);
      setSettings(restored.settings);
      setSnapshots(getLocalSnapshots());
      setSuccessMessage('نسخه پشتیبان انتخابی با موفقیت بازیابی شد.');
      setTimeout(() => setSuccessMessage(''), 4000);
    } else {
      setErrorMessage('نسخه پشتیبان مورد نظر یافت نشد.');
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    const updated = deleteLocalSnapshot(id);
    setSnapshots(updated);
  };

  const handleConfirmReset = () => {
    const resetDb = resetDatabaseToDefault();
    onUpdateDatabase(resetDb);
    setSettings(resetDb.settings);
    setSnapshots(getLocalSnapshots());
    setShowResetConfirm(false);
    setSuccessMessage('سامانه با موفقیت به داده‌های پیش‌فرض اولیه بازگردانده شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Approximate storage size
  const currentDbSizeKB = Math.round((JSON.stringify(db).length * 2) / 1024);

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <IsfahanToranjWatermark className="w-56 h-56 absolute -bottom-10 -left-10 text-teal-300 pointer-events-none" opacity={0.12} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>مرکز پشتیبان‌گیری، بازیابی و نگهداری داده‌ها</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              پشتیبان‌گیری و بازیابی پایگاه داده سامانه
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              ذخیره و دریافت فایل‌های کامل پشتیبان (JSON)، بازیابی آسان اطلاعات، تاریخچه خودکار نسخه‌ها در مرورگر و تنظیمات سربرگ اداری.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={handleDownloadBackup}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>پشتیبان‌گیری سریع (دانلود JSON)</span>
            </button>
          </div>
        </div>

        {/* Database Status Pill Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block mb-0.5">کل همکاران:</span>
            <span className="text-lg font-black text-white font-mono">{toPersianDigits(db.employees.length)} نفر</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block mb-0.5">طرح‌های ثبت‌شده:</span>
            <span className="text-lg font-black text-white font-mono">{toPersianDigits(db.programs.length)} طرح</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block mb-0.5">مدارس و واحدها:</span>
            <span className="text-lg font-black text-white font-mono">{toPersianDigits(db.schools.length)} واحد</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] text-slate-300 block mb-0.5">تکالیف ارزیابی:</span>
            <span className="text-lg font-black text-white font-mono">{toPersianDigits(db.employeePrograms.length)} رکورد</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-300 block mb-0.5">حجم دیتابیس:</span>
            <span className="text-lg font-black text-teal-300 font-mono">~{toPersianDigits(currentDbSizeKB)} KB</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>۱. پشتیبان‌گیری و دریافت خروجی (Backup)</span>
        </button>

        <button
          onClick={() => setActiveTab('restore')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'restore'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          <span>۲. بازیابی و بازگردانی اطلاعات (Restore)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>۳. تاریخچه پشتیبان‌های مرورگر ({toPersianDigits(snapshots.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>۴. سربرگ اداری و طراح نرم‌افزار</span>
        </button>
      </div>

      {/* Notification Banners */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl text-xs flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Staged Restore Confirmation Card */}
      {inspection && (
        <div className="p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-teal-50 border-2 border-blue-400 rounded-3xl shadow-lg space-y-4 animate-scale-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-blue-900">
              <Eye className="w-6 h-6 text-blue-600" />
              <h3 className="font-black text-base">
                پیش‌نمایش مشخصات فایل پشتیبان (آماده برای بازیابی نهایی)
              </h3>
            </div>
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full border border-blue-200">
              اعتبارسنجی تایید شد ✓
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            فایل پشتیبان با موفقیت پردازش گردید. مشخصات استخراج شده از فایل به شرح زیر است:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <span className="text-slate-500 block text-[11px]">همکاران موجود:</span>
              <span className="font-black text-slate-900 text-base">{toPersianDigits(inspection.employeesCount)} نفر</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <span className="text-slate-500 block text-[11px]">طرح‌ها و برنامه‌ها:</span>
              <span className="font-black text-slate-900 text-base">{toPersianDigits(inspection.programsCount)} طرح</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <span className="text-slate-500 block text-[11px]">واحدهای آموزشی:</span>
              <span className="font-black text-slate-900 text-base">{toPersianDigits(inspection.schoolsCount)} واحد</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <span className="text-slate-500 block text-[11px]">تکالیف و وضعیت‌ها:</span>
              <span className="font-black text-slate-900 text-base">{toPersianDigits(inspection.assignmentsCount)} تکلیف</span>
            </div>
          </div>

          <div className="p-3 bg-white/80 rounded-xl border border-blue-200 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span>اداره: <strong>{inspection.officeTitle}</strong></span>
              <span className="mx-2">•</span>
              <span>سال تحصیلی: <strong>{inspection.academicYear}</strong></span>
            </div>
            <div className="text-[11px] text-amber-800 font-bold">
              ⚠️ توجه: بازیابی این فایل جایگزین داده‌های فعلی سامانه خواهد شد.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleCancelPendingRestore}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              انصراف و لغو
            </button>
            <button
              onClick={handleApplyPendingRestore}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تایید و اعمال قطعی بازیابی</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: BACKUP */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: JSON Backup (Primary) */}
            <div className="bg-white p-6 rounded-3xl border-2 border-emerald-500/40 shadow-sm flex flex-col justify-between hover:border-emerald-500 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4 border border-emerald-200">
                  <FileJson className="w-6 h-6" />
                </div>
                <h3 className="font-black text-slate-800 text-base mb-2">
                  پشتیبان کامل پایگاه داده (فایل JSON)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  جامع‌ترین و مطمئن‌ترین قالب پشتیبان‌گیری استاندارد که شامل کلیه اطلاعات همکاران، طرح‌ها، مدارس و ارزیابی‌هاست و قابل انتقال به هر رایانه دیگری می‌باشد.
                </p>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-900 mb-6 space-y-1">
                  <div>✓ نام فایل استاندارد بر اساس تاریخ روز</div>
                  <div>✓ سازگار با تمامی نگارش‌های سامانه</div>
                  <div>✓ ایجاد خودکار کپی در تاریخچه مرورگر</div>
                </div>
              </div>

              <button
                onClick={handleDownloadBackup}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>دانلود فوری فایل JSON</span>
              </button>
            </div>

            {/* Card 2: Offline HTML Report */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4 border border-teal-200">
                  <FileCode className="w-6 h-6" />
                </div>
                <h3 className="font-black text-slate-800 text-base mb-2">
                  نسخه مستقل و آفلاین گزارش (HTML)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  یک فایل واحد HTML شامل گزارش جامع، نمودارها، وضعیت ۵ حوزه و کارتابل‌ها بدون نیاز به اینترنت و قابل مشاهده در هر گوشی، تبلت و کامپیوتر.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 mb-6 space-y-1">
                  <div>✓ مناسب برای بایگانی، پرینت و ارسال به مدیریت</div>
                  <div>✓ مستقل از نرم‌افزار با فونت وزیرمتن</div>
                  <div>✓ قابلیت جستجو و چاپ مستقیم</div>
                </div>
              </div>

              <button
                onClick={() => exportFullHtmlReport(db)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>دریافت فایل خروجی HTML</span>
              </button>
            </div>

            {/* Card 3: In-Browser Instant Snapshot */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4 border border-indigo-200">
                  <HardDrive className="w-6 h-6" />
                </div>
                <h3 className="font-black text-slate-800 text-base mb-2">
                  ثبت نسخه محلی در مرورگر
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  ذخیره وضعیت فعلی داده‌ها در حافظه امن مرورگر این سیستم، تا در صورت هرگونه تغییر اشتباه، بتوانید فوراً با ۱ کلیک به این نقطه بازگردید.
                </p>
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 mb-6 space-y-1">
                  <div>✓ نگهداری تا ۱۰ نسخه پشتیبان اخیر</div>
                  <div>✓ بازگردانی بدون نیاز به انتخاب فایل</div>
                  <div>✓ نمایش تاریخ و ساعت دقیق شمسی</div>
                </div>
              </div>

              <button
                onClick={handleCreateSnapshotManually}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>ثبت نسخه پشتیبان در حافظه</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE */}
      {activeTab === 'restore' && (
        <div className="space-y-6">
          {/* Drag & Drop File Zone */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <span>روش اول: انتخاب یا رها کردن فایل پشتیبان (JSON)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                فایل JSON پشتیبانی که قبلاً از این نرم‌افزار دانلود کرده‌اید را در کادر زیر رها کرده یا دکمه را کلیک کنید:
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
              />

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <FileJson className="w-8 h-8" />
              </div>

              <h4 className="font-bold text-slate-800 text-sm mb-1">
                فایل پشتیبان JSON را اینجا بکشید و رها کنید
              </h4>
              <p className="text-xs text-slate-500 mb-6">
                یا بر روی دکمه زیر کلیک کرده و فایل را از رایانه خود انتخاب نمایید
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>انتخاب فایل پشتیبان از رایانه</span>
              </button>
            </div>
          </div>

          {/* Paste JSON Raw Text */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>روش دوم: الصاق مستقیم متن JSON (Paste)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  مناسب زمانی که متن فایل پشتیبان را از طریق پیام‌رسان‌ها (ایتا، شاد، بله) کپی کرده‌اید:
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={jsonPasteText}
              onChange={(e) => setJsonPasteText(e.target.value)}
              dir="ltr"
              placeholder='{"employees": [...], "programs": [...], "settings": {...}}'
              className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-hidden transition-all"
            />

            <div className="flex justify-end gap-2">
              {jsonPasteText && (
                <button
                  type="button"
                  onClick={() => setJsonPasteText('')}
                  className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
                >
                  پاک کردن کادر
                </button>
              )}
              <button
                type="button"
                onClick={handlePasteInspect}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>بررسی و پیش‌نمایش متن الصاق‌شده</span>
              </button>
            </div>
          </div>

          {/* Factory Reset */}
          <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>بازگردانی سامانه به داده‌های نمونه پیش‌فرض کارخانه</span>
              </h4>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                در صورت نیاز به شروع مجدد، تمامی داده‌ها پاک شده و اطلاعات نمونه اولیه شامل ۲۸ همکار و ۳۰ طرح ۵ حوزه بارگذاری می‌شود.
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              🔄 بازگرداندن داده‌های اولیه
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: LOCAL HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>تاریخچه نسخه‌های پشتیبان ثبت‌شده در این مرورگر</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                هر بار که دانلود یا بازیابی انجام می‌دهید، یک نسخه خودکار در اینجا ذخیره می‌شود تا همیشه بتوانید به عقب برگردید:
              </p>
            </div>

            <button
              onClick={handleCreateSnapshotManually}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-indigo-600" />
              <span>ثبت نسخه هم‌اکنون</span>
            </button>
          </div>

          {snapshots.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <HardDrive className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-xs">هنوز نسخه‌ای در تاریخچه مرورگر ثبت نشده است.</p>
              <p className="text-[11px] text-slate-400">با کلیک بر روی «ثبت نسخه هم‌اکنون» اولین نسخه خود را ذخیره کنید.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {snapshots.map((snap, idx) => (
                <div
                  key={snap.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 px-3 rounded-2xl transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold flex items-center justify-center">
                        {toPersianDigits(idx + 1)}
                      </span>
                      <span className="font-bold text-xs text-slate-800">{snap.label}</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{snap.createdAt}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pr-7">
                      <span>همکاران: <strong>{toPersianDigits(snap.employeeCount)}</strong></span>
                      <span>•</span>
                      <span>طرح‌ها: <strong>{toPersianDigits(snap.programCount)}</strong></span>
                      <span>•</span>
                      <span>تکالیف: <strong>{toPersianDigits(snap.assignmentCount)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleRestoreSnapshot(snap.id)}
                      className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>بازیابی این نسخه</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="حذف این نسخه از تاریخچه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS & DEVELOPER IDENTIFICATION */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Official Administrative Settings Form */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <span>تنظیمات سربرگ اداری، منطقه و سال تحصیلی</span>
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">نام اداره آموزش و پرورش متبوع:</label>
                  <input
                    type="text"
                    value={settings.officeTitle}
                    onChange={(e) => setSettings({ ...settings, officeTitle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-hidden font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">عنوان کارشناسی:</label>
                  <input
                    type="text"
                    value={settings.departmentTitle}
                    onChange={(e) => setSettings({ ...settings, departmentTitle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-hidden font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">کارشناس مسئول ارزیابی:</label>
                  <input
                    type="text"
                    value={settings.officerName}
                    onChange={(e) => setSettings({ ...settings, officerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-hidden font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">سال تحصیلی فعال:</label>
                  <input
                    type="text"
                    value={settings.academicYear}
                    onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-hidden font-medium"
                  />
                </div>
              </div>

              {/* Locked Designer Field in Form */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 text-xs">
                    طراح و برنامه‌نویس سامانه:
                  </label>
                  <span className="flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                    <Lock className="w-3 h-3 text-amber-600" />
                    غیرقابل تغییر (دائمی)
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={SYSTEM_DESIGNER_FULL_TITLE}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-bold text-emerald-800 cursor-not-allowed select-none opacity-95 text-xs"
                />
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    وب‌سایت: <strong className="text-blue-700 font-mono">{SYSTEM_DESIGNER_WEBSITE}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    شماره تماس: <strong className="text-emerald-700 font-mono">{SYSTEM_DESIGNER_PHONE_FA}</strong>
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره تغییرات سربرگ</span>
                </button>
              </div>
            </form>
          </div>

          {/* Majestic Designer Identification & Support Card */}
          <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-teal-500/30 shadow-xl relative overflow-hidden">
            <IsfahanToranjWatermark className="w-48 h-48 absolute -bottom-8 -left-8 text-teal-300 pointer-events-none" opacity={0.15} />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </span>
                  <div>
                    <h3 className="font-black text-lg text-white">
                      شناسنامه رسمی طراح و برنامه‌نویس نرم‌افزار
                    </h3>
                    <p className="text-xs text-teal-200">
                      پشتیبانی فنی، نگهداری و توسعه سامانه ارزشیابی عملکرد
                    </p>
                  </div>
                </div>

                <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>حقوق معنوی و طراحی محفوظ</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Designer Card */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <span className="text-[11px] text-teal-300 block font-medium">طراح و برنامه‌نویس:</span>
                  <div className="font-black text-base text-white">{SYSTEM_DEVELOPER_PROFILE.name}</div>
                  <div className="text-xs text-amber-300 font-bold">{SYSTEM_DEVELOPER_PROFILE.role}</div>
                </div>

                {/* Website Card */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <span className="text-[11px] text-teal-300 block font-medium">آدرس وب‌سایت رسمی:</span>
                  <div className="font-black text-base text-white font-mono">{SYSTEM_DEVELOPER_PROFILE.website}</div>
                  <a
                    href={SYSTEM_DEVELOPER_PROFILE.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 underline mt-1"
                  >
                    <span>ورود به تارنما</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Phone Card */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <span className="text-[11px] text-teal-300 block font-medium">شماره تماس و پشتیبانی:</span>
                  <div className="font-black text-base text-white font-mono">{SYSTEM_DEVELOPER_PROFILE.phoneDisplay}</div>
                  <a
                    href={`tel:${SYSTEM_DEVELOPER_PROFILE.phone}`}
                    className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 underline mt-1"
                  >
                    <span>برقراری تماس مستقیم</span>
                    <Phone className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10 text-xs">
                <a
                  href={`sms:${SYSTEM_DEVELOPER_PROFILE.phone}`}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-300" />
                  <span>ارسال پیامک پشتیبانی</span>
                </a>
                <a
                  href={`tel:${SYSTEM_DEVELOPER_PROFILE.phone}`}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>تماس تلفنی با طراح: {SYSTEM_DEVELOPER_PROFILE.phoneDisplay}</span>
                </a>
                <a
                  href={SYSTEM_DEVELOPER_PROFILE.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>مشاهده تارنمای arshadevelop.ir</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-up text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-black text-slate-800 text-base text-center">
              آیا از بازگرداندن اطلاعات به پیش‌فرض کارخانه اطمینان دارید؟
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed text-center">
              با این اقدام، تمام اطلاعات فعلی جایگزین ۲۸ همکار و ۳۰ طرح اولیه می‌شود. یک نسخه پشتیبان خودکار از وضعیت فعلی شما در تاریخچه مرورگر ثبت خواهد شد.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                بله، بازگردانی به پیش‌فرض
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineHtmlModal
        isOpen={showHtmlModal}
        onClose={() => setShowHtmlModal(false)}
        db={db}
      />
    </div>
  );
};
