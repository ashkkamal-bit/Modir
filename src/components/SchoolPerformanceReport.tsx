import React, { useState, useMemo } from 'react';
import { School, Employee, EmployeeProgram, Program, ReportScopeFilter, SchoolType } from '../types';
import { calculateSchoolStats, calculateSchoolDualScopeStats } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import { StatusBadge } from './StatusBadge';
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
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  X,
  Award,
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

const renderPlatformBadge = (plat?: string) => {
  if (!plat) return <span className="text-slate-300 font-normal">---</span>;
  if (plat === 'ایتا') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">🔶 ایتا</span>;
  }
  if (plat === 'شاد') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">🔷 شاد</span>;
  }
  if (plat === 'اتوماسیون') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">💼 اتوماسیون</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">📋 {plat}</span>;
};

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
  const [filterSchoolType, setFilterSchoolType] = useState<'all' | SchoolType>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'progress' | 'staff' | 'average'>('score');
  const [chartMetric, setChartMetric] = useState<'average' | 'score' | 'progress'>('average');

  // Expanded school row for inspecting detailed activities (ریز جزئیات فعالیت‌ها)
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'done' | 'late' | 'not_done'>('all');
  const [activityScopeFilter, setActivityScopeFilter] = useState<'all' | 'همگانی' | 'اختصاصی'>('all');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

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
        schoolType: school.schoolType || 'دولتی',
        'طرح‌های عمومی (همگانی)': generalVal,
        'طرح‌های اختصاصی': specificVal,
      };
    });
  }, [schools, employees, employeePrograms, programs, chartMetric]);

  const sortedAndFiltered = useMemo(() => {
    return schoolStatsList
      .filter(({ school }) => {
        if (filterArea !== 'all' && (school.areaType || 'شهری') !== filterArea) return false;
        if (filterSchoolType !== 'all' && (school.schoolType || 'دولتی') !== filterSchoolType) return false;
        if (filterGrade !== 'all' && school.grade !== filterGrade) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          school.name.toLowerCase().includes(q) ||
          school.code.toLowerCase().includes(q) ||
          school.grade.toLowerCase().includes(q) ||
          (school.principalName && school.principalName.toLowerCase().includes(q)) ||
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
  }, [schoolStatsList, filterArea, filterSchoolType, filterGrade, searchQuery, sortBy]);

  // Compute detailed activities for the expanded school
  const expandedSchoolActivities = useMemo(() => {
    if (!expandedSchoolId) return [];
    const schoolEmployees = employees.filter((e) => e.schoolId === expandedSchoolId);
    const empMap = new Map(schoolEmployees.map((e) => [e.id, e]));
    const prgMap = new Map(programs.map((p) => [p.id, p]));
    const staffIds = new Set(schoolEmployees.map((e) => e.id));

    return employeePrograms
      .filter((ep) => staffIds.has(ep.employeeId))
      .map((ep) => {
        const emp = empMap.get(ep.employeeId);
        const prg = prgMap.get(ep.programId);
        const isSpecific = prg?.scope === 'اختصاصی';
        const coeff = prg?.coefficient || 1;
        let earnedPoints = 0;
        if (!isSpecific) {
          if (ep.status === 'done') earnedPoints = coeff * 100;
          else if (ep.status === 'late') earnedPoints = coeff * 60;
        }

        return {
          assignment: ep,
          employee: emp,
          program: prg,
          isSpecific,
          coeff,
          earnedPoints,
          status: ep.status,
          executionDate: ep.executionDate || ep.actualDate,
          submissionDate: ep.submissionDate || ep.docSubmissionDate,
          platform: ep.submissionPlatform || ep.documentationPlatform,
        };
      })
      .filter((item) => {
        if (!item.program) return false;
        if (activityStatusFilter !== 'all' && item.status !== activityStatusFilter) return false;
        if (activityScopeFilter !== 'all') {
          if (activityScopeFilter === 'همگانی' && item.isSpecific) return false;
          if (activityScopeFilter === 'اختصاصی' && !item.isSpecific) return false;
        }
        if (activitySearchQuery.trim()) {
          const q = activitySearchQuery.trim().toLowerCase();
          const matchTitle = item.program.title.toLowerCase().includes(q);
          const matchCode = item.program.code.toLowerCase().includes(q);
          const matchEmp = item.employee?.fullName.toLowerCase().includes(q);
          if (!matchTitle && !matchCode && !matchEmp) return false;
        }
        return true;
      });
  }, [expandedSchoolId, employees, programs, employeePrograms, activityStatusFilter, activityScopeFilter, activitySearchQuery]);

  // Expanded school summary metrics
  const expandedSchoolObject = schools.find((s) => s.id === expandedSchoolId) || null;
  const expandedSchoolAllAssignments = useMemo(() => {
    if (!expandedSchoolId) return [];
    const schoolEmployees = employees.filter((e) => e.schoolId === expandedSchoolId);
    const staffIds = new Set(schoolEmployees.map((e) => e.id));
    return employeePrograms.filter((ep) => staffIds.has(ep.employeeId));
  }, [expandedSchoolId, employees, employeePrograms]);

  const expandedSchoolMetrics = useMemo(() => {
    const total = expandedSchoolAllAssignments.length;
    const done = expandedSchoolAllAssignments.filter((a) => a.status === 'done').length;
    const late = expandedSchoolAllAssignments.filter((a) => a.status === 'late').length;
    const notDone = expandedSchoolAllAssignments.filter((a) => a.status === 'not_done').length;
    const progress = total > 0 ? Math.round(((done + late) / total) * 100) : 0;
    return { total, done, late, notDone, progress };
  }, [expandedSchoolAllAssignments]);

  // Custom Persian tooltip for recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const unit = chartMetric === 'progress' ? '%' : ' امتیاز';
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans min-w-[210px]">
          <p className="font-bold text-sm text-teal-300 mb-1">{item.fullName}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-300 pb-2 mb-2 border-b border-slate-800">
            <span>کد واحد آموزشی: <strong className="font-mono text-white">{item.code}</strong></span>
            <div className="flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                item.areaType === 'روستایی' ? 'bg-emerald-900 text-emerald-200' : 'bg-blue-900 text-blue-200'
              }`}>
                {item.areaType}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-900 text-amber-200">
                {item.schoolType}
              </span>
            </div>
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
            مشاهده رتبه، ریز جزئیات فعالیت‌های انجام‌شده/نشده/دیرانجام‌شده، نوع اداره (دولتی، غیردولتی، هیئت امنایی) و موقعیت جغرافیایی
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

        {/* Row 2: Search, Area, School Type, Grade and Sort Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، کد، مدیر یا آدرس..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
            />
          </div>

          {/* School Type Filter (نوع مدرسه: دولتی / غیردولتی / هیئت امنایی) */}
          <select
            value={filterSchoolType}
            onChange={(e) => setFilterSchoolType(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
          >
            <option value="all">تمام انواع اداره (دولتی / غیردولتی / هیئت امنایی)</option>
            <option value="دولتی">🏛️ فقط مدارس دولتی</option>
            <option value="غیردولتی">🏢 فقط مدارس غیردولتی</option>
            <option value="هیئت امنایی">🤝 فقط مدارس هیئت امنایی</option>
          </select>

          {/* Grade Filter (شامل دوره ابتدایی مقطع اول و دوم) */}
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700"
          >
            <option value="all">تمام مقاطع تحصیلی</option>
            <option value="دوره ابتدایی (مقطع اول و دوم)">دوره ابتدایی (مقطع اول و دوم)</option>
            <option value="ابتدایی دوره اول">ابتدایی دوره اول</option>
            <option value="ابتدایی دوره دوم">ابتدایی دوره دوم</option>
            <option value="متوسطه اول">متوسطه اول</option>
            <option value="متوسطه دوم نظری">متوسطه دوم نظری</option>
            <option value="هنرستان فنی و حرفه‌ای و کاردانش">هنرستان فنی و کاردانش</option>
            <option value="مجتمع آموزشی و پرورشی">مجتمع آموزشی</option>
          </select>

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

        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
          <span>
            تعداد مدارس فیلترشده: <strong>{toPersianDigits(sortedAndFiltered.length)}</strong> آموزشگاه
          </span>
          <span className="text-[11px] text-indigo-600 font-medium">
            💡 جهت مشاهده «ریز جزئیات فعالیت‌های انجام‌شده، دیر انجام‌شده یا نشده» روی دکمه ریز فعالیت‌ها کلیک فرمایید.
          </span>
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-10 text-center">رتبه</th>
                <th className="p-3.5 w-20 text-center">کد مدرسه</th>
                <th className="p-3.5">نام آموزشگاه و آدرس جغرافیایی</th>
                <th className="p-3.5 text-center">نوع اداره</th>
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
                <th className="p-3.5 text-center no-print">ریز فعالیت‌ها و عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedAndFiltered.map(({ school, stats }, idx) => {
                const isExpanded = expandedSchoolId === school.id;
                return (
                  <React.Fragment key={school.id}>
                    <tr
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExpanded ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-600">{school.code}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>{school.name}</span>
                          {school.principalName && (
                            <span className="text-[11px] font-normal text-slate-500">
                              (مدیر: {school.principalName})
                            </span>
                          )}
                        </div>
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (school.schoolType || 'دولتی') === 'غیردولتی'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : (school.schoolType || 'دولتی') === 'هیئت امنایی'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {school.schoolType || 'دولتی'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (school.areaType || 'شهری') === 'روستایی'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {(school.areaType || 'شهری') === 'روستایی' ? '🌾 روستایی' : '🏢 شهری'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <div className="font-medium">{school.grade}</div>
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
                          {/* Toggle detailed activities button */}
                          <button
                            onClick={() => {
                              setExpandedSchoolId(isExpanded ? null : school.id);
                              setActivityStatusFilter('all');
                              setActivityScopeFilter('all');
                              setActivitySearchQuery('');
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isExpanded
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                            title="مشاهده ریز فعالیت‌های انجام‌شده، دیر انجام‌شده یا نشده این مدرسه"
                          >
                            <span>ریز فعالیت‌ها</span>
                            <span className="font-mono text-[11px] bg-black/10 px-1 py-0.2 rounded">
                              {toPersianDigits(stats.totalPrograms)}
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => onFilterBySchool(school.id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                            title="مشاهده نیروهای مدرسه در گزارش همکاران"
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

                    {/* EXPANDABLE ACCORDION: Granular School Activities Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-y-2 border-indigo-200 animate-fadeIn">
                        <td colSpan={15} className="p-4 sm:p-5">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 sm:p-5 space-y-4">
                            {/* Accordion Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span>ریز جزئیات فعالیت‌ها و تکالیف آموزشگاه «{school.name}»</span>
                                    <span className="text-[11px] font-normal text-slate-500">
                                      ({school.schoolType || 'دولتی'} - {(school.areaType || 'شهری') === 'روستایی' ? 'روستایی' : 'شهری'})
                                    </span>
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    لیست کامل تکالیف ارجاعی به نیروهای این مدرسه با تفکیک دقیق انجام‌شده، با تأخیر و عدم اجرا
                                  </p>
                                </div>
                              </div>

                              {/* Close Sub-table button */}
                              <button
                                onClick={() => setExpandedSchoolId(null)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="بستن پنل ریز فعالیت‌ها"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Summary metrics for this school's activities */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                                <span className="text-[11px] text-slate-500 block">کل برنامه‌ها</span>
                                <span className="text-base font-black font-mono text-slate-800">
                                  {toPersianDigits(expandedSchoolMetrics.total)} مورد
                                </span>
                              </div>
                              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                                <span className="text-[11px] text-emerald-700 font-bold block">🟢 انجام شده به‌موقع</span>
                                <span className="text-base font-black font-mono text-emerald-800">
                                  {toPersianDigits(expandedSchoolMetrics.done)} مورد
                                </span>
                              </div>
                              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                                <span className="text-[11px] text-amber-700 font-bold block">🟠 دیر انجام شده</span>
                                <span className="text-base font-black font-mono text-amber-800">
                                  {toPersianDigits(expandedSchoolMetrics.late)} مورد
                                </span>
                              </div>
                              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                                <span className="text-[11px] text-rose-700 font-bold block">🔴 عدم اجرا</span>
                                <span className="text-base font-black font-mono text-rose-800">
                                  {toPersianDigits(expandedSchoolMetrics.notDone)} مورد
                                </span>
                              </div>
                              <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 text-center col-span-2 sm:col-span-1">
                                <span className="text-[11px] text-indigo-700 font-bold block">درصد تحقق</span>
                                <span className="text-base font-black font-mono text-indigo-900">
                                  %{toPersianDigits(expandedSchoolMetrics.progress)}
                                </span>
                              </div>
                            </div>

                            {/* Activity Filters within this School */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-700">فیلتر وضعیت اجرا:</span>
                                <button
                                  type="button"
                                  onClick={() => setActivityStatusFilter('all')}
                                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                    activityStatusFilter === 'all'
                                      ? 'bg-slate-800 text-white shadow-xs'
                                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                                  }`}
                                >
                                  همه ({toPersianDigits(expandedSchoolMetrics.total)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivityStatusFilter('done')}
                                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                    activityStatusFilter === 'done'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                                  }`}
                                >
                                  🟢 انجام شده ({toPersianDigits(expandedSchoolMetrics.done)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivityStatusFilter('late')}
                                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                    activityStatusFilter === 'late'
                                      ? 'bg-amber-600 text-white shadow-xs'
                                      : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-300'
                                  }`}
                                >
                                  🟠 دیر انجام شده ({toPersianDigits(expandedSchoolMetrics.late)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivityStatusFilter('not_done')}
                                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                    activityStatusFilter === 'not_done'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'bg-white text-rose-700 hover:bg-rose-100 border border-rose-300'
                                  }`}
                                >
                                  🔴 عدم اجرا ({toPersianDigits(expandedSchoolMetrics.notDone)})
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Scope filter inside school activities */}
                                <select
                                  value={activityScopeFilter}
                                  onChange={(e) => setActivityScopeFilter(e.target.value as any)}
                                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold"
                                >
                                  <option value="all">همه طرح‌ها (عمومی و اختصاصی)</option>
                                  <option value="همگانی">🌐 فقط طرح‌های همگانی</option>
                                  <option value="اختصاصی">⭐ فقط طرح‌های اختصاصی</option>
                                </select>

                                {/* Search in activity table */}
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                                  <input
                                    type="text"
                                    value={activitySearchQuery}
                                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                                    placeholder="جستجوی عنوان طرح یا نام همکار..."
                                    className="pr-8 pl-2 py-1 bg-white border border-slate-300 rounded-lg text-xs outline-hidden w-48"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Detailed Activities Table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-right text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="p-2.5 w-10 text-center">#</th>
                                    <th className="p-2.5">عنوان برنامه / طرح</th>
                                    <th className="p-2.5 text-center">حوزه تخصصی</th>
                                    <th className="p-2.5 text-center">نوع و ضریب</th>
                                    <th className="p-2.5">همکار مجری</th>
                                    <th className="p-2.5 text-center">مهلت مقرر</th>
                                    <th className="p-2.5 text-center">تاریخ اجرا</th>
                                    <th className="p-2.5 text-center">محل ارسال</th>
                                    <th className="p-2.5 text-center">وضعیت اجرا</th>
                                    <th className="p-2.5 text-center">امتیاز کسب‌شده</th>
                                    <th className="p-2.5">توضیحات و مستندات</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {expandedSchoolActivities.length === 0 ? (
                                    <tr>
                                      <td colSpan={11} className="p-6 text-center text-slate-400">
                                        فعالیتی با فیلترهای انتخابی برای این آموزشگاه یافت نشد.
                                      </td>
                                    </tr>
                                  ) : (
                                    expandedSchoolActivities.map((item, actIdx) => (
                                      <tr key={item.assignment.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-2.5 text-center font-bold text-slate-400">
                                          {toPersianDigits(actIdx + 1)}
                                        </td>
                                        <td className="p-2.5 font-bold text-slate-800">
                                          <div>{item.program?.title}</div>
                                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            کد: {item.program?.code}
                                          </div>
                                        </td>
                                        <td className="p-2.5 text-center">
                                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                            {item.program?.section || 'پرورشی'}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-center">
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                              item.isSpecific ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                              {item.isSpecific ? '⭐ اختصاصی' : '🌐 همگانی'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold">
                                              ضریب {toPersianDigits(item.coeff)}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="p-2.5">
                                          {item.employee ? (
                                            <div>
                                              <span className="font-bold text-slate-800">{item.employee.fullName}</span>
                                              <div className="text-[10px] text-slate-500">
                                                {item.employee.role} (کد: {item.employee.code})
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400">---</span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-center font-mono font-medium text-slate-600">
                                          {item.program?.deadline}
                                        </td>
                                        <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                                          {item.executionDate || <span className="text-slate-300">---</span>}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {renderPlatformBadge(item.platform)}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          <StatusBadge status={item.status} size="sm" />
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {item.isSpecific ? (
                                            <span className="text-slate-400 text-[10px]">بدون امتیاز</span>
                                          ) : (
                                            <span className={`font-mono font-bold ${
                                              item.earnedPoints > 0 ? 'text-emerald-700' : 'text-slate-400'
                                            }`}>
                                              +{toPersianDigits(item.earnedPoints)}
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2.5 max-w-xs text-slate-600">
                                          {item.assignment.notes ? (
                                            <p className="line-clamp-2 text-[11px]">{item.assignment.notes}</p>
                                          ) : (
                                            <span className="text-slate-300">---</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
