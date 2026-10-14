import React, { useState, useEffect } from 'react';
import { School, EducationalGrade } from '../types';
import { X, School as SchoolIcon, Save, AlertCircle } from 'lucide-react';

interface SchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schoolData: Omit<School, 'id'>, existingId?: string) => void;
  existingSchool?: School | null;
  existingSchools: School[];
}

const GRADES: EducationalGrade[] = [
  'ابتدایی دوره اول',
  'ابتدایی دوره دوم',
  'متوسطه اول',
  'متوسطه دوم نظری',
  'هنرستان فنی و حرفه‌ای و کاردانش',
  'مجتمع آموزشی و پرورشی',
];

export const SchoolModal: React.FC<SchoolModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingSchool,
  existingSchools,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [grade, setGrade] = useState<EducationalGrade>('متوسطه اول');
  const [gender, setGender] = useState<'دخترانه' | 'پسرانه' | 'مختلط'>('پسرانه');
  const [principalName, setPrincipalName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (existingSchool) {
      setName(existingSchool.name);
      setCode(existingSchool.code);
      setGrade(existingSchool.grade);
      setGender(existingSchool.gender);
      setPrincipalName(existingSchool.principalName || '');
      setPhone(existingSchool.phone || '');
      setNotes(existingSchool.notes || '');
      setErrorMessage('');
    } else {
      setName('');
      setCode(`10${existingSchools.length + 1}`);
      setGrade('متوسطه اول');
      setGender('پسرانه');
      setPrincipalName('');
      setPhone('');
      setNotes('');
      setErrorMessage('');
    }
  }, [existingSchool, isOpen, existingSchools]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('نام آموزشگاه الزامی است.');
      return;
    }

    onSave(
      {
        name: name.trim(),
        code: code.trim() || '---',
        grade,
        gender,
        principalName: principalName.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      },
      existingSchool?.id,
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-800 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SchoolIcon className="w-6 h-6 text-indigo-300" />
            <h3 className="text-lg font-bold">
              {existingSchool ? 'ویرایش اطلاعات آموزشگاه' : 'ثبت آموزشگاه جدید'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نام کامل آموزشگاه <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: دبستان انقلاب اسلامی"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">کد واحد آموزشی</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="107"
                className="w-full text-center px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">مقطع تحصیلی</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as EducationalGrade)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-sm"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">جنسیت</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden text-sm"
              >
                <option value="پسرانه">پسرانه</option>
                <option value="دخترانه">دخترانه</option>
                <option value="مختلط">مختلط</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{existingSchool ? 'ذخیره تغییرات' : 'ثبت آموزشگاه'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
