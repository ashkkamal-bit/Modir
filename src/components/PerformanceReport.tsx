import React, { useState, useMemo } from 'react';
import { Employee, EmployeeProgram, School, Program } from '../types';
import { calculateEmployeeStats } from '../utils/storage';
import { toPersianDigits } from '../utils/jalali';
import {
  Search,
  ArrowUpDown,
  Printer,
  FileSpreadsheet,
  ExternalLink,
  Users,
} from 'lucide-react';

interface PerformanceReportProps {
  employees: Employee[];
  employeePrograms: EmployeeProgram[];
  programs?: Program[];
  schools: School[];
  onSelectEmployee: (emp: Employee) => void;
  onExportExcel: () => void;
}

type SortField =
  | 'code'
  | 'fullName'
  | 'schoolName'
  | 'total'
  | 'done'
  | 'late'
  | 'notDone'
  | 'progressPercent'
  | 'onTimePercent'
  | 'earnedWeightedScore';

export const PerformanceReport: React.FC<PerformanceReportProps> = ({
  employees,
  employeePrograms,
  programs,
  schools,
  onSelectEmployee,
  onExportExcel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(() => {
    return employees.map((emp) => {
      const stats = calculateEmployeeStats(emp.id, employeePrograms, programs);
      return {
        emp,
        stats,
      };
    });
  }, [employees, employeePrograms, programs]);

  const filteredRows = useMemo(() => {
    return rows.filter(({ emp, stats }) => {
      if (filterSchool !== 'all' && emp.schoolId !== filterSchool) return false;
      if (filterGrade !== 'all' && emp.grade !== filterGrade) return false;
      if (filterRole !== 'all') {
        if (filterRole === 'سایر') {
          const coreSix = new Set(['مدیر', 'معاون آموزشی', 'معاون پرورشی', 'دبیر', 'آموزگار', 'معاون اجرایی']);
          const isStandard = coreSix.has(emp.role) || emp.role.startsWith('معاون پرورشی');
          if (isStandard && emp.role !== 'سایر') return false;
        } else if (filterRole === 'معاون پرورشی') {
          if (emp.role !== 'معاون پرورشی' && !emp.role.includes('معاون پرورشی')) return false;
        } else if (emp.role !== filterRole) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = emp.code.includes(q);
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchSchool = emp.schoolName.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchSchool) return false;
      }
      return true;
    });
  }, [rows, filterSchool, filterGrade, filterRole, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'code') {
        valA = parseInt(a.emp.code, 10);
        valB = parseInt(b.emp.code, 10);
      } else if (sortField === 'fullName') {
        valA = a.emp.fullName;
        valB = b.emp.fullName;
      } else if (sortField === 'schoolName') {
        valA = a.emp.schoolName;
        valB = b.emp.schoolName;
      } else {
        valA = a.stats[sortField];
        valB = b.stats[sortField];
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(
        field === 'progressPercent' || field === 'onTimePercent' || field === 'earnedWeightedScore'
          ? 'desc'
          : 'asc',
      );
    }
  };

  const distinctSchools = Array.from(
    new Map(schools.map((s) => [s.id, { id: s.id, name: s.name }])).values(),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>گزارش جامع عملکرد تمام همکاران</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جدول تفکیکی تکالیف، تعداد انجام شده، تاخیر، درصد پیشرفت و امتیاز نهایی وزنی با ضرایب ۱ تا ۳
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ گزارش</span>
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>خروجی Excel</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی کد، نام یا آموزشگاه..."
            className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
          />
        </div>

        <div>
          <select
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
          >
            <option value="all">تمام آموزشگاه‌ها ({toPersianDigits(distinctSchools.length)})</option>
            {distinctSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden"
          >
            <option value="all">تمام مقاطع تحصیلی</option>
            <option value="ابتدایی دوره اول">ابتدایی دوره اول</option>
            <option value="ابتدایی دوره دوم">ابتدایی دوره دوم</option>
            <option value="متوسطه اول">متوسطه اول</option>
            <option value="متوسطه دوم نظری">متوسطه دوم نظری</option>
            <option value="هنرستان فنی و حرفه‌ای و کاردانش">هنرستان</option>
          </select>
        </div>

        <div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden font-medium"
          >
            <option value="all">تمام سمت‌ها</option>
            <option value="مدیر">مدیر</option>
            <option value="معاون آموزشی">معاون آموزشی</option>
            <option value="معاون پرورشی">معاون پرورشی</option>
            <option value="دبیر">دبیر</option>
            <option value="آموزگار">آموزگار</option>
            <option value="معاون اجرایی">معاون اجرایی</option>
            <option value="سایر">سایر</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none">
              <tr>
                <th className="p-3.5 w-12 text-center">ردیف</th>
                <th
                  onClick={() => handleSort('code')}
                  className="p-3.5 w-20 text-center cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>کد</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('fullName')}
                  className="p-3.5 cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>نام و نام خانوادگی</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('schoolName')}
                  className="p-3.5 cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>آموزشگاه محل خدمت</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5">مقطع و سمت</th>
                <th
                  onClick={() => handleSort('total')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>کل برنامه‌ها</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('done')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100 text-emerald-800"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>🟢 به‌موقع</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('late')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100 text-amber-800"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>🟠 تاخیر</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('notDone')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100 text-rose-800"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>🔴 نشد</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('progressPercent')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100 bg-emerald-50/50"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>درصد پیشرفت</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('earnedWeightedScore')}
                  className="p-3.5 text-center cursor-pointer hover:bg-slate-100 bg-amber-50/70"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>امتیاز نهایی با ضریب</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-700" />
                  </div>
                </th>
                <th className="p-3.5 text-center no-print">عملیات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedRows.map(({ emp, stats }, idx) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 text-center text-slate-400 font-bold">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => onSelectEmployee(emp)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-600 text-white font-mono font-bold rounded-lg cursor-pointer"
                    >
                      {emp.code}
                    </button>
                  </td>
                  <td className="p-3.5 font-bold text-slate-800">{emp.fullName}</td>
                  <td className="p-3.5 text-slate-700">{emp.schoolName}</td>
                  <td className="p-3.5 text-slate-600">{emp.role} ({emp.grade})</td>
                  <td className="p-3.5 text-center font-bold">{toPersianDigits(stats.total)}</td>
                  <td className="p-3.5 text-center font-bold text-emerald-600 bg-emerald-50/30">{toPersianDigits(stats.done)}</td>
                  <td className="p-3.5 text-center font-bold text-amber-600 bg-amber-50/30">{toPersianDigits(stats.late)}</td>
                  <td className="p-3.5 text-center font-bold text-rose-600 bg-rose-50/30">{toPersianDigits(stats.notDone)}</td>
                  <td className="p-3.5 text-center font-black text-emerald-700 bg-emerald-50/60 font-mono">%{toPersianDigits(stats.progressPercent)}</td>
                  <td className="p-3.5 text-center font-black text-amber-900 bg-amber-50/70 font-mono">{toPersianDigits(stats.earnedWeightedScore)}</td>
                  <td className="p-3.5 text-center no-print">
                    <button
                      onClick={() => onSelectEmployee(emp)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <span>کارتابل</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
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
