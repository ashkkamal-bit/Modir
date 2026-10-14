import React, { useState, useEffect } from 'react';
import { Employee, School, EducationalGrade, STANDARD_ROLES, StandardStaffRole } from '../types';
import { padZero } from '../utils/jalali';
import { X, UserPlus, Save, AlertCircle, Building2, Plus } from 'lucide-react';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    employeeData: Omit<Employee, 'id' | 'createdAt'>,
    existingId?: string,
    newSchoolToCreate?: Omit<School, 'id'>,
  ) => void;
  existingEmployee?: Employee | null;
  schools: School[];
  existingEmployees: Employee[];
}

const GRADES: EducationalGrade[] = [
  'ابتدایی دوره اول',
  'ابتدایی دوره دوم',
  'متوسطه اول',
  'متوسطه دوم نظری',
  'هنرستان فنی و حرفه‌ای و کاردانش',
  'مجتمع آموزشی و پرورشی',
];

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingEmployee,
  schools,
  existingEmployees,
}) => {
  const [code, setCode] = useState('');
  const [personnelCode, setPersonnelCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [grade, setGrade] = useState<EducationalGrade>('متوسطه اول');
  const [selectedRoleOption, setSelectedRoleOption] = useState<StandardStaffRole>('معاون پرورشی');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isNewSchoolMode, setIsNewSchoolMode] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [newSchoolGender, setNewSchoolGender] = useState<'دخترانه' | 'پسرانه' | 'مختلط'>('پسرانه');

  const getNextAvailableCode = (): string => {
    const usedCodes = new Set(existingEmployees.map((e) => parseInt(e.code, 10)).filter((n) => !isNaN(n)));
    for (let i = 1; i <= 99; i++) {
      if (!usedCodes.has(i)) {
        return padZero(i);
      }
    }
    return '99';
  };

  useEffect(() => {
    if (existingEmployee) {
      setCode(existingEmployee.code);
      setPersonnelCode(existingEmployee.personnelCode || existingEmployee.code || '');
      setNationalId(existingEmployee.nationalId || '');
      setFullName(existingEmployee.fullName);
      setSchoolId(existingEmployee.schoolId);
      setGrade(existingEmployee.grade);

      const isStd = (STANDARD_ROLES as readonly string[]).includes(existingEmployee.role);
      if (isStd) {
        setSelectedRoleOption(existingEmployee.role as StandardStaffRole);
        setCustomRoleTitle(existingEmployee.customRoleTitle || '');
      } else {
        setSelectedRoleOption('سایر');
        setCustomRoleTitle(existingEmployee.role || '');
      }

      setExperienceYears(existingEmployee.experienceYears !== undefined ? String(existingEmployee.experienceYears) : '');
      setPhone(existingEmployee.phone);
      setNotes(existingEmployee.notes || '');
      setErrorMessage('');
      setIsNewSchoolMode(false);
      setNewSchoolName('');
      setNewSchoolCode('');
    } else {
      const nextCode = getNextAvailableCode();
      setCode(nextCode);
      setPersonnelCode(nextCode);
      setNationalId('');
      setFullName('');
      setSchoolId(schools[0]?.id || '');
      setGrade(schools[0]?.grade || 'متوسطه اول');
      setSelectedRoleOption('معاون پرورشی');
      setCustomRoleTitle('');
      setExperienceYears('');
      setPhone('');
      setNotes('');
      setErrorMessage('');
      setIsNewSchoolMode(false);
      setNewSchoolName('');
      setNewSchoolCode(`10${schools.length + 1}`);
      setNewSchoolGender('پسرانه');
    }
  }, [existingEmployee, isOpen, schools, existingEmployees]);

  const handleSchoolChange = (newSchoolId: string) => {
    if (newSchoolId === '__NEW__') {
      setIsNewSchoolMode(true);
      setNewSchoolCode(`10${schools.length + 1}`);
      return;
    }
    setSchoolId(newSchoolId);
    const selectedSchool = schools.find((s) => s.id === newSchoolId);
    if (selectedSchool) {
      setGrade(selectedSchool.grade);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const formattedCode = padZero(code.trim());
    if (!formattedCode || formattedCode === '00') {
      setErrorMessage('لطفاً یک کد دو رقمی معتبر (از 01 تا 99) وارد کنید.');
      return;
    }

    const isDuplicate = existingEmployees.some(
      (emp) => emp.code === formattedCode && emp.id !== existingEmployee?.id,
    );
    if (isDuplicate) {
      setErrorMessage(`کد «${formattedCode}» قبلاً به همکار دیگری اختصاص داده شده است.`);
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage('نام و نام خانوادگی همکار الزامی است.');
      return;
    }

    const finalRole =
      selectedRoleOption === 'سایر'
        ? (customRoleTitle.trim() || 'سایر')
        : selectedRoleOption;

    if (isNewSchoolMode) {
      if (!newSchoolName.trim()) {
        setErrorMessage('لطفاً نام آموزشگاه جدید را وارد نمایید.');
        return;
      }

      const newSchoolToCreate: Omit<School, 'id'> = {
        name: newSchoolName.trim(),
        code: newSchoolCode.trim() || `10${schools.length + 1}`,
        grade,
        gender: newSchoolGender,
        notes: 'ثبت شده همزمان با همکار جدید',
      };

      onSave(
        {
          code: formattedCode,
          personnelCode: personnelCode.trim() || formattedCode,
          nationalId: nationalId.trim() || undefined,
          fullName: fullName.trim(),
          schoolId: '',
          schoolName: newSchoolName.trim(),
          grade,
          role: finalRole,
          customRoleTitle: selectedRoleOption === 'سایر' ? customRoleTitle.trim() : undefined,
          experienceYears: experienceYears.trim() ? (isNaN(Number(experienceYears.trim())) ? experienceYears.trim() : Number(experienceYears.trim())) : undefined,
          phone: phone.trim(),
          notes: notes.trim(),
        },
        existingEmployee?.id,
        newSchoolToCreate,
      );
    } else {
      const selectedSchool = schools.find((s) => s.id === schoolId);
      const schoolName = selectedSchool ? selectedSchool.name : 'سایر';

      onSave(
        {
          code: formattedCode,
          personnelCode: personnelCode.trim() || formattedCode,
          nationalId: nationalId.trim() || undefined,
          fullName: fullName.trim(),
          schoolId,
          schoolName,
          grade,
          role: finalRole,
          customRoleTitle: selectedRoleOption === 'سایر' ? customRoleTitle.trim() : undefined,
          experienceYears: experienceYears.trim() ? (isNaN(Number(experienceYears.trim())) ? experienceYears.trim() : Number(experienceYears.trim())) : undefined,
          phone: phone.trim(),
          notes: notes.trim(),
        },
        existingEmployee?.id,
      );
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-6 h-6 text-emerald-300" />
            <h3 className="text-lg font-bold">
              {existingEmployee ? 'ویرایش مشخصات همکار' : 'ثبت همکار جدید'}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد اختصاصی (۲ رقمی) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="27"
                className="w-full text-center font-mono font-bold text-lg px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام و نام خانوادگی <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="علی رضایی"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* School Selection */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>آموزشگاه محل خدمت</span>
                <span className="text-rose-500">*</span>
              </label>
              {!isNewSchoolMode ? (
                <button
                  type="button"
                  onClick={() => setIsNewSchoolMode(true)}
                  className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت آموزشگاه جدید</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsNewSchoolMode(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline cursor-pointer"
                >
                  انتخاب از لیست مدارس
                </button>
              )}
            </div>

            {!isNewSchoolMode ? (
              <select
                value={schoolId}
                onChange={(e) => handleSchoolChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs font-medium"
                required
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.grade})
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="نام آموزشگاه جدید..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مقطع تحصیلی <span className="text-rose-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as EducationalGrade)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm"
                required
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سمت سازمانی <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRoleOption}
                onChange={(e) => setSelectedRoleOption(e.target.value as StandardStaffRole)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm font-bold text-slate-800"
                required
              >
                {STANDARD_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedRoleOption === 'سایر' && (
            <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200">
              <label className="block text-xs font-bold text-amber-950 mb-1">
                عنوان دقیق سمت:
              </label>
              <input
                type="text"
                value={customRoleTitle}
                onChange={(e) => setCustomRoleTitle(e.target.value)}
                placeholder="مربی، مشاور، مراقب سلامت..."
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg outline-hidden text-xs font-bold"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">کد ملی (۱۰ رقمی)</label>
              <input
                type="text"
                maxLength={10}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="مثال: 1289456123"
                dir="ltr"
                className="w-full text-center font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">کد پرسنلی / استخدامی</label>
              <input
                type="text"
                value={personnelCode}
                onChange={(e) => setPersonnelCode(e.target.value)}
                placeholder="مثال: 201001"
                dir="ltr"
                className="w-full text-center font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سابقه خدمت (سال)</label>
              <input
                type="text"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="مثال: 15 یا 15 سال"
                className="w-full text-center font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">شماره تماس همکار</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0913..."
                dir="ltr"
                className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-sm"
              />
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
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{existingEmployee ? 'ذخیره تغییرات' : 'ثبت همکار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
