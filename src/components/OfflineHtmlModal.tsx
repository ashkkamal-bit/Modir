import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  FileCode,
  X,
  HelpCircle,
  Laptop,
  CheckCircle2,
  FileText,
  Eye,
} from 'lucide-react';
import { AppDatabase, SYSTEM_DESIGNER_NAME, SYSTEM_DESIGNER_WEBSITE, SYSTEM_DESIGNER_PHONE } from '../types';
import { exportFullHtmlReport, openHtmlReportInNewTab } from '../utils/htmlExport';
import {
  exportCompleteStandaloneApp,
  openCompleteStandaloneAppInNewTab,
  generateCompleteStandaloneHtml,
} from '../utils/standaloneAppExport';

interface OfflineHtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  db?: AppDatabase;
}

export const OfflineHtmlModal: React.FC<OfflineHtmlModalProps> = ({ isOpen, onClose, db }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadHtmlReport = () => {
    if (db) {
      exportFullHtmlReport(db);
      setDownloadSuccess('فایل گزارش جامع HTML با موفقیت دانلود شد.');
      setTimeout(() => setDownloadSuccess(null), 4000);
    }
  };

  const handleOpenHtmlReport = () => {
    if (db) {
      openHtmlReportInNewTab(db);
    }
  };

  const handleDownloadApp = async () => {
    if (!db) return;
    try {
      setDownloading(true);
      await exportCompleteStandaloneApp(db);
      setDownloadSuccess('نسخه کامل و مستقل نرم‌افزار HTML با موفقیت دانلود شد.');
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setDownloadSuccess('خطا در دریافت فایل HTML. لطفاً مجدداً تلاش فرمایید.');
      setTimeout(() => setDownloadSuccess(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!db) return;
    try {
      const htmlText = await generateCompleteStandaloneHtml(db);
      await navigator.clipboard.writeText(htmlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      setDownloadSuccess('امکان کپی خودکار فراهم نشد؛ لطفاً دکمه «دانلود خروجی HTML» را بزنید.');
      setTimeout(() => setDownloadSuccess(null), 5000);
    }
  };

  const handleOpenInNewTab = async () => {
    if (!db) return;
    try {
      await openCompleteStandaloneAppInNewTab(db);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-7 border border-slate-200 overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          title="بستن"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {db?.settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}
              </span>
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                طراح و برنامه‌نویس: <strong className="text-emerald-700">{SYSTEM_DESIGNER_NAME}</strong>
              </span>
              <span className="text-[11px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {SYSTEM_DESIGNER_WEBSITE}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {SYSTEM_DESIGNER_PHONE}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              دریافت خروجی‌های استاندارد HTML سامانه
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              امکان دریافت کارنامه و گزارش تحلیلی ۵ حوزه یا دانلود کل وب‌اپلیکیشن مستقل HTML
            </p>
          </div>
        </div>

        {downloadSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Section 1: Real-time HTML Report */}
          {db && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>۱. گزارش جامع آماری و رتبه‌بندی (فایل HTML آماده چاپ و PDF)</span>
              </div>
              <p className="text-xs text-emerald-800/90 leading-relaxed mb-3">
                شامل تمام داده‌های فعلی سیستم: تابلوی رتبه‌بندی همکاران با ضرایب ۱ تا ۳، گزارش مدارس، ۵ حوزه تخصصی و ریز تکالیف با قابلیت جستجو و فرمت چاپی استاندارد.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownloadHtmlReport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل گزارش HTML</span>
                </button>
                <button
                  onClick={handleOpenHtmlReport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>مشاهده آنلاین در تب جدید</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 2: Complete Offline Web App */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Laptop className="w-4 h-4 text-slate-700" />
              <span>۲. نرم‌افزار کامل و مستقل سامانه بصورت تک‌فایل HTML (کاملاً آفلاین)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              این فایل یک نرم‌افزار کامل شامل تمام فرم‌ها، کارتابل با کد دو رقمی، نمودارهای دایره‌ای همگانی و اختصاصی، مدیریت مدارس و طرح‌ها است که روی هر کامپیوتر یا گوشی بدون نیاز به اینترنت اجرا می‌شود.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleDownloadApp}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'در حال صدور...' : 'دانلود نسخه کامل نرم‌افزار (HTML)'}</span>
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>اجرای نسخه کامل در تب جدید</span>
              </button>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>کپی سورس کامل HTML</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-950">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-900 mb-1.5">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>راهنمای اجرا:</span>
            </h4>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              فایل‌های HTML دانلود شده را با دابل‌کلیک در مرورگر کروم، فایرفاکس یا مایکروسافت اج باز کنید. برای چاپ یا تبدیل به PDF کافیست کلیدهای <kbd className="font-mono bg-amber-100 px-1 rounded">Ctrl + P</kbd> را بفشارید.
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>پشتیبانی کامل از زبان فارسی و چینش راست‌به‌چپ (RTL)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
