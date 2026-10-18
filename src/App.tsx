import React, { useState, useEffect, useCallback } from 'react';
import {
  AppDatabase,
  Employee,
  Program,
  School,
  EmployeeProgram,
  SystemSettings,
  SYSTEM_DESIGNER_NAME,
  SYSTEM_DESIGNER_WEBSITE,
  SYSTEM_DESIGNER_PHONE,
  SYSTEM_DESIGNER_PHONE_FA,
  SYSTEM_DEVELOPER_PROFILE,
} from './types';
import {
  loadDatabase,
  saveDatabase,
} from './utils/storage';
import { exportFullExcelReport } from './utils/excelExport';
import { exportFullHtmlReport } from './utils/htmlExport';
import { padZero, getCurrentJalaliDate } from './utils/jalali';

// Components
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EmployeeCartable } from './components/EmployeeCartable';
import { EmployeesManagement } from './components/EmployeesManagement';
import { ProgramsManagement } from './components/ProgramsManagement';
import { PerformanceReport } from './components/PerformanceReport';
import { ColleagueRanking } from './components/ColleagueRanking';
import { SchoolPerformanceReport } from './components/SchoolPerformanceReport';
import { ProgramPerformanceReport } from './components/ProgramPerformanceReport';
import { ExcelExportCenter } from './components/ExcelExportCenter';
import { ExcelBulkImport } from './components/ExcelBulkImport';
import { MultiSectionReportMerger } from './components/MultiSectionReportMerger';
import { BackupSettings } from './components/BackupSettings';
import { UserGuide } from './components/UserGuide';
import { IsfahanTileBorder } from './components/IsfahanMotifs';

// Modals
import { EmployeeModal } from './components/EmployeeModal';
import { ProgramModal } from './components/ProgramModal';
import { SchoolModal } from './components/SchoolModal';
import { ProgramAssignmentModal } from './components/ProgramAssignmentModal';

