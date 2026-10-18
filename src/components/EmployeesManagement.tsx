import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Employee, School, EducationalGrade, AppDatabase } from '../types';
import { toPersianDigits } from '../utils/jalali';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Phone,
  Building,
  GraduationCap,
  Filter,
  X,
  RotateCcw,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ArrowUpDown,
  Briefcase,
  Hash,
  Upload,
  Clock,
  IdCard,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { EmployeeExcelImportModal } from './EmployeeExcelImportModal';

interface EmployeesManagementProps {
  employees: Employee[];
  schools: School[];
  onSelectEmployee: (emp: Employee) => void;
  onOpenNewModal: () => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (empId: string) => void;
  onNavigateToExcelImport?: () => void;
  db?: AppDatabase;
  onUpdateDatabase?: (newDb: AppDatabase) => void;
}

const GRADES_LIST: { id: string; label: string }[] = [
  { id: 'all', label: 'تمام مقاطع تحصیلی' },
  { id: 'ابتدایی دوره اول', label: 'ابتدایی دوره اول' },
  { id: 'ابتدایی دوره دوم', label: 'ابتدایی دوره دوم' },
  { id: 'متوسطه اول', label: 'متوسطه اول' },
  { id: 'متوسطه دوم نظری', label: 'متوسطه دوم نظری' },
  { id: 'هنرستان فنی و حرفه‌ای و کاردانش', label: 'هنرستان فنی و حرفه‌ای' },
  { id: 'مجتمع آموزشی و پرورشی', label: 'مجتمع آموزشی و پرورشی' },
];

const ROLES_LIST: { id: string; label: string }[] = [
  { id: 'all', label: 'تمام سمت‌ها' },
  { id: 'مدیر', label: '۱. مدیر' },
  { id: 'معاون آموزشی', label: '۲. معاون آموزشی' },
  { id: 'معاون پرورشی', label: '۳. معاون پرورشی' },
  { id: 'مربی پرورشی', label: '۴. مربی پرورشی' },
  { id: 'رابط پرورشی', label: '۵. رابط پرورشی' },
  { id: 'دبیر', label: '۶. دبیر' },
  { id: 'آموزگار', label: '۷. آموزگار' },
  { id: 'معاون اجرایی', label: '۸. معاون اجرایی' },
  { id: 'سایر', label: '۹. سایر سمت‌ها' },
];

function normalizeText(str?: string | null): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let res = String(str).toLowerCase().trim();

  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(persianDigits[i], String(i));
    res = res.replaceAll(arabicDigits[i], String(i));
  }

  res = res
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');

  return res;
}

