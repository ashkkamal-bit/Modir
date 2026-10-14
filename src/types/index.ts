export const PROGRAM_SECTIONS = [
  'پرورشی',
  'آموزش ابتدایی',
  'آموزش متوسطه اول',
  'آموزش متوسطه دوم',
  'تربیت بدنی',
] as const;

export type ProgramSection = (typeof PROGRAM_SECTIONS)[number];

export type EducationalGrade =
  | 'ابتدایی دوره اول'
  | 'ابتدایی دوره دوم'
  | 'متوسطه اول'
  | 'متوسطه دوم نظری'
  | 'هنرستان فنی و حرفه‌ای و کاردانش'
  | 'مجتمع آموزشی و پرورشی';

export const STANDARD_ROLES = [
  'مدیر',
  'معاون آموزشی',
  'معاون پرورشی',
  'دبیر',
  'آموزگار',
  'معاون اجرایی',
  'سایر',
] as const;

export type StandardStaffRole = (typeof STANDARD_ROLES)[number];

export type StaffRole =
  | StandardStaffRole
  | 'معاون پرورشی و تربیت بدنی'
  | 'مربی امور تربیتی'
  | 'مشاور مدرسه'
  | 'مراقب سلامت'
  | 'رابط فرهنگی و اقامه نماز'
  | 'مدیر / سرپرست پرورشی'
  | string;

export type ExecutionStatus = 'done' | 'late' | 'not_done';

export interface Employee {
  id: string;
  code: string; // 2 digits: "01", "02", ... "99" (کد اختصاصی / شناسه سریع)
  personnelCode?: string; // کد پرسنلی یا شناسه استخدامی
  nationalId?: string; // کد ملی (۱۰ رقمی)
  fullName: string;
  schoolId: string;
  schoolName: string;
  grade: EducationalGrade;
  role: StaffRole;
  customRoleTitle?: string; // عنوان دقیق در صورت انتخاب گزینه «سایر»
  experienceYears?: number | string; // سابقه خدمت به سال
  phone: string;
  notes?: string;
  createdAt: string;
  isActive?: boolean;
}

export interface School {
  id: string;
  name: string;
  code: string;
  grade: EducationalGrade;
  gender: 'دخترانه' | 'پسرانه' | 'مختلط';
  principalName?: string;
  phone?: string;
  notes?: string;
}

export type DocumentationPlatform = 'ایتا' | 'شاد' | 'اتوماسیون' | 'سایر';

export type ProgramScope = 'همگانی' | 'اختصاصی';

export type ProgramCoefficient = 1 | 2 | 3;

export type AppFont = 'vazir' | 'mitra' | 'titr' | 'nastaliq';

export interface Program {
  id: string;
  code: string; // e.g. "PRG-01"
  title: string;
  section: ProgramSection; // یکی از ۵ قسمت اصلی: پرورشی، آموزش ابتدایی، آموزش متوسطه اول، آموزش متوسطه دوم، تربیت بدنی
  axis?: string; // محور فرعی یا موضوعی اختیاری
  scope: ProgramScope; // 'همگانی' (مؤثر در امتیاز با ضریب) | 'اختصاصی' (طرح‌های موردی)
  coefficient: ProgramCoefficient; // ضریب امتیاز طرح از ۱ تا ۳: ۱ (عادی)، ۲ (مهم/متوسط)، ۳ (بسیار مهم/ویژه)
  startDate: string; // Jalali: e.g. "1403/07/01"
  deadline: string; // Jalali: e.g. "1403/09/30"
  executionDate?: string; // تاریخ اجرای طرح
  submissionDate?: string; // تاریخ مهلت ارسال مستندات
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeProgram {
  id: string;
  employeeId: string;
  employeeCode: string;
  programId: string;
  status: ExecutionStatus;
  isManualOverride: boolean;
  actualDate?: string; // Jalali: e.g. "1403/09/25" (تاریخ اجرای طرح)
  executionDate?: string; // تاریخ اجرای طرح (synonym for actualDate)
  submissionDate?: string; // Jalali: e.g. "1403/09/28" (تاریخ ارسال مستندات)
  docSubmissionDate?: string; // synonym
  submissionPlatform?: DocumentationPlatform; // محل ارسال مستندات: ایتا | شاد | اتوماسیون | سایر
  documentationPlatform?: DocumentationPlatform; // synonym
  notes?: string;
  documentationNotes?: string;
  updatedAt: string;
}

export interface SystemSettings {
  officeTitle: string; // نام اداره آموزش و پرورش (مثلاً: اداره آموزش و پرورش ناحیه ۶ اصفهان)
  departmentTitle: string; // عنوان کارشناسی
  officerName: string; // نام کارشناس مسئول
  academicYear: string; // سال تحصیلی مثلاً ۱۴۰۳-۱۴۰۴
  lastBackupDate?: string;
  developerName?: string; // برنامه‌نویس سیستم
  selectedFont?: AppFont; // فونت قالب برنامه: وزیری | میترا | تیتر | نستعلیق
}

export interface EmployeeStats {
  total: number;
  done: number;
  late: number;
  notDone: number;
  progressPercent: number; // (done + late) / total * 100
  onTimePercent: number; // done / total * 100
  // شاخص‌های وزنی بر اساس ضرایب ۱، ۲ و ۳
  totalWeightedPossible: number; // امتیاز کل قابل کسب (مجموع ضرایب ضربدر ۱۰۰)
  earnedWeightedScore: number; // امتیاز وزنی کسب‌شده با ضرایب ۱ تا ۳ (انجام به‌موقع: ۱۰۰ * ضریب، دیر: ۶۰ * ضریب)
  weightedProgressPercent: number; // درصد عملکرد وزنی: (کسب‌شده ÷ کل قابل کسب) × ۱۰۰
  totalCoefficients: number; // مجموع ضرایب برنامه‌های همگانی مشمول
}

export interface ScopeDetailedStats {
  total: number;
  done: number;
  late: number;
  notDone: number;
  progressPercent: number;
  onTimePercent: number;
  earnedWeightedScore: number;
}

export interface SchoolStats {
  staffCount: number;
  totalPrograms: number;
  done: number;
  late: number;
  notDone: number;
  progressPercent: number;
  onTimePercent: number;
  // شاخص‌های وزنی مدرسه بر اساس ضرایب ۱ تا ۳
  totalWeightedPossible: number;
  earnedWeightedScore: number;
  weightedProgressPercent: number;
  averageStaffScore: number; // میانگین امتیاز هر نیروی مدرسه
}

export interface AppDatabase {
  employees: Employee[];
  schools: School[];
  programs: Program[];
  employeePrograms: EmployeeProgram[];
  settings: SystemSettings;
  version: number;
}

// انواع ورود گروهی اطلاعات از اکسل (Excel Bulk Import)
export type ExcelImportMode = 'completed_only' | 'full_scope';

export interface ExcelImportRow {
  rowNumber: number;
  schoolCode?: string;
  schoolName?: string;
  personnelCode?: string;
  employeeCode?: string;
  fullName?: string;
  role?: string;
  programTitle?: string;
  programCode?: string;
  statusText?: string;
  executionDate?: string;
  notes?: string;
  matchedEmployeeId?: string;
  matchedEmployeeName?: string;
  matchedProgramId?: string;
  matchedProgramTitle?: string;
  matchStatus: 'matched' | 'unmatched_person' | 'unmatched_program' | 'duplicate' | 'ambiguous';
  resolvedStatus?: ExecutionStatus;
  errorMessage?: string;
}
