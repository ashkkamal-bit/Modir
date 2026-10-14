import React, { useState, useMemo } from 'react';
import { Employee, EmployeeProgram, School, Program } from '../types';
import { toPersianDigits } from '../utils/jalali';
import {
  Trophy,
  Award,
  Search,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Building,
  FileCode,
  Briefcase,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IsfahanArchBadge } from './IsfahanMotifs';

interface ColleagueRankingProps {
  employees: Employee[];
  employeePrograms: EmployeeProgram[];
  programs: Program[];
  schools: School[];
  onSelectEmployee: (emp: Employee) => void;
  onExportHtml?: () => void;
}

export type RankingSortBy = 'score' | 'totalDone' | 'onTime' | 'progressPercent';

export const ColleagueRanking: React.FC<ColleagueRankingProps> = ({
  employees,
  employeePrograms,
  programs,
  schools,
  onSelectEmployee,
  onExportHtml,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [sortBy, setSortBy] = useState<RankingSortBy>('score');
  const [selectedTier, setSelectedTier] = useState('all');

  const prgMap = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);

  const colleaguesRanked = useMemo(() => {
    return employees.map((emp) => {
      const empAssignments = employeePrograms.filter((ep) => ep.employeeId === emp.id);

      const generalAssignments = empAssignments.filter((ep) => {
        const prg = prgMap.get(ep.programId);
        return !prg || prg.scope !== 'اختصاصی';
      });

      const specificAssignments = empAssignments.filter((ep) => {
        const prg = prgMap.get(ep.programId);
        return prg?.scope === 'اختصاصی';
      });

      const gTotal = generalAssignments.length;
      const gDone = generalAssignments.filter((a) => a.status === 'done').length;
      const gLate = generalAssignments.filter((a) => a.status === 'late').length;
      const gNotDone = generalAssignments.filter((a) => a.status === 'not_done').length;
      const gProgressPercent = gTotal > 0 ? Math.round(((gDone + gLate) / gTotal) * 100) : 0;
      const gOnTimePercent = gTotal > 0 ? Math.round((gDone / gTotal) * 100) : 0;

      let weightedPossible = 0;
      let earnedScore = 0;
      let totalCoefficients = 0;

      for (const a of generalAssignments) {
        const prg = prgMap.get(a.programId);
        const coeff = (prg?.coefficient && [1, 2, 3].includes(prg.coefficient)) ? prg.coefficient : 1;
        totalCoefficients += coeff;
        weightedPossible += coeff * 100;

        if (a.status === 'done') {
          earnedScore += coeff * 100;
        } else if (a.status === 'late') {
          earnedScore += coeff * 60;
        }
      }

      const weightedProgressPercent =
        weightedPossible > 0 ? Number(((earnedScore / weightedPossible) * 100).toFixed(1)) : 0;

      const stats = {
        total: gTotal,
        done: gDone,
        late: gLate,
        notDone: gNotDone,
        progressPercent: gProgressPercent,
        onTimePercent: gOnTimePercent,
        totalCoefficients,
        weightedPossible,
        earnedWeightedScore: earnedScore,
        weightedProgressPercent,
      };

      const score = earnedScore;
      const totalCompleted = stats.done + stats.late;

      let tier: 'ممتاز' | 'بسیار خوب' | 'خوب' | 'نیازمند پیگیری';
      let tierColor: string;
      if (score >= 600 || (stats.total > 0 && stats.progressPercent >= 85)) {
        tier = 'ممتاز';
        tierColor = 'bg-amber-100 text-amber-800 border-amber-300';
      } else if (score >= 350 || (stats.total > 0 && stats.progressPercent >= 65)) {
        tier = 'بسیار خوب';
        tierColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (score >= 150 || (stats.total > 0 && stats.progressPercent >= 40)) {
        tier = 'خوب';
        tierColor = 'bg-blue-100 text-blue-800 border-blue-300';
      } else {
        tier = 'نیازمند پیگیری';
        tierColor = 'bg-rose-100 text-rose-800 border-rose-300';
      }

      return {
        emp,
        stats,
        score,
        totalCompleted,
        totalCoefficients,
        specificCount: specificAssignments.length,
        specificDone: specificAssignments.filter((a) => a.status === 'done' || a.status === 'late').length,
        tier,
        tierColor,
      };
    });
  }, [employees, employeePrograms, prgMap]);

  const filteredAndSorted = useMemo(() => {
    return colleaguesRanked
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            item.emp.fullName.toLowerCase().includes(q) ||
            item.emp.code.includes(q) ||
            item.emp.schoolName.toLowerCase().includes(q) ||
            item.emp.role.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (selectedGrade !== 'all' && item.emp.grade !== selectedGrade) return false;
        if (selectedSchool !== 'all' && item.emp.schoolId !== selectedSchool) return false;

        if (selectedRole !== 'all') {
          if (selectedRole === 'سایر') {
            const coreSix = new Set(['مدیر', 'معاون آموزشی', 'معاون پرورشی', 'دبیر', 'آموزگار', 'معاون اجرایی']);
            const isStandard = coreSix.has(item.emp.role) || item.emp.role.startsWith('معاون پرورشی');
            if (isStandard && item.emp.role !== 'سایر') return false;
          } else if (selectedRole === 'معاون پرورشی') {
            if (item.emp.role !== 'معاون پرورشی' && !item.emp.role.includes('معاون پرورشی')) return false;
          } else if (item.emp.role !== selectedRole) {
            return false;
          }
        }

        if (selectedTier !== 'all' && item.tier !== selectedTier) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') {
          if (b.score !== a.score) return b.score - a.score;
          if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
          return b.stats.onTimePercent - a.stats.onTimePercent;
        }
        if (sortBy === 'totalDone') {
          if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
          return b.score - a.score;
        }
        if (sortBy === 'progressPercent') {
          return b.stats.progressPercent - a.stats.progressPercent;
        }
        return 0;
      });
  }, [colleaguesRanked, searchQuery, selectedGrade, selectedSchool, selectedRole, selectedTier, sortBy]);

  const handleExportRankingExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'رتبه',
      'کد همکار',
      'نام و نام خانوادگی',
      'آموزشگاه',
      'مقطع تحصیلی',
      'سمت',
      'طرح‌های همگانی',
      'مجموع ضرایب',
      'طرح‌های اختصاصی',
      'انجام شده به‌موقع',
      'دیر انجام شده',
      'انجام نشده',
      'درصد پیشرفت',
      'امتیاز نهایی با ضریب',
      'سطح عملکرد',
    ];

    const dataRows = filteredAndSorted.map((item, index) => [
      index + 1,
      item.emp.code,
      item.emp.fullName,
      item.emp.schoolName,
      item.emp.grade,
      item.emp.role,
      item.stats.total,
      item.totalCoefficients,
      item.specificCount,
      item.stats.done,
      item.stats.late,
      item.stats.notDone,
      `${item.stats.progressPercent}%`,
      item.score,
      item.tier,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    XLSX.utils.book_append_sheet(wb, ws, 'رتبه‌بندی همکاران');
    XLSX.writeFile(wb, `رتبه_بندی_نیروهای_ناحیه۶.xlsx`);
  };

  const topThree = filteredAndSorted.slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              <span>رتبه‌بندی رسمی و تابلوی افتخار نیروها (با ضرایب ۱ تا ۳)</span>
            </h2>
            <IsfahanArchBadge title="ناحیه ۶ اصفهان" subtitle="ارزشیابی عملکرد" />
          </div>
          <p className="text-xs text-slate-500">
            امتیازبندی هوشمند با اعمال ضرایب ۱ تا ۳ طرح‌ها در ۵ بخش آموزشی، پرورشی و تربیت بدنی
          </p>
        </div>

        <div className="flex items-center gap-2.5 no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>چاپ رتبه‌بندی</span>
          </button>
          {onExportHtml && (
            <button
              onClick={onExportHtml}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="خروجی کامل رتبه‌بندی در قالب فایل HTML"
            >
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span>خروجی HTML</span>
            </button>
          )}
          <button
            onClick={handleExportRankingExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>خروجی اکسل</span>
          </button>
        </div>
      </div>

      {/* Podium */}
      {topThree.length >= 3 && (
        <div className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl">
          <div className="text-center mb-6">
            <h3 className="text-lg sm:text-xl font-black">سه رتبه برتر منطقه با بیشترین امتیاز وزنی</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto items-end pt-2">
            <div className="order-2 md:order-1 bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
              <div className="text-3xl mb-1">🥈</div>
              <span className="text-xs font-bold text-slate-400">رتبه دوم</span>
              <h4 className="font-bold text-base text-white mt-1">{topThree[1].emp.fullName}</h4>
              <span className="text-xs text-slate-400 block mb-2">{topThree[1].emp.schoolName}</span>
              <div className="text-base font-black text-amber-400 font-mono">{toPersianDigits(topThree[1].score)} امتیاز</div>
              <button
                onClick={() => onSelectEmployee(topThree[1].emp)}
                className="mt-3 w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                کارتابل (کد {topThree[1].emp.code}) ↵
              </button>
            </div>

            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/80 to-slate-800 rounded-2xl p-6 border-2 border-amber-500 text-center md:-mt-4 shadow-xl">
              <div className="text-4xl mb-1">🥇</div>
              <span className="text-xs font-black text-amber-300">رتبه اول طلایی</span>
              <h4 className="font-black text-lg text-white mt-1">{topThree[0].emp.fullName}</h4>
              <span className="text-xs text-amber-200/80 block mb-2">{topThree[0].emp.schoolName}</span>
              <div className="text-xl font-black text-amber-300 font-mono">{toPersianDigits(topThree[0].score)} امتیاز با ضریب</div>
              <button
                onClick={() => onSelectEmployee(topThree[0].emp)}
                className="mt-3 w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black cursor-pointer shadow-md"
              >
                کارتابل برترین همکار (کد {topThree[0].emp.code}) ↵
              </button>
            </div>

            <div className="order-3 bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
              <div className="text-3xl mb-1">🥉</div>
              <span className="text-xs font-bold text-slate-400">رتبه سوم</span>
              <h4 className="font-bold text-base text-white mt-1">{topThree[2].emp.fullName}</h4>
              <span className="text-xs text-slate-400 block mb-2">{topThree[2].emp.schoolName}</span>
              <div className="text-base font-black text-amber-400 font-mono">{toPersianDigits(topThree[2].score)} امتیاز</div>
              <button
                onClick={() => onSelectEmployee(topThree[2].emp)}
                className="mt-3 w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                کارتابل (کد {topThree[2].emp.code}) ↵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو با نام، کد یا مدرسه..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-hidden focus:bg-white"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as RankingSortBy)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
          >
            <option value="score">🏆 بیشترین امتیاز با ضرایب ۱ تا ۳</option>
            <option value="totalDone">✅ بیشترین تعداد طرح انجام‌شده</option>
            <option value="progressPercent">📈 بالاترین درصد پیشرفت</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          تعداد: <strong>{toPersianDigits(filteredAndSorted.length)}</strong> نفر
        </span>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-16 text-center">رتبه</th>
                <th className="p-3.5 w-20 text-center">کد ۲ رقمی</th>
                <th className="p-3.5">نام و نام خانوادگی</th>
                <th className="p-3.5">آموزشگاه</th>
                <th className="p-3.5">سمت سازمانی</th>
                <th className="p-3.5 text-center text-blue-800">طرح‌های همگانی</th>
                <th className="p-3.5 text-center text-amber-800">مجموع ضرایب</th>
                <th className="p-3.5 text-center text-purple-800">طرح‌های اختصاصی</th>
                <th className="p-3.5 text-center text-emerald-800">🟢 به‌موقع</th>
                <th className="p-3.5 text-center text-amber-800">🟠 تاخیر</th>
                <th className="p-3.5 text-center text-rose-800">🔴 عدم اجرا</th>
                <th className="p-3.5 text-center w-28">درصد پیشرفت</th>
                <th className="p-3.5 text-center bg-amber-50/50 w-28">امتیاز با ضریب</th>
                <th className="p-3.5 text-center">سطح ارزیابی</th>
                <th className="p-3.5 text-center no-print">کارتابل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredAndSorted.map((item, idx) => (
                <tr key={item.emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-lg font-mono font-bold text-xs border border-slate-200">
                      {item.emp.code}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-slate-900 text-sm">{item.emp.fullName}</td>
                  <td className="p-3.5 text-slate-700">{item.emp.schoolName}</td>
                  <td className="p-3.5 text-slate-600">{item.emp.role}</td>
                  <td className="p-3.5 text-center font-bold text-blue-700">{toPersianDigits(item.stats.total)}</td>
                  <td className="p-3.5 text-center font-bold text-amber-800 bg-amber-50/20">{toPersianDigits(item.totalCoefficients)}</td>
                  <td className="p-3.5 text-center font-bold text-purple-700">{toPersianDigits(item.specificCount)}</td>
                  <td className="p-3.5 text-center font-bold text-emerald-600">{toPersianDigits(item.stats.done)}</td>
                  <td className="p-3.5 text-center font-bold text-amber-600">{toPersianDigits(item.stats.late)}</td>
                  <td className="p-3.5 text-center font-bold text-rose-600">{toPersianDigits(item.stats.notDone)}</td>
                  <td className="p-3.5 text-center font-bold text-emerald-700">%{toPersianDigits(item.stats.progressPercent)}</td>
                  <td className="p-3.5 text-center font-black text-amber-900 bg-amber-50/50 font-mono text-sm">{toPersianDigits(item.score)}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.tierColor}`}>{item.tier}</span>
                  </td>
                  <td className="p-3.5 text-center no-print">
                    <button
                      onClick={() => onSelectEmployee(item.emp)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>کارتابل</span>
                      <ExternalLink className="w-3 h-3" />
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
