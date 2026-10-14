import React, { useState } from 'react';
import { SystemSettings, Employee, AppDatabase, SYSTEM_DESIGNER_NAME } from '../types';
import { padZero } from '../utils/jalali';
import { exportFullHtmlReport } from '../utils/htmlExport';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  BookOpen,
  Share2,
  FileSpreadsheet,
  Building2,
  PieChart,
  ShieldCheck,
  HelpCircle,
  Menu,
  X,
  FileCode,
  Trophy,
  Upload,
  Layers,
} from 'lucide-react';
import { OfflineHtmlModal } from './OfflineHtmlModal';
import { IsfahanEmblem, IsfahanTileBorder } from './IsfahanMotifs';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  settings: SystemSettings;
  selectedEmployee: Employee | null;
  onQuickJump: (code: string) => boolean;
  onOpenAssignModal: () => void;
  db: AppDatabase;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  selectedEmployee,
  onQuickJump,
  onOpenAssignModal,
  db,
}) => {
  const [navCode, setNavCode] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navError, setNavError] = useState('');
  const [showHtmlModal, setShowHtmlModal] = useState(false);

  const handleNavJump = (e: React.FormEvent) => {
    e.preventDefault();
    setNavError('');
    const clean = padZero(navCode.trim());
    if (!clean || clean === '00') {
      setNavError('کد ۲ رقمی نامعتبر است');
      return;
    }
    const found = onQuickJump(clean);
    if (!found) {
      setNavError(`کد «${clean}» یافت نشد`);
      setTimeout(() => setNavError(''), 3000);
    } else {
      setNavCode('');
      setIsMobileMenuOpen(false);
    }
  };

  const handleDirectHtmlExport = () => {
    exportFullHtmlReport(db);
  };

  const menuItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    {
      id: 'cartable',
      label: selectedEmployee ? `کارتابل (کد ${selectedEmployee.code})` : 'کارتابل همکار',
      icon: UserCheck,
      highlight: Boolean(selectedEmployee),
    },
    { id: 'employees', label: 'همکاران', icon: Users },
    { id: 'programs', label: 'طرح‌ها (۵ حوزه)', icon: BookOpen },
    { id: 'assign', label: 'تخصیص برنامه', icon: Share2, action: onOpenAssignModal },
    { id: 'excel_import', label: 'ورود گروهی از Excel', icon: Upload },
    { id: 'section_merger', label: 'میکس و تجمیع گزارش‌ها', icon: Layers },
    { id: 'ranking', label: 'رتبه‌بندی همکاران', icon: Trophy },
    { id: 'performance_report', label: 'گزارش همکاران', icon: PieChart },
    { id: 'schools_report', label: 'گزارش مدارس', icon: Building2 },
    { id: 'programs_report', label: 'گزارش طرح‌ها', icon: BookOpen },
    { id: 'excel_export', label: 'مرکز خروجی‌ها (HTML/Excel)', icon: FileSpreadsheet },
    { id: 'backup_settings', label: 'پشتیبان و تنظیمات', icon: ShieldCheck },
    { id: 'guide', label: 'راهنما', icon: HelpCircle },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <IsfahanEmblem size={48} className="shadow-lg hover:scale-105 transition-transform" />

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-xs text-teal-800 font-bold leading-none bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-md">
                  {settings.officeTitle || 'اداره آموزش و پرورش ناحیه ۶ اصفهان'}
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold hidden sm:inline-block">
                  ۵ حوزه تخصصی با ضرایب ۱ تا ۳
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                سامانه ارزشیابی عملکرد نیروهای آموزش و پرورش ناحیه ۶ اصفهان
              </h1>
              <div className="flex items-center gap-2 text-[10px] hidden sm:flex mt-0.5">
                <span className="text-teal-700 font-medium">
                  {settings.departmentTitle} | {settings.academicYear}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">
                  طراح: <strong className="text-slate-800">{SYSTEM_DESIGNER_NAME}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            {/* Direct HTML Export Button */}
            <button
              type="button"
              onClick={handleDirectHtmlExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="دریافت فایل خروجی کامل HTML"
            >
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>خروجی HTML</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHtmlModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="سایر گزینه‌های خروجی آفلاین و مستقل"
            >
              <span>نسخه آفلاین</span>
            </button>

            <form onSubmit={handleNavJump} className="flex items-center gap-1.5 border-r border-slate-200 pr-2">
              <span className="text-xs font-bold text-slate-600 pr-1">کارتابل:</span>
              <input
                type="text"
                maxLength={4}
                value={navCode}
                onChange={(e) => {
                  setNavCode(e.target.value.replace(/[^0-9]/g, ''));
                  setNavError('');
                }}
                placeholder="کد ۲ رقمی"
                className="w-20 text-center font-mono font-bold text-xs p-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                برو
              </button>
            </form>
            {navError && (
              <span className="text-[11px] text-rose-600 font-bold px-2 animate-fade-in">
                {navError}
              </span>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <nav className="bg-slate-900 text-white border-t border-slate-800 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none text-xs">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      onSelectTab(item.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : item.highlight
                      ? 'text-emerald-300 hover:bg-slate-800'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white border-t border-slate-800 p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                handleDirectHtmlExport();
                setIsMobileMenuOpen(false);
              }}
              className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
            >
              📄 دریافت خروجی کامل HTML
            </button>
          </div>
          <form onSubmit={handleNavJump} className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <input
              type="text"
              maxLength={4}
              value={navCode}
              onChange={(e) => setNavCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="کد دو رقمی همکار..."
              className="flex-1 text-center font-mono font-bold text-xs p-2 bg-slate-800 border border-slate-700 rounded-xl text-white outline-hidden"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              برو
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      onSelectTab(item.id);
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl font-bold transition-all text-right cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <OfflineHtmlModal
        isOpen={showHtmlModal}
        onClose={() => setShowHtmlModal(false)}
        db={db}
      />

      <IsfahanTileBorder className="w-full h-1" />
    </header>
  );
};