export default function App() {
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(() => {
    return db.employees[0] || null;
  });

  // Modal states
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignPreselectedEmpId, setAssignPreselectedEmpId] = useState<string | undefined>();
  const [assignPreselectedPrgId, setAssignPreselectedPrgId] = useState<string | undefined>();

  // Excel Bulk Import navigation target
  const [excelImportMode, setExcelImportMode] = useState<'employees' | 'tasks' | 'per_program' | 'programs'>('employees');
  const [excelImportProgramId, setExcelImportProgramId] = useState<string | undefined>();

  // Font Store (https://github.com/font-store) typography state
  const [selectedFont, setSelectedFont] = useState<string>(() => {
    try {
      return localStorage.getItem('app_preferred_font') || 'yekan';
    } catch {
      return 'yekan';
    }
  });

  useEffect(() => {
    const fontMap: Record<string, string> = {
      yekan: "'font-store-yekan', 'yekan', 'Vazirmatn', sans-serif",
      behdad: "'font-store-behdad', 'behdad', 'Vazirmatn', sans-serif",
      nika: "'font-store-nika', 'nika', 'Vazirmatn', sans-serif",
      shahab: "'font-store-shahab', 'shahab', 'Vazirmatn', sans-serif",
      vazir: "'Vazirmatn', 'font-store-yekan', sans-serif",
    };
    const fontVal = fontMap[selectedFont] || fontMap.yekan;
    document.documentElement.style.setProperty('--app-font', fontVal);
    document.body.style.fontFamily = fontVal;
    try {
      localStorage.setItem('app_preferred_font', selectedFont);
    } catch {
      // ignore storage error
    }
  }, [selectedFont]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  }, []);

  const updateDatabase = useCallback(
    (newDb: AppDatabase) => {
      setDb(newDb);
      saveDatabase(newDb);
      if (selectedEmployee) {
        const synced = newDb.employees.find((e) => e.id === selectedEmployee.id);
        setSelectedEmployee(synced || newDb.employees[0] || null);
      }
    },
    [selectedEmployee],
  );

  const handleQuickJump = useCallback(
    (query: string): boolean => {
      const clean = query.trim();
      if (!clean) return false;
      const padded = padZero(clean);
      const found = db.employees.find(
        (e) =>
          e.code === padded ||
          e.code === clean ||
          (e.nationalId && e.nationalId.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '')) ||
          (e.personnelCode && e.personnelCode.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '')) ||
          e.fullName.toLowerCase().includes(clean.toLowerCase())
      );
      if (found) {
        setSelectedEmployee(found);
        setCurrentTab('cartable');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }
      return false;
    },
    [db.employees],
  );

  const handleSelectEmployee = useCallback((emp: Employee) => {
    setSelectedEmployee(emp);
    setCurrentTab('cartable');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Employee CRUD
  const handleSaveEmployee = (
    empData: Omit<Employee, 'id' | 'createdAt'>,
    existingId?: string,
    newSchoolToCreate?: Omit<School, 'id'>,
  ) => {
    let updatedSchools = db.schools;
    let finalSchoolId = empData.schoolId;
    let finalSchoolName = empData.schoolName;

    if (newSchoolToCreate) {
      const createdSchool: School = {
        ...newSchoolToCreate,
        id: `sch_${Date.now()}`,
      };
      updatedSchools = [...db.schools, createdSchool];
      finalSchoolId = createdSchool.id;
      finalSchoolName = createdSchool.name;
    }

    const targetEmpData = {
      ...empData,
      schoolId: finalSchoolId,
      schoolName: finalSchoolName,
    };

    let updatedEmployees: Employee[];
    let targetEmp: Employee;

    if (existingId) {
      const existing = db.employees.find((e) => e.id === existingId);
      targetEmp = {
        ...targetEmpData,
        id: existingId,
        createdAt: existing?.createdAt || getCurrentJalaliDate(),
      };
      updatedEmployees = db.employees.map((e) => (e.id === existingId ? targetEmp : e));
      showToast(`مشخصات همکار «${empData.fullName}» با موفقیت ویرایش شد.`);
    } else {
      targetEmp = {
        ...targetEmpData,
        id: `emp_${Date.now()}`,
        createdAt: getCurrentJalaliDate(),
      };
      updatedEmployees = [targetEmp, ...db.employees];
      showToast(`همکار جدید «${empData.fullName}» با کد ${empData.code} افزوده شد.`);
    }

    updateDatabase({
      ...db,
      schools: updatedSchools,
      employees: updatedEmployees,
    });
    setSelectedEmployee(targetEmp);
  };

  const handleDeleteEmployee = (empId: string) => {
    const emp = db.employees.find((e) => e.id === empId);
    if (!emp) return;

    const updatedEmployees = db.employees.filter((e) => e.id !== empId);
    const updatedAssignments = db.employeePrograms.filter((ep) => ep.employeeId !== empId);

    updateDatabase({
      ...db,
      employees: updatedEmployees,
      employeePrograms: updatedAssignments,
    });

    if (selectedEmployee?.id === empId) {
      setSelectedEmployee(updatedEmployees[0] || null);
    }
    showToast(`همکار «${emp.fullName}» با موفقیت حذف شد.`);
  };

  // Program CRUD with immediate execution (confirmation handled in modal)
  const handleSaveProgram = (
    prgData: Omit<Program, 'id' | 'createdAt'>,
    existingId?: string,
  ) => {
    let updatedPrograms: Program[];

    if (existingId) {
      const existing = db.programs.find((p) => p.id === existingId);
      updatedPrograms = db.programs.map((p) =>
        p.id === existingId
          ? { ...prgData, id: existingId, createdAt: existing?.createdAt || getCurrentJalaliDate() }
          : p,
      );
      showToast(`طرح «${prgData.title}» (حوزه: ${prgData.section}) به‌روزرسانی شد.`);
    } else {
      const newPrg: Program = {
        ...prgData,
        id: `prg_${Date.now()}`,
        createdAt: getCurrentJalaliDate(),
      };
      updatedPrograms = [newPrg, ...db.programs];
      showToast(`طرح جدید «${prgData.title}» در حوزه «${prgData.section}» با ضریب ${prgData.coefficient} ثبت شد.`);
    }

    updateDatabase({
      ...db,
      programs: updatedPrograms,
    });
  };

  // Delete program handler without window.confirm (confirmation is done via in-app modal in ProgramsManagement)
  const handleDeleteProgram = (prgId: string) => {
    const prg = db.programs.find((p) => p.id === prgId);
    if (!prg) return;

    const updatedPrograms = db.programs.filter((p) => p.id !== prgId);
    const updatedAssignments = db.employeePrograms.filter((ep) => ep.programId !== prgId);

    updateDatabase({
      ...db,
      programs: updatedPrograms,
      employeePrograms: updatedAssignments,
    });
    showToast(`طرح «${prg.title}» با موفقیت از سیستم حذف گردید.`);
  };

  const handleToggleProgramActive = (prgId: string) => {
    const updatedPrograms = db.programs.map((p) =>
      p.id === prgId ? { ...p, isActive: !p.isActive } : p,
    );
    updateDatabase({
      ...db,
      programs: updatedPrograms,
    });
  };

  // School CRUD
  const handleSaveSchool = (schoolData: Omit<School, 'id'>, existingId?: string) => {
    let updatedSchools: School[];
    if (existingId) {
      updatedSchools = db.schools.map((s) =>
        s.id === existingId ? { ...schoolData, id: existingId } : s,
      );
      showToast(`اطلاعات آموزشگاه «${schoolData.name}» ویرایش شد.`);
    } else {
      const newSchool: School = { ...schoolData, id: `sch_${Date.now()}` };
      updatedSchools = [...db.schools, newSchool];
      showToast(`آموزشگاه «${schoolData.name}» ثبت شد.`);
    }

    updateDatabase({
      ...db,
      schools: updatedSchools,
    });
  };

  const handleDeleteSchool = (schoolId: string) => {
    const school = db.schools.find((s) => s.id === schoolId);
    if (!school) return;

    const updatedSchools = db.schools.filter((s) => s.id !== schoolId);
    const updatedEmployees = db.employees.map((e) =>
      e.schoolId === schoolId
        ? { ...e, schoolId: '', schoolName: 'نامشخص' }
        : e,
    );

    updateDatabase({
      ...db,
      schools: updatedSchools,
      employees: updatedEmployees,
    });
    showToast(`آموزشگاه «${school.name}» حذف گردید.`);
  };

  // Assignments
  const handleAssignPrograms = (programId: string, employeeIds: string[]) => {
    const newAssignments: EmployeeProgram[] = [];
    const now = getCurrentJalaliDate();

    for (const eId of employeeIds) {
      const emp = db.employees.find((e) => e.id === eId);
      const exists = db.employeePrograms.some(
        (ep) => ep.programId === programId && ep.employeeId === eId,
      );
      if (!exists) {
        newAssignments.push({
          id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          employeeId: eId,
          employeeCode: emp?.code || '',
          programId,
          status: 'not_done',
          isManualOverride: false,
          updatedAt: now,
        });
      }
    }

    if (newAssignments.length === 0) {
      showToast('تمامی همکاران انتخاب شده قبلاً به این برنامه تخصیص یافته بودند.');
      return;
    }

    updateDatabase({
      ...db,
      employeePrograms: [...db.employeePrograms, ...newAssignments],
    });
    showToast(`${newAssignments.length} همکار با موفقیت به این طرح تخصیص داده شدند.`);
  };

  const handleUpdateAssignment = (updated: Partial<EmployeeProgram> & { id: string }) => {
    const updatedAssignments = db.employeePrograms.map((ep) => {
      if (ep.id === updated.id) {
        return {
          ...ep,
          ...updated,
          updatedAt: new Date().toISOString(),
        };
      }
      return ep;
    });

    updateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });
    showToast('وضعیت اجرای برنامه با موفقیت به‌روزرسانی شد.');
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    const updatedAssignments = db.employeePrograms.filter((ep) => ep.id !== assignmentId);
    updateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });
    showToast(`برنامه از کارتابل همکار حذف گردید.`);
  };

  const handleUnassignProgramFromEmployee = (programId: string, employeeId: string) => {
    const targetAssignment = db.employeePrograms.find(
      (ep) => ep.programId === programId && ep.employeeId === employeeId,
    );
    if (!targetAssignment) return;

    const updatedAssignments = db.employeePrograms.filter((ep) => ep.id !== targetAssignment.id);
    updateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });
    showToast(`برنامه برای این همکار لغو و حذف گردید.`);
  };

  const handleBatchUpdateAssignments = (
    updates: (Partial<EmployeeProgram> & { id: string })[],
  ) => {
    const updateMap = new Map(updates.map((u) => [u.id, u]));
    const now = new Date().toISOString();

    const updatedAssignments = db.employeePrograms.map((ep) => {
      const up = updateMap.get(ep.id);
      if (up) {
        const execDate = up.executionDate || up.actualDate || ep.executionDate || ep.actualDate;
        const subDate = up.submissionDate || up.docSubmissionDate || ep.submissionDate || ep.docSubmissionDate || execDate;
        return {
          ...ep,
          ...up,
          actualDate: execDate,
          executionDate: execDate,
          submissionDate: subDate,
          docSubmissionDate: subDate,
          updatedAt: now,
        };
      }
      return ep;
    });

    updateDatabase({
      ...db,
      employeePrograms: updatedAssignments,
    });
    showToast(`وضعیت ${updates.length} برنامه به صورت یکجا ذخیره شد.`);
  };

  const handleUpdateSettings = (newSettings: SystemSettings) => {
    updateDatabase({
      ...db,
      settings: newSettings,
    });
    showToast('تنظیمات سربرگ اداری با موفقیت ذخیره شد.');
  };

  const handleOpenAssignModal = (preEmpId?: string, prePrgId?: string) => {
    setAssignPreselectedEmpId(preEmpId);
    setAssignPreselectedPrgId(prePrgId);
    setIsAssignModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2.5 animate-fade-in no-print">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        settings={db.settings}
        selectedEmployee={selectedEmployee}
        onQuickJump={handleQuickJump}
        onOpenAssignModal={() => handleOpenAssignModal()}
        db={db}
        selectedFont={selectedFont}
        onSelectFont={setSelectedFont}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Tab 1: Dashboard */}
        {currentTab === 'dashboard' && (
          <Dashboard
            employees={db.employees}
            programs={db.programs}
            schools={db.schools}
            employeePrograms={db.employeePrograms}
            settings={db.settings}
            onQuickJump={handleQuickJump}
            onNavigate={setCurrentTab}
            onSelectEmployee={handleSelectEmployee}
            onOpenNewEmployeeModal={() => {
              setEditingEmployee(null);
              setIsEmployeeModalOpen(true);
            }}
            onOpenNewProgramModal={() => {
              setEditingProgram(null);
              setIsProgramModalOpen(true);
            }}
            onOpenAssignModal={() => handleOpenAssignModal()}
            onExportExcel={() => exportFullExcelReport(db)}
            onExportHtml={() => exportFullHtmlReport(db)}
          />
        )}

        {/* Tab 2: Colleague Cartable */}
        {currentTab === 'cartable' && (
          selectedEmployee ? (
            <EmployeeCartable
              employee={selectedEmployee}
              allEmployees={db.employees}
              programs={db.programs}
              employeePrograms={db.employeePrograms}
              onSelectEmployee={setSelectedEmployee}
              onUpdateAssignment={handleUpdateAssignment}
              onDeleteAssignment={handleDeleteAssignment}
              onSaveBatch={handleBatchUpdateAssignments}
              onOpenAssignModal={(empId) => handleOpenAssignModal(empId)}
              onQuickCodeSearch={handleQuickJump}
              onExportHtml={() => exportFullHtmlReport(db)}
            />
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-xs">
              <h3 className="text-lg font-bold text-slate-800 mb-2">کارتابلی انتخاب نشده است</h3>
              <p className="text-xs text-slate-500 mb-6">
                لطفاً کد ۲ رقمی همکار را در کادر جستجوی بالا وارد کنید.
              </p>
              <button
                onClick={() => setCurrentTab('employees')}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                مشاهده لیست همکاران
              </button>
            </div>
          )
        )}

        {/* Tab 3: Employees Management */}
        {currentTab === 'employees' && (
          <EmployeesManagement
            employees={db.employees}
            schools={db.schools}
            db={db}
            onUpdateDatabase={updateDatabase}
            onSelectEmployee={handleSelectEmployee}
            onOpenNewModal={() => {
              setEditingEmployee(null);
              setIsEmployeeModalOpen(true);
            }}
            onEditEmployee={(emp) => {
              setEditingEmployee(emp);
              setIsEmployeeModalOpen(true);
            }}
            onDeleteEmployee={handleDeleteEmployee}
            onNavigateToExcelImport={() => setCurrentTab('excel_import')}
          />
        )}

        {/* Tab 4: Programs Management */}
        {currentTab === 'programs' && (
          <ProgramsManagement
            programs={db.programs}
            onOpenNewProgramModal={() => {
              setEditingProgram(null);
              setIsProgramModalOpen(true);
            }}
            onEditProgram={(prg) => {
              setEditingProgram(prg);
              setIsProgramModalOpen(true);
            }}
            onDeleteProgram={handleDeleteProgram}
            onOpenAssignModal={(prgId) => handleOpenAssignModal(undefined, prgId)}
            onToggleActive={handleToggleProgramActive}
            onNavigateToExcelImport={() => {
              setExcelImportMode('programs');
              setCurrentTab('excel_import');
            }}
            onNavigateToPerProgramBulk={(prgId) => {
              setExcelImportMode('per_program');
              setExcelImportProgramId(prgId);
              setCurrentTab('excel_import');
            }}
          />
        )}

        {/* Tab 5: Colleague Ranking */}
        {currentTab === 'ranking' && (
          <ColleagueRanking
            employees={db.employees}
            employeePrograms={db.employeePrograms}
            programs={db.programs}
            schools={db.schools}
            onSelectEmployee={handleSelectEmployee}
            onExportHtml={() => exportFullHtmlReport(db)}
          />
        )}

        {/* Tab 6: Performance Report (All Staff) */}
        {currentTab === 'performance_report' && (
          <PerformanceReport
            employees={db.employees}
            employeePrograms={db.employeePrograms}
            programs={db.programs}
            schools={db.schools}
            onSelectEmployee={handleSelectEmployee}
            onExportExcel={() => exportFullExcelReport(db)}
          />
        )}

        {/* Tab 7: School Performance Report */}
        {currentTab === 'schools_report' && (
          <SchoolPerformanceReport
            schools={db.schools}
            employees={db.employees}
            employeePrograms={db.employeePrograms}
            programs={db.programs}
            onOpenNewSchoolModal={() => {
              setEditingSchool(null);
              setIsSchoolModalOpen(true);
            }}
            onEditSchool={(school) => {
              setEditingSchool(school);
              setIsSchoolModalOpen(true);
            }}
            onDeleteSchool={handleDeleteSchool}
            onExportExcel={() => exportFullExcelReport(db)}
            onFilterBySchool={() => {
              setCurrentTab('performance_report');
            }}
          />
        )}

        {/* Tab 8: Program Performance Report */}
        {currentTab === 'programs_report' && (
          <ProgramPerformanceReport
            programs={db.programs}
            employees={db.employees}
            employeePrograms={db.employeePrograms}
            onOpenNewProgramModal={() => {
              setEditingProgram(null);
              setIsProgramModalOpen(true);
            }}
            onOpenAssignModal={(prgId) => handleOpenAssignModal(undefined, prgId)}
            onSelectEmployee={handleSelectEmployee}
            onExportExcel={() => exportFullExcelReport(db)}
            onUpdateStatus={handleUpdateAssignment}
          />
        )}

        {/* Tab 8.5: Excel Bulk Import */}
        {currentTab === 'excel_import' && (
          <ExcelBulkImport
            db={db}
            onUpdateDatabase={updateDatabase}
            onNavigateToTab={setCurrentTab}
            initialMode={excelImportMode}
            initialProgramId={excelImportProgramId}
          />
        )}

        {/* Tab 8.8: Multi-Section Reports Merger & Consolidated Final Report */}
        {currentTab === 'section_merger' && (
          <MultiSectionReportMerger
            db={db}
            onUpdateDatabase={updateDatabase}
            onNavigate={setCurrentTab}
          />
        )}

        {/* Tab 9: Excel and HTML Export Center */}
        {currentTab === 'excel_export' && (
          <ExcelExportCenter db={db} onNavigate={setCurrentTab} />
        )}

        {/* Tab 10: Backup & Settings */}
        {currentTab === 'backup_settings' && (
          <BackupSettings
            db={db}
            onUpdateDatabase={updateDatabase}
            onUpdateSettings={handleUpdateSettings}
            selectedFont={selectedFont}
            onSelectFont={setSelectedFont}
          />
        )}

        {/* Tab 11: User Guide */}
        {currentTab === 'guide' && <UserGuide />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 text-center text-xs text-slate-500 no-print overflow-hidden">
        <IsfahanTileBorder className="w-full h-1.5" />
        <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
            <span className="font-bold text-slate-700">
              {db.settings.officeTitle} — {db.settings.departmentTitle}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-500 text-[11px]">
            <span>طراح و برنامه‌نویس: <strong className="text-slate-800">{SYSTEM_DESIGNER_NAME}</strong></span>
            <span className="text-slate-300">•</span>
            <a
              href={SYSTEM_DEVELOPER_PROFILE.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800 font-bold transition-colors"
            >
              وب‌سایت: {SYSTEM_DESIGNER_WEBSITE}
            </a>
            <span className="text-slate-300">•</span>
            <a
              href={`tel:${SYSTEM_DESIGNER_PHONE}`}
              className="text-emerald-700 hover:text-emerald-900 font-bold font-mono transition-colors"
            >
              تماس: {SYSTEM_DESIGNER_PHONE_FA}
            </a>
          </div>
        </div>
      </footer>

      {/* Modals Container */}
      {isEmployeeModalOpen && (
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          onClose={() => {
            setIsEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={handleSaveEmployee}
          existingEmployee={editingEmployee}
          schools={db.schools}
          existingEmployees={db.employees}
        />
      )}

      {isProgramModalOpen && (
        <ProgramModal
          isOpen={isProgramModalOpen}
          onClose={() => {
            setIsProgramModalOpen(false);
            setEditingProgram(null);
          }}
          onSave={handleSaveProgram}
          existingProgram={editingProgram}
          existingPrograms={db.programs}
        />
      )}

      {isSchoolModalOpen && (
        <SchoolModal
          isOpen={isSchoolModalOpen}
          onClose={() => {
            setIsSchoolModalOpen(false);
            setEditingSchool(null);
          }}
          onSave={handleSaveSchool}
          existingSchool={editingSchool}
          existingSchools={db.schools}
        />
      )}

      {isAssignModalOpen && (
        <ProgramAssignmentModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          programs={db.programs}
          employees={db.employees}
          existingAssignments={db.employeePrograms}
          onAssign={handleAssignPrograms}
          onUnassign={handleUnassignProgramFromEmployee}
          preselectedProgramId={assignPreselectedPrgId}
          preselectedEmployeeId={assignPreselectedEmpId}
        />
      )}
    </div>
  );
}