export const EmployeesManagement: React.FC<EmployeesManagementProps> = ({
  employees,
  schools,
  onSelectEmployee,
  onOpenNewModal,
  onEditEmployee,
  onDeleteEmployee,
  onNavigateToExcelImport,
  db,
  onUpdateDatabase,
}) => {
  const [generalSearch, setGeneralSearch] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'کد ملی',
      'کد پرسنلی',
      'نام و نام خانوادگی',
      'نام آموزشگاه',
      'مقطع تحصیلی',
      'سمت سازمانی',
      'سابقه خدمت (سال)',
      'شماره تماس',
      'توضیحات و سوابق',
    ];
    const sampleData = [
      headers,
      [
        '1289456123',
        '201001',
        'حسین صادقی',
        'دبیرستان شهید بهشتی',
        'متوسطه اول',
        'معاون پرورشی',
        '15',
        '09131112233',
        'همکار با سابقه، مسئول برگزاری مسابقات',
      ],
      [
        '1287349102',
        '201002',
        'زهره کریمی',
        'دبیرستان فرزانگان',
        'متوسطه دوم نظری',
        'معاون پرورشی',
        '12',
        '09132223344',
        'پیگیر و منظم در ارسال گزارش‌ها',
      ],
      [
        '1290123456',
        '201003',
        'رضا مرادی',
        'دبستان انقلاب اسلامی',
        'ابتدایی دوره دوم',
        'آموزگار',
        '8',
        '09133334455',
        'آموزگار پایه پنجم',
      ],
      [
        '1278912345',
        '201004',
        'الهام سعیدی',
        'هنرستان فنی دخترانه کوثر',
        'هنرستان فنی و حرفه‌ای و کاردانش',
        'دبیر',
        '10',
        '09134445566',
        'دبیر تربیت بدنی',
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 30 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'مشخصات همکاران');
    XLSX.writeFile(wb, 'الگوی_اکسل_مشخصات_همکاران_ناحیه۶.xlsx');
  };

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'school'>('code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const uniqueSchoolNames = useMemo(() => {
    const names = new Set<string>();
    schools.forEach((s) => s.name && names.add(s.name.trim()));
    employees.forEach((e) => e.schoolName && names.add(e.schoolName.trim()));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [schools, employees]);

  const hasActiveFilters = useMemo(() => {
    return (
      generalSearch.trim() !== '' ||
      nameFilter.trim() !== '' ||
      codeFilter.trim() !== '' ||
      schoolFilter !== 'all' ||
      gradeFilter !== 'all' ||
      roleFilter !== 'all'
    );
  }, [generalSearch, nameFilter, codeFilter, schoolFilter, gradeFilter, roleFilter]);

  const handleClearAllFilters = () => {
    setGeneralSearch('');
    setNameFilter('');
    setCodeFilter('');
    setSchoolFilter('all');
    setGradeFilter('all');
    setRoleFilter('all');
  };

  const filteredEmployees = useMemo(() => {
    const normGeneral = normalizeText(generalSearch);
    const normName = normalizeText(nameFilter);
    const normCode = normalizeText(codeFilter);

    return employees.filter((emp) => {
      const empNormName = normalizeText(emp.fullName);
      const empNormCode = normalizeText(emp.code);
      const empNormPersonnel = normalizeText(emp.personnelCode || '');
      const empNormNationalId = normalizeText(emp.nationalId || '');
      const empNormSchool = normalizeText(emp.schoolName);
      const empNormRole = normalizeText(emp.role);
      const empNormPhone = normalizeText(emp.phone);
      const empNormExp = normalizeText(String(emp.experienceYears || ''));

      if (normGeneral) {
        const matchesGeneral =
          empNormName.includes(normGeneral) ||
          empNormCode.includes(normGeneral) ||
          empNormPersonnel.includes(normGeneral) ||
          empNormNationalId.includes(normGeneral) ||
          empNormSchool.includes(normGeneral) ||
          empNormRole.includes(normGeneral) ||
          empNormPhone.includes(normGeneral) ||
          empNormExp.includes(normGeneral);

        if (!matchesGeneral) return false;
      }

      if (normName && !empNormName.includes(normName)) return false;

      if (normCode) {
        const matchesCode =
          empNormCode.includes(normCode) ||
          empNormPersonnel.includes(normCode) ||
          empNormNationalId.includes(normCode) ||
          normalizeText(toPersianDigits(emp.code)).includes(normCode);
        if (!matchesCode) return false;
      }

      if (schoolFilter !== 'all' && emp.schoolName !== schoolFilter) return false;
      if (gradeFilter !== 'all' && emp.grade !== gradeFilter) return false;

      if (roleFilter !== 'all') {
        if (roleFilter === 'سایر') {
          const coreRoles = new Set(['مدیر', 'معاون آموزشی', 'معاون پرورشی', 'مربی پرورشی', 'رابط پرورشی', 'دبیر', 'آموزگار', 'معاون اجرایی']);
          const isStandardRole = coreRoles.has(emp.role) || emp.role.startsWith('معاون پرورشی') || emp.role.startsWith('مربی پرورشی') || emp.role.startsWith('رابط پرورشی');
          if (isStandardRole && emp.role !== 'سایر') return false;
        } else if (roleFilter === 'معاون پرورشی') {
          if (emp.role !== 'معاون پرورشی' && !emp.role.includes('معاون پرورشی')) return false;
        } else if (roleFilter === 'مربی پرورشی') {
          if (emp.role !== 'مربی پرورشی' && !emp.role.includes('مربی پرورشی') && !emp.role.includes('مربی امور تربیتی')) return false;
        } else if (roleFilter === 'رابط پرورشی') {
          if (emp.role !== 'رابط پرورشی' && !emp.role.includes('رابط پرورشی')) return false;
        } else if (emp.role !== roleFilter) {
          return false;
        }
      }

      return true;
    });
  }, [employees, generalSearch, nameFilter, codeFilter, schoolFilter, gradeFilter, roleFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'code') {
        const codeA = parseInt(a.code, 10) || 0;
        const codeB = parseInt(b.code, 10) || 0;
        cmp = codeA - codeB;
      } else if (sortBy === 'name') {
        cmp = a.fullName.localeCompare(b.fullName, 'fa');
      } else if (sortBy === 'school') {
        cmp = a.schoolName.localeCompare(b.schoolName, 'fa');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredEmployees, sortBy, sortOrder]);

  const toggleSort = (newSortBy: 'code' | 'name' | 'school') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-lg">
              ناحیه ۶ اصفهان
            </span>
            <span className="text-xs text-slate-500 font-medium">پرونده پرسنلی همکاران</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>مدیریت اطلاعات و پرونده همکاران</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            سامانه جستجوی هوشمند بر اساس کد ملی، کد پرسنلی، نام آموزشگاه، مقطع، سمت و سابقه خدمت
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {db && onUpdateDatabase ? (
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="بارگذاری فایل اکسل شامل کد ملی، پرسنلی، آموزشگاه، مقطع، سمت و سابقه"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>بارگذاری مشخصات همکاران از Excel</span>
            </button>
          ) : onNavigateToExcelImport ? (
            <button
              onClick={onNavigateToExcelImport}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              title="بارگذاری فایل اکسل شامل کد ملی، پرسنلی، آموزشگاه، مقطع، سمت و سابقه"
            >
              <Upload className="w-4 h-4" />
              <span>بارگذاری همکاران از Excel</span>
            </button>
          ) : null}

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="دانلود الگوی استاندارد اکسل شامل کد ملی، کد پرسنلی، نام آموزشگاه، مقطع، سمت و سابقه"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>الگوی اکسل همکاران</span>
          </button>

          <button
            onClick={onOpenNewModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>ثبت دستی همکار</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
            <input
              type="text"
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              placeholder="جستجوی همه‌جانبه (نام، کد ملی، کد پرسنلی، نام مدرسه، سمت، سابقه)..."
              className="w-full pr-10 pl-9 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden font-medium"
            />
            {generalSearch && (
              <button
                onClick={() => setGeneralSearch('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer ${
                showAdvancedFilters ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span>فیلترهای تفکیک‌شده</span>
            </button>

            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'}`}
                title="نمایش کارتی"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${viewMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'}`}
                title="نمایش جدولی فشرده"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>حذف فیلترها</span>
              </button>
            )}
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="p-4 bg-white border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نام یا نام خانوادگی:</label>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="مثال: کریمی..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">کد ملی / پرسنلی / کارتابل:</label>
                <input
                  type="text"
                  value={codeFilter}
                  onChange={(e) => setCodeFilter(e.target.value)}
                  placeholder="کد ملی، پرسنلی یا ۲ رقمی..."
                  dir="ltr"
                  className="w-full text-center font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">آموزشگاه:</label>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="w-full py-2 px-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
                >
                  <option value="all">همه آموزشگاه‌ها ({uniqueSchoolNames.length})</option>
                  {uniqueSchoolNames.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مقطع:</label>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="w-full py-2 px-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
                >
                  {GRADES_LIST.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سمت:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full py-2 px-2 bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
                >
                  {ROLES_LIST.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-2.5 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
          <span>
            تعداد همکاران: <strong className="font-mono text-emerald-700 font-bold">{toPersianDigits(sortedEmployees.length)}</strong> نفر
          </span>
          <span className="text-[11px] text-slate-400">
            برای ثبت مشخصات گروهی از اکسل، از کلید «بارگذاری همکاران از Excel» استفاده فرمایید.
          </span>
        </div>
      </div>

      {sortedEmployees.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs">
          <p className="font-bold text-slate-800">همکاری با این مشخصات یافت نشد.</p>
          <button onClick={handleClearAllFilters} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer">
            حذف فیلترها
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-black text-sm bg-slate-900 text-white px-3 py-1 rounded-xl">
                      کد {emp.code}
                    </span>
                    {emp.nationalId && (
                      <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg" title="کد ملی">
                        ملی: {emp.nationalId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditEmployee(emp)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                      title="ویرایش"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEmployee(emp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-800">{emp.fullName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-emerald-800 font-semibold">{emp.role}</span>
                  {emp.experienceYears !== undefined && emp.experienceYears !== '' && (
                    <span className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.2 rounded-md font-bold">
                      سابقه: {toPersianDigits(emp.experienceYears)} سال
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{emp.schoolName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-slate-500">{emp.grade}</span>
                  </div>
                  {emp.personnelCode && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400">پرسنلی:</span>
                      <span className="font-mono text-slate-700 font-bold">{emp.personnelCode}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-1.5 font-mono text-slate-500 text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span dir="ltr">{emp.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onSelectEmployee(emp)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <span>ورود به کارتابل همکار</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 text-center w-12">#</th>
                <th onClick={() => toggleSort('code')} className="p-3 w-20 text-center cursor-pointer">کد کارتابل</th>
                <th onClick={() => toggleSort('name')} className="p-3 cursor-pointer">نام و نام خانوادگی</th>
                <th className="p-3 text-center">کد ملی</th>
                <th className="p-3 text-center">کد پرسنلی</th>
                <th onClick={() => toggleSort('school')} className="p-3 cursor-pointer">آموزشگاه</th>
                <th className="p-3">مقطع</th>
                <th className="p-3">سمت</th>
                <th className="p-3 text-center">سابقه خدمت</th>
                <th className="p-3 text-center w-28">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedEmployees.map((emp, idx) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="p-3 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3 text-center font-mono font-bold">{emp.code}</td>
                  <td className="p-3 font-bold text-slate-800">{emp.fullName}</td>
                  <td className="p-3 text-center font-mono text-slate-700">{emp.nationalId || '---'}</td>
                  <td className="p-3 text-center font-mono text-slate-700">{emp.personnelCode || '---'}</td>
                  <td className="p-3 text-slate-700">{emp.schoolName}</td>
                  <td className="p-3 text-slate-500">{emp.grade}</td>
                  <td className="p-3 text-emerald-800 font-semibold">{emp.role}</td>
                  <td className="p-3 text-center font-bold text-amber-800 font-mono">
                    {emp.experienceYears !== undefined && emp.experienceYears !== '' ? `${toPersianDigits(emp.experienceYears)} سال` : '---'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => onSelectEmployee(emp)}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      کارتابل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {db && onUpdateDatabase && (
        <EmployeeExcelImportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          db={db}
          onUpdateDatabase={onUpdateDatabase}
        />
      )}
    </div>
  );
};
