import React, { useState } from 'react';
import { AppDatabase, SYSTEM_DESIGNER_NAME, SYSTEM_DESIGNER_WEBSITE, SYSTEM_DESIGNER_PHONE } from '../types';
import { exportFullExcelReport } from '../utils/excelExport';
import { exportFullHtmlReport, openHtmlReportInNewTab } from '../utils/htmlExport';
import { exportCompleteStandaloneApp } from '../utils/standaloneAppExport';
import { toPersianDigits } from '../utils/jalali';
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  Layers,
  FileCode,
  Eye,
  Laptop,
  Trophy,
} from 'lucide-react';

interface ExcelExportCenterProps {
  db: AppDatabase;
  onNavigate?: (tab: string) => void;
}

export const ExcelExportCenter: React.FC<ExcelExportCenterProps> = ({ db, onNavigate }) => {
  const [downloadingApp, setDownloadingApp] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDownloadExcel = () => {
    exportFullExcelReport(db);
    setStatusMessage('فایل اکسل جامع گزارش‌ها با موفقیت دانلود شد.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleDownloadHtml = () => {
    exportFullHtmlReport(db);
    setStatusMessage('فایل خروجی HTML جامع با موفقیت دانلود شد.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleOpenHtmlPreview = () => {
    openHtmlReportInNewTab(db);
  };

  const handleDownloadOfflineApp = async () => {
    try {
      setDownloadingApp(true);
      await exportCompleteStandaloneApp(db);
      setStatusMessage('نسخه کامل و مستقل نرم‌افزار HTML با موفقیت دانلود شد.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setStatusMessage('خطا در صدور نسخه کامل نرم‌افزار. لطفاً مجدداً تلاش فرمایید.');
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setDownloadingApp(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold px-2">✕</button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              🏛️ {db.settings?.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}
            </span>
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
              طراح: <strong className="text-emerald-700">{SYSTEM_DESIGNER_NAME}</strong>
            </span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
              {SYSTEM_DESIGNER_WEBSITE}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {SYSTEM_DESIGNER_PHONE}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileCode className="w-6 h-6 text-emerald-600" />
            <span>مرکز صدور و دریافت خروجی‌های رسمی (خروجی HTML و Excel)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            صدور پرونده جامع در قالب HTML استاندارد مستقل (۵ حوزه تخصصی با ضرایب ۱ تا ۳) و فایل اکسل ۸ کاربرگه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary HTML Download */}
          <button
            onClick={handleDownloadHtml}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="دانلود گزارش کامل تحلیلی و رتبه‌بندی به صورت فایل HTML"
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>دانلود خروجی HTML</span>
          </button>

          {/* Primary Excel Download */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
            title="دانلود فایل ۸ شیت اداری اکسل"
          >
            <Download className="w-4 h-4" />
            <span>دانلود فایل Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* HTML Report Showcase Card */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <FileCode className="w-3.5 h-3.5" />
            <span>خروجی استاندارد HTML (تک‌فایل مستقل)</span>
          </div>
          <h3 className="text-lg font-black text-white">
            پرونده جامع ارزیابی، رتبه‌بندی و عملکرد در قالب فایل HTML
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            این فایل یک گزارش رسمی خودکفا شامل شاخص‌های ۵ حوزه، تابلوی رتبه‌بندی همکاران با سکوی مدال‌ها بر اساس ضرایب ۱ تا ۳ طرح‌ها، گزارش تجمیعی مدارس، طرح‌ها و جدول تمام تکالیف است که بدون نیاز به اینترنت با هر مرورگری باز می‌شود و آماده چاپ استاندارد A4 و ذخیره به عنوان PDF اداری است.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
          <button
            onClick={handleDownloadHtml}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>دانلود فوری خروجی HTML</span>
          </button>
          <button
            onClick={handleOpenHtmlPreview}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4 text-emerald-300" />
            <span>مشاهده زنده در مرورگر</span>
          </button>
          <button
            onClick={handleDownloadOfflineApp}
            disabled={downloadingApp}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 rounded-xl text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md"
            title="دانلود نسخه کامل مستقل نرم‌افزار با تمام داده‌های زنده"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>{downloadingApp ? 'در حال صدور...' : 'دانلود نسخه کامل نرم‌افزار (HTML)'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Section Merger Card */}
      <div className="bg-white p-5 rounded-3xl border border-teal-200 shadow-xs flex flex-wrap items-center justify-between gap-4 bg-teal-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">جدید</span>
              <h4 className="font-bold text-sm text-slate-800">میکس و ادغام گزارش‌های اکسل بخش‌های مختلف</h4>
            </div>
            <p className="text-xs text-slate-500">
              بارگذاری گزارش‌های اکسل ارسالی از پرورشی، ابتدایی، متوسطه و تربیت بدنی و استخراج کارنامه نهایی و گزارش تجمیعی مشترک
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('section_merger')}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>ورود به بخش میکس گزارش‌ها</span>
            <span>↵</span>
          </button>
        )}
      </div>

      {/* Excel Sheets Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>محتوای فایل اکسل و کاربرگ‌ها:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                <Layers className="w-4 h-4" />
                <span>کاربرگ ۱ — ریز عملکرد و تکالیف</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                شامل تمام رکوردهای تکالیف با نام همکار، کد ۲ رقمی، آموزشگاه، حوزه تخصصی (از ۵ بخش)، ضریب طرح (۱ تا ۳)، امتیاز کسب‌شده، تاریخ مهلت و اجرا.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>تعداد رکوردها:</span>
              <strong className="font-mono text-slate-800">{toPersianDigits(db.employeePrograms.length)} سطر</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm mb-2">
                <Layers className="w-4 h-4" />
                <span>کاربرگ ۲ — خلاصه عملکرد همکاران</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                جدول مدیریتی عملکرد هر همکار به همراه کد دو رقمی، مجموع ضرایب، تفکیک به‌موقع، با تاخیر و عدم اجرا، درصد پیشرفت و امتیاز نهایی با ضریب.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>تعداد همکاران:</span>
              <strong className="font-mono text-slate-800">{toPersianDigits(db.employees.length)} نفر</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-2">
                <Layers className="w-4 h-4" />
                <span>کاربرگ ۳ — طرح‌ها در ۵ حوزه تخصصی</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                خلاصه آماری هر طرح در ۵ حوزه (پرورشی، ابتدایی، متوسطه اول، متوسطه دوم، تربیت بدنی) به همراه ضریب امتیازی و درصد تحقق.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>تعداد طرح‌ها:</span>
              <strong className="font-mono text-slate-800">{toPersianDigits(db.programs.length)} برنامه</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-2">
                <Layers className="w-4 h-4" />
                <span>کاربرگ ۴ — گزارش و امتیاز مدارس</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                تحلیل عملکرد تجمیعی مدارس، تعداد نیروها، امتیاز وزنی مکتسبه آموزشگاه با ضرایب طرح‌ها و درصد پیشرفت کلی.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>تعداد مدارس:</span>
              <strong className="font-mono text-slate-800">{toPersianDigits(db.schools.length)} آموزشگاه</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">نکات استفاده از خروجی‌های سامانه:</p>
          <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
            <li>خروجی HTML بدون نیاز به نرم‌افزار آفیس، با دابل‌کلیک در هر مرورگری (کامپیوتر و گوشی) باز می‌شود.</li>
            <li>برای تبدیل فایل HTML به PDF رسمی، کافیست کلیدهای <kbd className="font-mono bg-emerald-200/80 px-1 py-0.5 rounded text-[11px]">Ctrl + P</kbd> را در مرورگر فشار دهید.</li>
            <li>ضرایب ۱ تا ۳ طرح‌ها در تمامی فرمول‌های محاسباتی و رتبه‌بندی نهایی اعمال گردیده‌اند.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
