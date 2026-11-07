import React, { useState, useMemo } from 'react';
import { School, Employee, EmployeeProgram, Program, ReportScopeFilter } from '../types';
import { calculateSchoolStats, calculateSchoolDualScopeStats } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import {
  Building2,
  Printer,
  FileSpreadsheet,
  Search,
  Plus,
  Edit2,
  Trash2,
  BarChart3,
  MapPin,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface SchoolPerformanceReportProps {
  schools: School[];
  employees: Employee[];
  employeePrograms: EmployeeProgram[];
  programs?: Program[];
  onOpenNewSchoolModal: () => void;
  onEditSchool?: (school: School) => void;
  onDeleteSchool?: (schoolId: string) => void;
  onExportExcel: () => void;
  onFilterBySchool: (schoolId: string) => void;
}

export const SchoolPerformanceReport: React.FC<SchoolPerformanceReportProps> = ({
  schools,
  employees,
  employeePrograms,
  programs = [],
  onOpenNewSchoolModal,
  onEditSchool,
  onDeleteSchool,
  onExportExcel,
  onFilterBySchool,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<ReportScopeFilter>('all');
  const [filterArea, setFilterArea] = useState<'all' | 'شهری' | 'روستایی'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'progress' | 'staff' | 'average'>('score');
  const [chartMetric, setChartMetric] = useState<'average' | 'score' | 'progress'>('average');

  // Compute school stats with selected scope filter
  const schoolStatsList = useMemo(() => {
    return schools.map((school) => {
      const stats = calculateSchoolStats(school.id, employees, employeePrograms, programs, filterScope);
      const dual = calculateSchoolDualScopeStats(school.id, employees, employeePrograms, programs);
      return {
        school,
        stats,
        dual,
      };
    });
  }, [schools, employees, employeePrograms, programs, filterScope]);

  // Chart data comparing General vs Specific programs across schools
  const chartData = useMemo(() => {
    return schools.map((school) => {
      const dual = calculateSchoolDualScopeStats(school.id, employees, employeePrograms, programs);
      let generalVal = 0;
      let specificVal = 0;

      if (chartMetric === 'average') {
        generalVal = dual.general.averageStaffScore;
        specificVal = dual.specific.averageStaffScore;
      } else if (chartMetric === 'score') {
        generalVal = dual.general.earnedWeightedScore;
        specificVal = dual.specific.earnedWeightedScore;
      } else {
        generalVal = dual.general.progressPercent;
        specificVal = dual.specific.progressPercent;
      }

      // Truncate name if long for chart x-axis
      const displayName = school.name.length > 18 ? school.name.slice(0, 16) + '...' : school.name;

      return {
        id: school.id,
        name: displayName,
        fullName: school.name,
        code: school.code,
        areaType: school.areaType || 'شهری',
        'طرح‌های عمومی (همگانی)': generalVal,
        'طرح‌های اختصاصی': specificVal,
      };
    });
  }, [schools, employees, employeePrograms, programs, chartMetric]);

  const sortedAndFiltered = useMemo(() => {
    return schoolStatsList
      .filter(({ school }) => {
        if (filterArea !== 'all' && (school.areaType || 'شهری') !== filterArea) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          school.name.toLowerCase().includes(q) ||
          school.code.toLowerCase().includes(q) ||
          school.grade.toLowerCase().includes(q) ||
          (school.address && school.address.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'score') {
          if (b.stats.earnedWeightedScore !== a.stats.earnedWeightedScore) {
            return b.stats.earnedWeightedScore - a.stats.earnedWeightedScore;
          }
          return b.stats.progressPercent - a.stats.progressPercent;
        }
        if (sortBy === 'average') {
          return b.stats.averageStaffScore - a.stats.averageStaffScore;
        }
        if (sortBy === 'progress') {
          return b.stats.progressPercent - a.stats.progressPercent;
        }
        return b.stats.staffCount - a.stats.staffCount;
      });
  }, [schoolStatsList, filterArea, searchQuery, sortBy]);

  // Custom Persian tooltip for recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const unit = chartMetric === 'progress' ? '%' : ' امتیاز';
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans min-w-[200px]">
          <p className="font-bold text-sm text-teal-300 mb-1">{item.fullName}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-300 pb-2 mb-2 border-b border-slate-800">
            <span>کد واحد آموزشی: <strong className="font-mono text-white">{item.code}</strong></span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              item.areaType === 'روستایی' ? 'bg-emerald-900 text-emerald-200' : 'bg-blue-900 text-blue-200'
            }`}>
              {item.areaType}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-indigo-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block"></span>
                <span>طرح‌های عمومی (همگانی):</span>
              </span>
              <span className="font-mono font-bold text-white">
                {toPersianDigits(payload[0].value)}{unit}
              </span>
            </div>
            {payload[1] && (
              <div className="flex items-center justify-between text-amber-300">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                  <span>طرح‌های اختصاصی:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {toPersianDigits(payload[1].value)}{unit}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>گزارش تجمیعی و رتبه‌بندی آموزشگاه‌ها و مدارس</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تحلیل عملکرد، موقعیت جغرافیایی شهری و روستایی و نمودار تطبیقی طرح‌های عمومی و اختصاصی
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ گزارش مدارس</span>
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>خروجی Excel</span>
          </button>
          <button
            onClick={onOpenNewSchoolModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت آموزشگاه جدید</span>
          </button>
        </div>
      </div>

      {/* Visual Recharts Bar Chart: Comparison of General vs Specific Programs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span>نمودار ستونی مقایسه میانگین عملکرد مدارس بر اساس طرح‌های عمومی و اختصاصی</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-mono">
                  Recharts
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                بررسی گرافیکی و بصری عملکرد همزمان مدارس در طرح‌های عمومی (همگانی) و طرح‌های موردی (اختصاصی)
              </p>
            </div>
          </div>

          {/* Metric Selector for the Bar Chart */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold no-print">
            <span className="text-slate-500 px-2 text-[11px]">شاخص نمایش:</span>
            <button
              type="button"
              onClick={() => setChartMetric('average')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'average'
                  ? 'bg-white text-indigo-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              میانگین امتیاز هر نیرو
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('progress')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'progress'
                  ? 'bg-white text-emerald-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              درصد پیشرفت اجرا (%)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('score')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                chartMetric === 'score'
                  ? 'bg-white text-amber-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مجموع امتیاز وزنی مدرسه
            </button>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="w-full h-80 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Vazirmatn, sans-serif' }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={55}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontFamily: 'Vazirmatn, sans-serif', fontSize: 12 }}
              />
              <Bar
                dataKey="طرح‌های عمومی (همگانی)"
                fill="#4f46e5"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="طرح‌های اختصاصی"
                fill="#f59e0b"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scope, Filter, and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
        {/* Row 1: Scope Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">دامنه شمول طرح‌ها در گزارش و رتبه‌بندی:</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>همه طرح‌ها (عمومی و اختصاصی)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterScope('general')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterScope === 'general'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-indigo-700'
              }`}
            >
              <span>🌐 فقط طرح‌های عمومی (همگانی)</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterScope('specific')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterScope === 'specific'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <span>⭐ فقط طرح‌های اختصاصی</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Area and Sort Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام، کد آموزشگاه یا آدرس..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
              />
            </div>

            {/* Area Type Filter (شهری / روستایی) */}
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
            >
              <option value="all">تمام مناطق (شهری و روستایی)</option>
              <option value="شهری">🏢 فقط آموزشگاه‌های شهری</option>
              <option value="روستایی">🌾 فقط آموزشگاه‌های روستایی</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
            >
              <option value="score">🏆 بیشترین امتیاز وزنی مدرسه</option>
              <option value="average">⭐ بالاترین میانگین هر نیرو</option>
              <option value="progress">📈 بالاترین درصد پیشرفت</option>
              <option value="staff">👥 بیشترین تعداد نیروها</option>
            </select>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            تعداد مدارس فیلترشده: <strong>{toPersianDigits(sortedAndFiltered.length)}</strong> آموزشگاه
          </span>
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">رتبه</th>
                <th className="p-3.5 w-24 text-center">کد مدرسه</th>
                <th className="p-3.5">نام آموزشگاه و آدرس جغرافیایی</th>
                <th className="p-3.5 text-center">منطقه</th>
                <th className="p-3.5">مقطع و جنسیت</th>
                <th className="p-3.5 text-center">تعداد نیروها</th>
                <th className="p-3.5 text-center">کل تکالیف</th>
                <th className="p-3.5 text-center text-emerald-800">🟢 به‌موقع</th>
                <th className="p-3.5 text-center text-amber-800">🟠 با تأخیر</th>
                <th className="p-3.5 text-center text-rose-800">🔴 عدم اجرا</th>
                <th className="p-3.5 text-center bg-emerald-50/50">درصد پیشرفت</th>
                <th className="p-3.5 text-center bg-amber-50/50">امتیاز وزنی مدرسه</th>
                <th className="p-3.5 text-center bg-indigo-50/50">میانگین هر نیرو</th>
                <th className="p-3.5 text-center no-print">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedAndFiltered.map(({ school, stats }, idx) => (
                <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-slate-600">{school.code}</td>
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800 text-sm">{school.name}</div>
                    {school.address ? (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="line-clamp-1">{school.address}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300 italic">بدون ثبت آدرس جغرافیایی</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        (school.areaType || 'شهری') === 'روستایی'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {(school.areaType || 'شهری') === 'روستایی' ? '🌾 روستایی' : '🏢 شهری'}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-600">
                    <div>{school.grade}</div>
                    <span className="text-[11px] text-slate-400">({school.gender})</span>
                  </td>
                  <td className="p-3.5 text-center font-bold text-slate-700">{toPersianDigits(stats.staffCount)} نفر</td>
                  <td className="p-3.5 text-center font-bold text-slate-800">{toPersianDigits(stats.totalPrograms)}</td>
                  <td className="p-3.5 text-center font-bold text-emerald-600 bg-emerald-50/30">{toPersianDigits(stats.done)}</td>
                  <td className="p-3.5 text-center font-bold text-amber-600 bg-amber-50/30">{toPersianDigits(stats.late)}</td>
                  <td className="p-3.5 text-center font-bold text-rose-600 bg-rose-50/30">{toPersianDigits(stats.notDone)}</td>
                  <td className="p-3.5 text-center font-black text-emerald-700 bg-emerald-50/60 font-mono">%{toPersianDigits(stats.progressPercent)}</td>
                  <td className="p-3.5 text-center font-black text-amber-900 bg-amber-50/60 font-mono text-sm">{toPersianDigits(stats.earnedWeightedScore)}</td>
                  <td className="p-3.5 text-center font-black text-indigo-900 bg-indigo-50/60 font-mono">{toPersianDigits(stats.averageStaffScore)}</td>
                  <td className="p-3.5 text-center no-print">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onFilterBySchool(school.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        نیروها
                      </button>
                      {onEditSchool && (
                        <button
                          onClick={() => onEditSchool(school)}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg cursor-pointer"
                          title="ویرایش اطلاعات آموزشگاه"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteSchool && (
                        <button
                          onClick={() => onDeleteSchool(school.id)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="حذف آموزشگاه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

