import React, { useState, useRef } from 'react';
import { AppDatabase, SystemSettings, SYSTEM_DESIGNER_NAME } from '../types';
import { exportDatabaseAsJson, importDatabaseFromJson, resetDatabaseToDefault } from '../utils/storage';
import { exportFullHtmlReport } from '../utils/htmlExport';
import { exportCompleteStandaloneApp, openCompleteStandaloneAppInNewTab } from '../utils/standaloneAppExport';
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
} from 'lucide-react';
import { OfflineHtmlModal } from './OfflineHtmlModal';

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
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      developerName: SYSTEM_DESIGNER_NAME,
    };
    setSettings(updated);
    onUpdateSettings(updated);
    setSuccessMessage('تنظیمات سربرگ اداری با موفقیت ذخیره شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleDownloadBackup = () => {
    exportDatabaseAsJson(db);
    setSuccessMessage('فایل پشتیبان کامل (JSON) با موفقیت در رایانه شما ذخیره شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const restored = importDatabaseFromJson(text);
        onUpdateDatabase(restored);
        setSettings(restored.settings);
        setExtractedSummary(
          `مشخصات با موفقیت بازیابی شد: ${restored.employees.length} همکار، ${restored.programs.length} طرح، ${restored.schools.length} آموزشگاه.`
        );
        setSuccessMessage('اطلاعات با موفقیت بازیابی شد.');
        setErrorMessage('');
      } catch (err: any) {
        setErrorMessage(err.message || 'خطا در بازیابی فایل پشتیبان.');
        setSuccessMessage('');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteJsonExtract = () => {
    if (!jsonPasteText.trim()) {
      setErrorMessage('لطفاً ابتدا متن JSON را در کادر وارد فرمایید.');
      return;
    }
    try {
      const restored = importDatabaseFromJson(jsonPasteText.trim());
      onUpdateDatabase(restored);
      setSettings(restored.settings);
      setExtractedSummary(
        `مشخصات با موفقیت استخراج شد: ${restored.employees.length} همکار، ${restored.programs.length} طرح.`
      );
      setSuccessMessage('اطلاعات با موفقیت استخراج شد.');
      setErrorMessage('');
      setJsonPasteText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در استخراج مشخصات.');
      setSuccessMessage('');
    }
  };

  const handleResetToDefault = () => {
    const resetDb = resetDatabaseToDefault();
    onUpdateDatabase(resetDb);
    setSettings(resetDb.settings);
    setSuccessMessage('اطلاعات به داده‌های نمونه اولیه بازگردانده شد.');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {extractedSummary && (
        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-900 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0 text-teal-600" />
          <span className="font-bold">{extractedSummary}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Backup & Restore */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>پشتیبان‌گیری و دریافت خروجی‌های سامانه</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            دریافت خروجی HTML یا پشتیبان JSON جهت ذخیره و نگهداری امن اطلاعات
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* HTML Export Card */}
          <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2 mb-2">
                <FileCode className="w-4 h-4 text-emerald-700" />
                <span>خروجی فایل مستقل HTML</span>
              </h3>
              <p className="text-xs text-emerald-900/80 leading-relaxed mb-4">
                خروجی گزارش استاندارد HTML با تمام شاخص‌های ۵ حوزه و رتبه‌بندی با ضرایب ۱ تا ۳ جهت پرینت و ذخیره PDF.
              </p>
            </div>
            <button
              onClick={() => exportFullHtmlReport(db)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>دانلود خروجی HTML</span>
            </button>
          </div>

          {/* JSON Backup */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-slate-700" />
                <span>پشتیبان پایگاه داده (JSON)</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                فایل داده‌های خام ساختاریافته JSON برای جابجایی بین کامپیوترها و سرورها.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل JSON</span>
            </button>
          </div>

          {/* Restore JSON */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>بازیابی اطلاعات قبلی</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                بارگذاری فایل JSON قبلی برای بازگردانی کامل افراد و طرح‌ها.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>انتخاب فایل JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* JSON Paste */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <label className="font-bold text-xs text-slate-700 block">
            الصاق متن JSON (Paste):
          </label>
          <textarea
            rows={3}
            value={jsonPasteText}
            onChange={(e) => setJsonPasteText(e.target.value)}
            dir="ltr"
            placeholder='{"employees": [...], "programs": [...]}'
            className="w-full font-mono text-xs p-2.5 bg-white border border-slate-300 rounded-xl outline-hidden"
          />
          <div className="flex justify-end">
            <button
              onClick={handlePasteJsonExtract}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              استخراج از متن
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
          >
            🔄 بازگرداندن داده‌های نمونه اولیه
          </button>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Building className="w-5 h-5 text-indigo-600" />
          <span>مشخصات سربرگ و تنظیمات اداری</span>
        </h2>
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نام اداره متبوع:</label>
              <input
                type="text"
                value={settings.officeTitle}
                onChange={(e) => setSettings({ ...settings, officeTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">عنوان کارشناسی:</label>
              <input
                type="text"
                value={settings.departmentTitle}
                onChange={(e) => setSettings({ ...settings, departmentTitle: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">کارشناس مسئول:</label>
              <input
                type="text"
                value={settings.officerName}
                onChange={(e) => setSettings({ ...settings, officerName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">سال تحصیلی:</label>
              <input
                type="text"
                value={settings.academicYear}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">طراح و برنامه‌نویس سامانه:</label>
                <span className="flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                  <Lock className="w-3 h-3 text-amber-600" />
                  غیرقابل تغییر
                </span>
              </div>
              <input
                type="text"
                readOnly
                disabled
                value={SYSTEM_DESIGNER_NAME}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl font-bold text-emerald-800 cursor-not-allowed select-none opacity-95"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                نام طراح و برنامه‌نویس سامانه دائمی و طبق ضوابط سامانه قفل شده است.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تنظیمات سربرگ</span>
            </button>
          </div>
        </form>
      </div>

      <OfflineHtmlModal
        isOpen={showHtmlModal}
        onClose={() => setShowHtmlModal(false)}
        db={db}
      />
    </div>
  );
};
