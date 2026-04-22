
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { 
  User, 
  UserRole, 
  SalaryConfig, 
  Shift,
  Attendance, 
  AdvancePayment, 
  Payroll, 
  EmployeeSalaryInfo,
  OTStatus,
  AttendanceFlag,
  PayrollStatus,
  EmployeeFeedback,
  PayrollLock
} from '../types';
import { 
  subscribeToSalaryConfig, 
  apiUpdateSalaryConfig,
  subscribeToAttendance,
  apiAddAttendance,
  apiUpdateAttendance,
  subscribeToAdvancePayments,
  apiAddAdvancePayment,
  apiUpdateAdvancePayment,
  apiDeleteAdvancePayment,
  subscribeToPayrolls,
  apiUpdatePayroll,
  subscribeToEmployeeSalaryInfo,
  apiUpdateEmployeeSalaryInfo,
  subscribeToUsers,
  apiDeleteAttendanceByMonth,
  apiDeletePayrollsByMonth,
  calculateAttendanceStats,
  subscribeToPayrollLocks,
  apiUpdatePayrollLock
} from '../services/storageService';
import { 
  IconSettings, 
  IconCalendar, 
  IconDollarSign, 
  IconPlus, 
  IconTrash, 
  IconCheck, 
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconSave,
  IconWallet,
  IconDownload,
  IconCamera,
  IconImage,
  IconX,
  IconThumbsUp,
  IconThumbsDown,
  IconMessageSquare,
  IconAlert,
  IconLock,
  IconUnlock,
  IconUpload,
  IconPrinter
} from './Icons';

const CurrencyInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}> = ({ value, onChange, className, placeholder, disabled }) => {
  const [displayValue, setDisplayValue] = useState(value.toLocaleString('vi-VN'));

  useEffect(() => {
    setDisplayValue(value.toLocaleString('vi-VN'));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawValue = e.target.value.replace(/\D/g, '');
    const numValue = parseInt(rawValue) || 0;
    onChange(numValue);
    setDisplayValue(numValue.toLocaleString('vi-VN'));
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

const Payslip = ({ data, month, companyName }: { data: any, month: string, companyName: string }) => {
  const formatCurrency = (val: number) => val.toLocaleString('vi-VN') + ' đ';
  const payroll = data.payroll || {};
  
  const [year, m] = month.split('-');
  const formattedMonth = `${m}/${year}`;

  return (
    <div className="p-4 sm:p-6 bg-white text-black w-full max-w-2xl mx-auto border border-gray-200 shadow-sm mb-4 page-break rounded-xl print:shadow-none print:border-none print:rounded-none print:m-0 print:p-0">
      <div className="text-center mb-4 border-b-2 border-gray-800 pb-4">
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-gray-900">{companyName}</h1>
        <h2 className="text-lg sm:text-xl font-bold mt-2 text-gray-800">PHIẾU BÁO LƯƠNG</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Tháng {formattedMonth}</p>
      </div>
      
      <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-20">Họ và tên:</span>
          <span className="font-bold text-gray-900">{data.employee.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-20">Chức vụ:</span>
          <span className="font-medium text-gray-900">
            {data.employee.role === UserRole.DIRECTOR ? 'Giám đốc' : 
             data.employee.role === UserRole.MANAGER ? 'Quản lý' : 
             data.employee.role === UserRole.WORKER ? 'Công nhân' : 'Nhân viên'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-20">Bộ phận:</span>
          <span className="font-medium text-gray-900">{data.employee.department || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-20">Ngày in:</span>
          <span className="font-medium text-gray-900">{new Date().toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-gray-800 mb-2 uppercase tracking-wide text-[10px] border-b pb-1">Chi tiết thu nhập</h3>
        <table className="w-full text-xs sm:text-sm">
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="py-1.5 text-gray-600">Lương cơ bản (tháng)</td>
              <td className="py-1.5 text-right font-medium">{formatCurrency(data.info?.monthlySalary || 0)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Lương ngày chuẩn</td>
              <td className="py-1.5 text-right font-medium">{formatCurrency(data.dailySalary || 0)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Số ngày công thực tế</td>
              <td className="py-1.5 text-right font-medium">{data.totalNC} ngày</td>
            </tr>
            <tr className="bg-gray-50/50">
              <td className="py-1.5 text-gray-900 font-semibold">Tổng lương ngày công</td>
              <td className="py-1.5 text-right font-bold text-gray-900">{formatCurrency(data.salaryNC)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Số giờ tăng ca</td>
              <td className="py-1.5 text-right font-medium">{data.totalTC} giờ</td>
            </tr>
            <tr className="bg-gray-50/50">
              <td className="py-1.5 text-gray-900 font-semibold">Tổng lương tăng ca</td>
              <td className="py-1.5 text-right font-bold text-gray-900">{formatCurrency(data.salaryTC)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Phụ cấp khác</td>
              <td className="py-1.5 text-right font-medium">{formatCurrency(payroll.allowance || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-gray-800 mb-2 uppercase tracking-wide text-[10px] border-b pb-1">Khấu trừ & Điều chỉnh</h3>
        <table className="w-full text-xs sm:text-sm">
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="py-1.5 text-gray-600">Tạm ứng trong tháng</td>
              <td className="py-1.5 text-right font-medium text-red-600">-{formatCurrency(data.totalAdvance)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Đã thanh toán trước</td>
              <td className="py-1.5 text-right font-medium text-red-600">-{formatCurrency(payroll.paidAmount || 0)}</td>
            </tr>
            <tr>
              <td className="py-1.5 text-gray-600">Dư nợ/có tháng trước</td>
              <td className="py-1.5 text-right font-medium text-blue-600">{formatCurrency(payroll.previousBalance || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-blue-600 p-3 rounded-lg flex justify-between items-center mb-6">
        <span className="text-sm font-bold text-white uppercase">Thực lĩnh kỳ này</span>
        <span className="text-xl font-black text-white">{formatCurrency(data.finalSalary)}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 text-center">
        <div>
          <p className="font-bold text-gray-800 text-xs">Người lập phiếu</p>
          <p className="text-[10px] text-gray-400 mt-1 italic">(Ký, ghi rõ họ tên)</p>
          <div className="h-12"></div>
        </div>
        <div>
          <p className="font-bold text-gray-800 text-xs">Người nhận</p>
          <p className="text-[10px] text-gray-400 mt-1 italic">(Ký, ghi rõ họ tên)</p>
          <div className="h-12"></div>
        </div>
      </div>
      
      <div className="mt-6 pt-2 border-t border-gray-100 text-center text-[9px] text-gray-400">
        Phiếu lương tự động từ hệ thống BizTask. Mọi thắc mắc vui lòng liên hệ kế toán.
      </div>
    </div>
  );
};

interface SalaryTabProps {
  currentUser: User;
}

const SalaryTab: React.FC<SalaryTabProps> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'advance' | 'payroll' | 'config'>('attendance');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [payrollDepartmentFilter, setPayrollDepartmentFilter] = useState('ALL');
  
  const [config, setConfig] = useState<SalaryConfig | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [salaryInfos, setSalaryInfos] = useState<EmployeeSalaryInfo[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payrollLock, setPayrollLock] = useState<PayrollLock | null>(null);

  // Attendance Detail Modal
  const [viewingAttendance, setViewingAttendance] = useState<Attendance | null>(null);
  const [showAttendanceDetail, setShowAttendanceDetail] = useState(false);
  const [manualCheckInTime, setManualCheckInTime] = useState('');
  const [manualCheckOutTime, setManualCheckOutTime] = useState('');

  const [viewingPayslip, setViewingPayslip] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'none' | 'single' | 'all'>('none');

  const isDirector = currentUser.role === UserRole.DIRECTOR;
  const isManager = currentUser.role === UserRole.MANAGER;
  const hasManagementPrivileges = isDirector || isManager;

  useEffect(() => {
    const unsubConfig = subscribeToSalaryConfig(currentUser.companyId, setConfig);
    const unsubUsers = subscribeToUsers(currentUser.companyId, setUsers);
    const unsubSalaryInfo = subscribeToEmployeeSalaryInfo(currentUser.companyId, setSalaryInfos);
    
    return () => {
      unsubConfig();
      unsubUsers();
      unsubSalaryInfo();
    };
  }, [currentUser.companyId]);

  useEffect(() => {
    const unsubAttendance = subscribeToAttendance(currentUser.companyId, selectedMonth, setAttendances);
    const unsubAdvances = subscribeToAdvancePayments(currentUser.companyId, selectedMonth, setAdvances);
    const unsubPayrolls = subscribeToPayrolls(currentUser.companyId, selectedMonth, setPayrolls);
    const unsubLock = subscribeToPayrollLocks(currentUser.companyId, selectedMonth, setPayrollLock);

    return () => {
      unsubAttendance();
      unsubAdvances();
      unsubPayrolls();
      unsubLock();
    };
  }, [currentUser.companyId, selectedMonth]);

  const isLocked = payrollLock?.isLocked || false;

  const employees = useMemo(() => {
    if (currentUser.role === UserRole.EMPLOYEE) {
      return users.filter(u => u.id === currentUser.id);
    }
    return users.filter(u => u.role !== UserRole.DIRECTOR);
  }, [users, currentUser.role, currentUser.id]);

  // --- Attendance Logic ---
  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  const attendanceGrid = useMemo(() => {
    const grid: Record<string, Record<string, Attendance>> = {};
    employees.forEach(emp => {
      grid[emp.id] = {};
      attendances.filter(a => a.employeeId === emp.id).forEach(a => {
        grid[emp.id][a.date] = a;
      });
    });
    return grid;
  }, [employees, attendances]);

  const handleUpdateAttendance = async (empId: string, day: number, field: 'nc' | 'tc', value: number) => {
    if (isLocked) {
      alert("Bảng lương tháng này đã bị chốt, không thể chỉnh sửa.");
      return;
    }
    const date = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
    const existing = attendanceGrid[empId]?.[date];
    
    if (existing) {
      // Manual entry overrides calculation
      await apiUpdateAttendance({ ...existing, [field]: value });
    } else {
      const newAtt: Attendance = {
        id: Math.random().toString(36).substr(2, 9),
        companyId: currentUser.companyId,
        employeeId: empId,
        date,
        nc: field === 'nc' ? value : 0,
        tc: field === 'tc' ? value : 0,
        otStatus: OTStatus.NONE,
        otHours: 0,
        flag: AttendanceFlag.NORMAL
      };
      await apiAddAttendance(newAtt);
    }
  };

  const handleApproveOT = async (att: Attendance) => {
    if (!hasManagementPrivileges || isLocked) return;
    const { nc, tc, otStatus, otHours, flag } = calculateAttendanceStats({ ...att, otStatus: OTStatus.APPROVED }, config);
    await apiUpdateAttendance({ ...att, otStatus: OTStatus.APPROVED, nc, tc, otHours, flag });
    if (viewingAttendance?.id === att.id) {
      setViewingAttendance({ ...att, otStatus: OTStatus.APPROVED, nc, tc, otHours, flag });
    }
  };

  const handleRejectOT = async (att: Attendance) => {
    if (!hasManagementPrivileges || isLocked) return;
    const { nc, tc, otStatus, otHours, flag } = calculateAttendanceStats({ ...att, otStatus: OTStatus.REJECTED }, config);
    await apiUpdateAttendance({ ...att, otStatus: OTStatus.REJECTED, nc, tc, otHours, flag });
    if (viewingAttendance?.id === att.id) {
      setViewingAttendance({ ...att, otStatus: OTStatus.REJECTED, nc, tc, otHours, flag });
    }
  };

  const handleBatchApproveOT = async () => {
    if (!hasManagementPrivileges || isLocked) return;
    const pendingOT = attendances.filter(a => a.otStatus === OTStatus.PENDING);
    if (pendingOT.length === 0) {
      alert("Không có bản ghi tăng ca nào cần duyệt.");
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn duyệt TOÀN BỘ ${pendingOT.length} bản ghi tăng ca đang chờ?`)) {
      return;
    }

    try {
      for (const att of pendingOT) {
        const { nc, tc, otStatus, otHours, flag } = calculateAttendanceStats({ ...att, otStatus: OTStatus.APPROVED }, config);
        await apiUpdateAttendance({ ...att, otStatus: OTStatus.APPROVED, nc, tc, otHours, flag });
      }
      alert("Đã duyệt toàn bộ tăng ca thành công!");
    } catch (error) {
      console.error("Error batch approving OT:", error);
      alert("Có lỗi xảy ra khi duyệt hàng loạt.");
    }
  };

  const handleDeleteAllAttendance = async () => {
    if (!isDirector || isLocked) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu chấm công của tháng ${selectedMonth}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      await apiDeleteAttendanceByMonth(currentUser.companyId, selectedMonth);
      await apiDeletePayrollsByMonth(currentUser.companyId, selectedMonth);
      alert("Đã xóa toàn bộ dữ liệu chấm công và bảng lương của tháng.");
    } catch (error) {
      console.error("Error deleting attendance:", error);
      alert("Lỗi khi xóa dữ liệu.");
    }
  };

  // --- Advance Payment Logic ---
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvancePayment | null>(null);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    employeeId: '',
    amount: 0,
    note: '',
    date: `${selectedMonth}-${new Date().getDate().toString().padStart(2, '0')}`
  });

  useEffect(() => {
    setNewAdvance(prev => ({
      ...prev,
      date: `${selectedMonth}-${new Date().getDate().toString().padStart(2, '0')}`
    }));
  }, [selectedMonth]);

  const handleAddAdvance = async () => {
    if (isLocked) {
      alert("Bảng lương tháng này đã bị chốt, không thể thêm tạm ứng.");
      return;
    }
    if (!newAdvance.employeeId || newAdvance.amount <= 0) {
      alert('Vui lòng chọn nhân viên và nhập số tiền hợp lệ.');
      return;
    }
    try {
      // Ensure date is in YYYY-MM-DD format
      const recordDate = newAdvance.date.includes('T') ? newAdvance.date.split('T')[0] : newAdvance.date;
      
      await apiAddAdvancePayment({
        id: Math.random().toString(36).substr(2, 9),
        companyId: currentUser.companyId,
        ...newAdvance,
        date: recordDate,
        createdAt: new Date().toISOString()
      });
      setShowAddAdvance(false);
      setNewAdvance({ 
        employeeId: '', 
        amount: 0, 
        note: '', 
        date: `${selectedMonth}-${new Date().getDate().toString().padStart(2, '0')}` 
      });
    } catch (error) {
      console.error("Error adding advance:", error);
      alert("Lỗi khi lưu tạm ứng. Vui lòng thử lại.");
    }
  };

  const handleUpdateAdvance = async () => {
    if (isLocked) {
      alert("Bảng lương tháng này đã bị chốt, không thể sửa tạm ứng.");
      return;
    }
    if (!editingAdvance || !editingAdvance.employeeId || editingAdvance.amount <= 0) return;
    try {
      const recordDate = editingAdvance.date.includes('T') ? editingAdvance.date.split('T')[0] : editingAdvance.date;
      await apiUpdateAdvancePayment({
        ...editingAdvance,
        date: recordDate
      });
      setEditingAdvance(null);
    } catch (error) {
      console.error("Error updating advance:", error);
      alert("Lỗi khi cập nhật tạm ứng.");
    }
  };

  const filteredAdvances = useMemo(() => {
    if (hasManagementPrivileges) return advances;
    return advances.filter(a => a.employeeId === currentUser.id);
  }, [advances, hasManagementPrivileges, currentUser.id]);

  // --- Payroll Logic ---
  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const info = salaryInfos.find(s => s.id === emp.id);
      const empAttendances = attendances.filter(a => a.employeeId === emp.id);
      
      const totalNCHours = empAttendances.reduce((sum, a) => sum + (a.nc || 0), 0);
      const totalTCHours = empAttendances.reduce((sum, a) => sum + (a.tc || 0), 0);
      const totalAdvance = advances.filter(a => a.employeeId === emp.id).reduce((sum, a) => sum + a.amount, 0);
      const payroll = payrolls.find(p => p.employeeId === emp.id);

      const baseSalary = info?.monthlySalary || 0;
      const workingDays = config?.workingDaysInMonth || daysInMonth; 
      const workingHours = config?.workingHoursPerDay || 8;
      const otRate = config?.overtimeRate || 1.5;

      const dailySalary = info?.dailySalary || (baseSalary / workingDays);
      
      // New Formulas:
      // Tổng NC = Tổng số giờ làm việc / (số giờ làm việc / ngày)
      // Tổng TC = (Tổng số giờ tăng ca / (số giờ làm việc / ngày)) * hệ số tăng ca
      const totalNC = Math.round((totalNCHours / workingHours) * 100) / 100;
      const totalTC = Math.round((totalTCHours / workingHours * otRate) * 100) / 100;
      
      const salaryNC = dailySalary * totalNC;
      const salaryTC = dailySalary * totalTC;
      const totalSalary = salaryNC + salaryTC;
      
      const allowance = payroll?.allowance || 0;
      const previousBalance = payroll?.previousBalance || 0;
      const paidAmount = payroll?.paidAmount || 0;
      
      const finalSalary = totalSalary + allowance - totalAdvance - paidAmount + previousBalance;

      return {
        employee: emp,
        info,
        totalNC,
        totalTC,
        dailySalary,
        salaryNC,
        salaryTC,
        totalSalary,
        totalAdvance,
        payroll,
        finalSalary
      };
    });
  }, [employees, salaryInfos, attendances, advances, payrolls, config, daysInMonth]);

  const filteredEmployees = useMemo(() => {
    let result = [...employees];
    if (!hasManagementPrivileges) {
      result = result.filter(e => e.id === currentUser.id);
    }
    return result.sort((a, b) => {
      const deptA = a.department || '';
      const deptB = b.department || '';
      return deptA.localeCompare(deptB);
    });
  }, [employees, hasManagementPrivileges, currentUser.id]);

  const filteredPayrollData = useMemo(() => {
    let result = payrollData;
    if (!hasManagementPrivileges) {
      result = payrollData.filter(d => d.employee.id === currentUser.id);
    }
    if (payrollDepartmentFilter !== 'ALL') {
      result = result.filter(d => d.employee.department === payrollDepartmentFilter);
    }
    return result.sort((a, b) => {
      const deptA = a.employee.department || '';
      const deptB = b.employee.department || '';
      return deptA.localeCompare(deptB);
    });
  }, [payrollData, hasManagementPrivileges, currentUser.id, payrollDepartmentFilter]);

  const handleUpdatePayroll = async (empId: string, updates: Partial<Payroll>) => {
    const allowedKeys = ['employeeFeedback', 'employeeNote', 'status'];
    if (isLocked && !Object.keys(updates).every(k => allowedKeys.includes(k))) {
      alert("Bảng lương tháng này đã bị chốt, không thể chỉnh sửa.");
      return;
    }
    const existing = payrolls.find(p => p.employeeId === empId);
    const data = payrollData.find(d => d.employee.id === empId);
    if (!data) return;

    const payroll: Payroll = existing ? { ...existing, ...updates, updatedAt: new Date().toISOString() } : {
      id: Math.random().toString(36).substr(2, 9),
      companyId: currentUser.companyId,
      employeeId: empId,
      month: selectedMonth,
      baseSalary: data.info?.monthlySalary || 0,
      dailySalary: data.dailySalary,
      totalNC: data.totalNC,
      totalTC: data.totalTC,
      salaryNC: data.salaryNC,
      salaryTC: data.salaryTC,
      totalSalary: data.totalSalary,
      allowance: 0,
      totalAdvance: data.totalAdvance,
      paidAmount: 0,
      previousBalance: 0,
      finalSalary: data.finalSalary,
      remainingBalance: 0,
      status: PayrollStatus.PENDING,
      updatedAt: new Date().toISOString(),
      ...updates
    };

    await apiUpdatePayroll(payroll);
  };

  // --- Config Logic ---
  const [editConfig, setEditConfig] = useState<SalaryConfig | null>(null);
  useEffect(() => {
    if (config) setEditConfig(config);
    else setEditConfig({
      id: 'default',
      companyId: currentUser.companyId,
      workingDaysInMonth: 26,
      workingHoursPerDay: 8,
      startTime: '08:00',
      endTime: '17:00',
      overtimeRate: 1.5,
      updatedAt: new Date().toISOString()
    });
  }, [config, currentUser.companyId]);

  const handleSaveConfig = async () => {
    if (isLocked) {
      alert("Bảng lương tháng này đã bị chốt, không thể sửa cấu hình.");
      return;
    }
    if (editConfig) {
      await apiUpdateSalaryConfig({ ...editConfig, updatedAt: new Date().toISOString() });
      alert('Đã lưu cấu hình!');
    }
  };

  const handleToggleLock = async () => {
    if (!isDirector) return;
    const newStatus = !isLocked;
    const message = newStatus 
      ? `Bạn có chắc chắn muốn CHỐT LƯƠNG tháng ${selectedMonth}? Sau khi chốt, toàn bộ dữ liệu sẽ không thể chỉnh sửa.`
      : `Bạn có chắc chắn muốn MỞ KHÓA bảng lương tháng ${selectedMonth}?`;
    
    if (!window.confirm(message)) return;

    const lock: PayrollLock = {
      id: `${currentUser.companyId}_${selectedMonth}`,
      companyId: currentUser.companyId,
      month: selectedMonth,
      isLocked: newStatus,
      lockedBy: currentUser.id,
      lockedAt: new Date().toISOString()
    };

    await apiUpdatePayrollLock(lock);
    alert(newStatus ? "Đã chốt lương thành công!" : "Đã mở khóa bảng lương.");
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getDayOfWeek = (dateStr: string) => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      alert("Bảng lương tháng này đã bị chốt, không thể nhập dữ liệu.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length < 4) {
        alert("File không đúng định dạng.");
        return;
      }

      const headerRow = data[0];
      const dayColumns: { day: number, ncCol: number, tcCol: number }[] = [];
      
      for (let i = 3; i < headerRow.length; i++) {
        const val = headerRow[i];
        if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseInt(val)))) {
          const day = parseInt(val.toString());
          if (!dayColumns.find(d => d.day === day)) {
            dayColumns.push({ day, ncCol: i, tcCol: i + 1 });
          }
        }
      }

      let updatedCount = 0;
      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        const empName = row[1];
        if (!empName) continue;

        const employee = users.find(u => u.name === empName);
        if (!employee) continue;

        for (const col of dayColumns) {
          const nc = parseFloat(row[col.ncCol]) || 0;
          const tc = parseFloat(row[col.tcCol]) || 0;
          
          const date = `${selectedMonth}-${col.day.toString().padStart(2, '0')}`;
          const existing = attendances.find(a => a.employeeId === employee.id && a.date === date);
          
          if (existing) {
            if (existing.nc !== nc || existing.tc !== tc) {
              await apiUpdateAttendance({ ...existing, nc, tc });
              updatedCount++;
            }
          } else if (nc > 0 || tc > 0) {
            await apiAddAttendance({
              id: Math.random().toString(36).substr(2, 9),
              companyId: currentUser.companyId,
              employeeId: employee.id,
              date,
              nc,
              tc,
              createdAt: new Date().toISOString()
            });
            updatedCount++;
          }
        }
      }

      alert(`Đã cập nhật ${updatedCount} bản ghi chấm công.`);
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handlePrintSingle = (data: any) => {
    setViewingPayslip(data);
    setPrintMode('single');
    setTimeout(() => {
      window.print();
      setPrintMode('none');
    }, 100);
  };

  const handlePrintAll = () => {
    setPrintMode('all');
    setTimeout(() => {
      window.print();
      setPrintMode('none');
    }, 100);
  };

  const exportToExcel = () => {
    let fileName = '';
    let wb = XLSX.utils.book_new();

    if (activeSubTab === 'attendance') {
      fileName = `Cham_Cong_${selectedMonth}.xlsx`;
      const header1 = ['STT', 'Họ và Tên', 'Bộ phận'];
      const header2 = ['', '', ''];
      const header3 = ['', '', ''];
      
      const rows: any[][] = [header1, header2, header3];
      
      for (let i = 1; i <= daysInMonth; i++) {
        const date = `${selectedMonth}-${i.toString().padStart(2, '0')}`;
        header1.push(i.toString().padStart(2, '0'), '');
        header2.push(getDayOfWeek(date), '');
        header3.push('NC', 'TC');
      }
      header1.push('Tổng NC', 'Tổng TC');
      header2.push('', '');
      header3.push('', '');

      employees.forEach((emp, idx) => {
        const workingHours = config?.workingHoursPerDay || 8;
        const otRate = config?.overtimeRate || 1.5;
        let totalNCHours = 0;
        let totalTCHours = 0;

        const row = [idx + 1, emp.name, emp.department || 'Nhân viên'];
        for (let i = 1; i <= daysInMonth; i++) {
          const date = `${selectedMonth}-${i.toString().padStart(2, '0')}`;
          const att = attendanceGrid[emp.id]?.[date];
          row.push(att?.nc || 0, att?.tc || 0);
          totalNCHours += att?.nc || 0;
          totalTCHours += att?.tc || 0;
        }

        const totalNC_Days = Math.round((totalNCHours / workingHours) * 100) / 100;
        const totalTC_Days = Math.round((totalTCHours / workingHours * otRate) * 100) / 100;
        row.push(totalNC_Days, totalTC_Days);
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 2, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 2, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 2, c: 2 } },
      ];
      for (let i = 0; i < daysInMonth; i++) {
        const col = 3 + i * 2;
        merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 1 } });
        merges.push({ s: { r: 1, c: col }, e: { r: 1, c: col + 1 } });
      }
      const lastCol = 3 + daysInMonth * 2;
      merges.push({ s: { r: 0, c: lastCol }, e: { r: 2, c: lastCol } });
      merges.push({ s: { r: 0, c: lastCol + 1 }, e: { r: 2, c: lastCol + 1 } });
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, 'Chấm Công');
    } else {
      let data: any[] = [];
      if (activeSubTab === 'payroll') {
        fileName = `Bang_Luong_${selectedMonth}.xlsx`;
        data = payrollData.map((d, idx) => ({
          'STT': idx + 1,
          'Nhân viên': d.employee.name,
          'Lương tháng': d.info?.monthlySalary || 0,
          'Lương ngày': d.dailySalary,
          'Lương NC': d.salaryNC,
          'Lương TC': d.salaryTC,
          'Tổng lương': d.totalSalary,
          'Phụ cấp': d.payroll?.allowance || 0,
          'Tạm ứng': d.totalAdvance,
          'Đã nhận': d.payroll?.paidAmount || 0,
          'Dư tháng trước': d.payroll?.previousBalance || 0,
          'Thực lĩnh': d.finalSalary,
          'Trạng thái': d.payroll?.status === PayrollStatus.APPROVED ? 'Đã ký nhận' : 'Chưa ký'
        }));
      } else if (activeSubTab === 'advance') {
        fileName = `Tam_Ung_${selectedMonth}.xlsx`;
        data = filteredAdvances.map((adv, idx) => ({
          'STT': idx + 1,
          'Ngày': new Date(adv.date).toLocaleDateString('vi-VN'),
          'Nhân viên': users.find(u => u.id === adv.employeeId)?.name || 'N/A',
          'Số tiền': adv.amount,
          'Ghi chú': adv.note
        }));
      }
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu');
    }
    XLSX.writeFile(wb, fileName);
  };

  const payrollTotals = filteredPayrollData.reduce((acc, data) => {
    acc.monthlySalary += data.info?.monthlySalary || 0;
    acc.dailySalary += data.info?.dailySalary || (data.info?.monthlySalary ? data.info.monthlySalary / daysInMonth : 0);
    acc.salaryNC += data.salaryNC;
    acc.salaryTC += data.salaryTC;
    acc.totalSalary += data.totalSalary;
    acc.allowance += data.payroll?.allowance || 0;
    acc.totalAdvance += data.totalAdvance;
    acc.paidAmount += data.payroll?.paidAmount || 0;
    acc.previousBalance += data.payroll?.previousBalance || 0;
    acc.finalSalary += data.finalSalary;
    return acc;
  }, {
    monthlySalary: 0,
    dailySalary: 0,
    salaryNC: 0,
    salaryTC: 0,
    totalSalary: 0,
    allowance: 0,
    totalAdvance: 0,
    paidAmount: 0,
    previousBalance: 0,
    finalSalary: 0
  });

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header & Month Selector */}
      <div className="bg-white p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <IconWallet className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">Quản lý Lương</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {hasManagementPrivileges && activeSubTab === 'attendance' && (
            <>
              <button 
                onClick={() => document.getElementById('excel-import')?.click()}
                className="flex items-center gap-1.5 bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
              >
                <IconUpload className="w-4 h-4" /> Nhập Excel
              </button>
              <input 
                id="excel-import"
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </>
          )}
          {hasManagementPrivileges && activeSubTab === 'attendance' && (
            <button 
              onClick={handleBatchApproveOT}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <IconCheck className="w-4 h-4" /> Duyệt Tăng Ca
            </button>
          )}
          {isDirector && activeSubTab === 'attendance' && (
            <button 
              onClick={handleDeleteAllAttendance}
              className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm"
            >
              <IconTrash className="w-4 h-4" /> Xóa dữ liệu tháng
            </button>
          )}
          
          {hasManagementPrivileges && (
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
            >
              <IconDownload className="w-4 h-4" /> Xuất Excel
            </button>
          )}

          {isDirector && activeSubTab === 'payroll' && (
            <button 
              onClick={handlePrintAll}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> In hàng loạt
            </button>
          )}

          {isDirector && (
            <button
              onClick={handleToggleLock}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                isLocked 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              {isLocked ? <IconLock className="w-4 h-4" /> : <IconUnlock className="w-4 h-4" />}
              {isLocked ? 'Mở khóa' : 'Chốt Lương'}
            </button>
          )}

          {isLocked && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-100 animate-pulse">
              <IconLock className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Đã chốt</span>
            </div>
          )}

          <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const prev = new Date(y, m - 2, 1);
              setSelectedMonth(prev.toISOString().slice(0, 7));
            }}
            className="p-2 hover:bg-white rounded-md transition-colors"
          >
            <IconChevronLeft className="w-5 h-5" />
          </button>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-medium text-gray-700 px-2"
          />
          <button 
            onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const next = new Date(y, m, 1);
              setSelectedMonth(next.toISOString().slice(0, 7));
            }}
            className="p-2 hover:bg-white rounded-md transition-colors"
          >
            <IconChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

      {/* Sub Tabs */}
      <div className="flex border-b bg-white overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('attendance')}
          className={`px-6 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${activeSubTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Bảng chấm công
        </button>
        {currentUser.role !== UserRole.WORKER && (
          <button 
            onClick={() => setActiveSubTab('advance')}
            className={`px-6 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${activeSubTab === 'advance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Tạm ứng
          </button>
        )}
        <button 
          onClick={() => setActiveSubTab('payroll')}
          className={`px-6 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${activeSubTab === 'payroll' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Bảng lương
        </button>
        {hasManagementPrivileges && (
          <button 
            onClick={() => setActiveSubTab('config')}
            className={`px-6 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${activeSubTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Cấu hình
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
        {activeSubTab === 'attendance' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1 min-h-0 relative z-0">
              <div className="p-2 bg-blue-50 text-[10px] text-blue-700 flex flex-wrap items-center gap-4 border-b">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>NC: Số giờ làm việc (8 = 8 tiếng)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                  <span>TC: Số giờ tăng ca (2 = 2 tiếng)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-800 rounded-full"></div>
                  <span>Tổng NC/TC: Số công quy đổi (Ngày)</span>
                </div>
                <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold ml-auto">
                  <span>🔥 Lương tăng ca: x{config?.overtimeRate || 1.5}</span>
                  <span className="mx-2">|</span>
                  <span>🔥 Lương Chủ Nhật: x{config?.sundayCoefficient || 1}</span>
                </div>
              </div>
              <table className="w-full text-[11px] text-left border-separate border-spacing-0 min-w-max">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold sticky top-0 z-30">
                  <tr>
                    <th rowSpan={3} className="px-2 py-3 border-r border-b border-t sticky left-0 top-0 bg-gray-50 z-40 w-[40px] min-w-[40px] max-w-[40px] text-center">STT</th>
                    <th rowSpan={3} className="px-4 py-3 border-r border-b border-t sticky left-[40px] top-0 bg-gray-50 z-40 min-w-[150px]">Họ và Tên</th>
                    <th rowSpan={3} className="px-4 py-3 border-r border-b border-t sticky top-0 bg-gray-50 z-30 min-w-[100px] transform-gpu">Bộ phận</th>
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      return (
                        <th key={i} colSpan={2} className="px-2 py-1 border-r border-b border-t text-center min-w-[80px] sticky top-0 bg-gray-50 z-30 transform-gpu">
                          {day.toString().padStart(2, '0')}
                        </th>
                      );
                    })}
                    <th rowSpan={3} className="px-2 py-3 border-r border-b border-t text-center font-bold bg-blue-50 text-blue-700 min-w-[60px] sticky top-0 z-30 transform-gpu">Tổng NC</th>
                    <th rowSpan={3} className="px-2 py-3 border-b border-t text-center font-bold bg-orange-50 text-orange-700 min-w-[60px] sticky top-0 z-30 transform-gpu">Tổng TC</th>
                  </tr>
                  <tr>
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                      const dayOfWeek = getDayOfWeek(date);
                      return (
                        <th key={i} colSpan={2} className={`px-2 py-1 border-r border-b text-center text-[10px] font-normal sticky top-[28px] z-30 transform-gpu ${dayOfWeek === 'CN' ? 'text-red-500 bg-red-50' : 'bg-gray-50'}`}>
                          {dayOfWeek === 'CN' ? 'Chủ nhật' : `Thứ ${dayOfWeek.slice(1)}`}
                        </th>
                      );
                    })}
                  </tr>
                  <tr>
                    {Array.from({ length: daysInMonth }).map((_, i) => (
                      <React.Fragment key={i}>
                        <th className="px-1 py-1 border-r border-b text-center font-bold text-blue-600 bg-blue-50/30 w-[40px] min-w-[40px] max-w-[40px] sticky top-[52px] z-30 transform-gpu">NC</th>
                        <th className="px-1 py-1 border-r border-b text-center font-bold text-orange-600 bg-orange-50/30 w-[40px] min-w-[40px] max-w-[40px] sticky top-[52px] z-30 transform-gpu">TC</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, idx) => {
                    const empAttendances = attendances.filter(a => a.employeeId === emp.id);
                    const workingHours = config?.workingHoursPerDay || 8;
                    const otRate = config?.overtimeRate || 1.5;

                    const totalNCHours = empAttendances.reduce((sum, a) => sum + (a.nc || 0), 0);
                    const totalTCHours = empAttendances.reduce((sum, a) => sum + (a.tc || 0), 0);
                    
                    const totalNC_Days = Math.round((totalNCHours / workingHours) * 100) / 100;
                    const totalTC_Days = Math.round((totalTCHours / workingHours * otRate) * 100) / 100;
                    
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-2 py-3 border-r border-b sticky left-0 bg-white z-10 text-center w-[40px] min-w-[40px] max-w-[40px]">{idx + 1}</td>
                        <td className="px-4 py-3 border-r border-b sticky left-[40px] bg-white z-10 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 border-r border-b text-gray-600 transform-gpu">{emp.department || 'Nhân viên'}</td>
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const date = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                          const att = attendanceGrid[emp.id]?.[date];
                          const dayOfWeek = getDayOfWeek(date);
                          
                          let cellBg = '';
                          if (dayOfWeek === 'CN') cellBg = 'bg-gray-100/50';
                          if (att?.otStatus === OTStatus.APPROVED) cellBg = 'bg-green-50';
                          else if (att?.otStatus === OTStatus.PENDING) cellBg = 'bg-red-50';

                          return (
                            <React.Fragment key={i}>
                              <td 
                                className={`px-1 py-2 border-r border-b text-center cursor-pointer hover:bg-blue-50 transition-all w-[40px] min-w-[40px] max-w-[40px] relative z-0 transform-gpu ${cellBg}`}
                                onClick={() => {
                                  if (att) {
                                    setViewingAttendance(att);
                                    setShowAttendanceDetail(true);
                                  }
                                }}
                              >
                                {att?.checkIn && !att?.checkOut ? (
                                  <span className="text-[9px] font-bold text-blue-600 animate-pulse">{att.checkIn}</span>
                                ) : (
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    min="0"
                                    disabled={!hasManagementPrivileges || isLocked}
                                    value={att?.nc || ''}
                                    onChange={(e) => handleUpdateAttendance(emp.id, day, 'nc', parseFloat(e.target.value) || 0)}
                                    className="w-full min-w-0 text-[10px] p-0 border-none bg-transparent text-center focus:ring-0 disabled:text-gray-400"
                                  />
                                )}
                              </td>
                              <td 
                                className={`px-1 py-2 border-r border-b text-center cursor-pointer hover:bg-orange-50 transition-all w-[40px] min-w-[40px] max-w-[40px] relative z-0 transform-gpu ${cellBg}`}
                                onClick={() => {
                                  if (att) {
                                    setViewingAttendance(att);
                                    setShowAttendanceDetail(true);
                                  }
                                }}
                              >
                                <input 
                                  type="number" 
                                  step="0.5"
                                  min="0"
                                  disabled={!hasManagementPrivileges || isLocked}
                                  value={att?.tc || ''}
                                  onChange={(e) => handleUpdateAttendance(emp.id, day, 'tc', parseFloat(e.target.value) || 0)}
                                  className="w-full min-w-0 text-[10px] p-0 border-none bg-transparent text-center text-orange-600 font-medium focus:ring-0 disabled:text-gray-400"
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="px-2 py-3 border-r border-b text-center font-bold text-blue-700 bg-blue-50/50 transform-gpu">{totalNC_Days}</td>
                        <td className="px-2 py-3 border-b text-center font-bold text-orange-700 bg-orange-50/50 transform-gpu">{totalTC_Days}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {employees.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Chưa có nhân viên nào trong hệ thống.
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'advance' && currentUser.role !== UserRole.WORKER && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Danh sách tạm ứng tháng {selectedMonth}</h2>
              {hasManagementPrivileges && (
                <button 
                  onClick={() => setShowAddAdvance(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <IconPlus className="w-4 h-4" />
                  Thêm tạm ứng
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold border-b">
                  <tr>
                    <th className="px-6 py-3">Ngày</th>
                    <th className="px-6 py-3">Nhân viên</th>
                    <th className="px-6 py-3">Số tiền</th>
                    <th className="px-6 py-3">Ghi chú</th>
                    {hasManagementPrivileges && <th className="px-6 py-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAdvances.map((adv) => (
                    <tr key={adv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">{new Date(adv.date).toLocaleDateString('vi-VN')}</td>
                      <td className="px-6 py-4 font-medium">{users.find(u => u.id === adv.employeeId)?.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-red-600 font-semibold">{formatCurrency(adv.amount)}</td>
                      <td className="px-6 py-4 text-gray-600">{adv.note}</td>
                      {hasManagementPrivileges && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setEditingAdvance(adv)}
                              className="text-blue-500 hover:text-blue-700 p-1"
                            >
                              <IconEdit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi tạm ứng này?')) {
                                  apiDeleteAdvancePayment(adv.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <IconTrash className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredAdvances.length === 0 && (
                    <tr>
                      <td colSpan={hasManagementPrivileges ? 5 : 4} className="px-6 py-8 text-center text-gray-500">Không có dữ liệu tạm ứng trong tháng này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'payroll' && (
          <div className="flex-1 overflow-auto flex flex-col gap-4 pb-8">
            <div className="flex justify-end px-4">
              <select
                value={payrollDepartmentFilter}
                onChange={(e) => setPayrollDepartmentFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">Tất cả bộ phận</option>
                {Array.from(new Set(employees.map(e => e.department).filter(Boolean))).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            {/* Desktop View / Manager View */}
            <div className={`bg-white rounded-xl shadow-sm border ${!hasManagementPrivileges ? 'hidden md:block' : 'block'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-max">
                <thead className="bg-gray-50 text-gray-700 uppercase font-semibold sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 border-r border-b sticky left-0 bg-gray-50 z-30 w-12">STT</th>
                    <th className="px-4 py-3 border-r border-b sticky left-12 bg-gray-50 z-30 min-w-[150px]">Nhân viên</th>
                    <th className="px-4 py-3 border-r border-b min-w-[100px] transform-gpu">Bộ phận</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Lương tháng</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Lương ngày</th>
                    <th className="px-4 py-3 border-r border-b min-w-[100px] transform-gpu">Lương NC</th>
                    <th className="px-4 py-3 border-r border-b min-w-[100px] transform-gpu">Lương TC</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Tổng lương</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Phụ cấp</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Tạm ứng</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Đã nhận</th>
                    <th className="px-4 py-3 border-r border-b min-w-[120px] transform-gpu">Dư tháng trước</th>
                    <th className="px-4 py-3 border-r border-b min-w-[150px] font-bold text-blue-700 bg-blue-50 transform-gpu">Thực lĩnh</th>
                    <th className="px-4 py-3 border-b min-w-[150px] transform-gpu">Ký nhận</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50/80 font-bold text-blue-900 border-b-2 border-blue-200">
                    <td colSpan={3} className="px-4 py-3 border-r border-b sticky left-0 z-10 text-center bg-blue-50/80">Tổng cộng</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.monthlySalary)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.dailySalary)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.salaryNC)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.salaryTC)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.totalSalary)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.allowance)}</td>
                    <td className="px-4 py-3 border-r border-b text-red-600 transform-gpu">{formatCurrency(payrollTotals.totalAdvance)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.paidAmount)}</td>
                    <td className="px-4 py-3 border-r border-b transform-gpu">{formatCurrency(payrollTotals.previousBalance)}</td>
                    <td className="px-4 py-3 border-r border-b text-blue-800 transform-gpu">{formatCurrency(payrollTotals.finalSalary)}</td>
                    <td className="px-4 py-3 border-b transform-gpu"></td>
                  </tr>
                  {filteredPayrollData.map((data, idx) => {
                    const payroll = data.payroll;
                    return (
                      <tr key={data.employee.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 border-r border-b sticky left-0 bg-white z-10 text-center">{idx + 1}</td>
                        <td 
                          className={`px-4 py-3 border-r border-b sticky left-12 bg-white z-10 font-medium ${isDirector ? 'text-blue-600 cursor-pointer hover:underline' : ''}`}
                          onClick={() => isDirector && setViewingPayslip(data)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{data.employee.name}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintSingle(data);
                              }}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              title="In phiếu lương"
                            >
                              <IconDownload className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-b transform-gpu text-gray-600">
                          {data.employee.department || ''}
                        </td>
                        <td className="px-4 py-3 border-r border-b transform-gpu">
                          {hasManagementPrivileges ? (
                            <CurrencyInput 
                              value={data.info?.monthlySalary || 0}
                              onChange={(val) => apiUpdateEmployeeSalaryInfo({
                                id: data.employee.id,
                                companyId: currentUser.companyId,
                                monthlySalary: val,
                                dailySalary: val / daysInMonth
                              })}
                              className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="text-gray-600">{formatCurrency(data.info?.monthlySalary || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-b transform-gpu">
                          {hasManagementPrivileges ? (
                            <CurrencyInput 
                              value={data.info?.dailySalary || (data.info?.monthlySalary ? data.info.monthlySalary / daysInMonth : 0)}
                              onChange={(val) => apiUpdateEmployeeSalaryInfo({
                                id: data.employee.id,
                                companyId: currentUser.companyId,
                                dailySalary: val,
                                monthlySalary: val * daysInMonth
                              })}
                              className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="text-gray-600">{formatCurrency(data.info?.dailySalary || (data.info?.monthlySalary ? data.info.monthlySalary / daysInMonth : 0))}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-b text-gray-600 transform-gpu">{formatCurrency(data.salaryNC)}</td>
                        <td className="px-4 py-3 border-r border-b text-gray-600 transform-gpu">{formatCurrency(data.salaryTC)}</td>
                        <td className="px-4 py-3 border-r border-b font-semibold transform-gpu">{formatCurrency(data.totalSalary)}</td>
                        <td className="px-4 py-3 border-r border-b transform-gpu">
                          {hasManagementPrivileges ? (
                            <CurrencyInput 
                              value={payroll?.allowance || 0}
                              onChange={(val) => handleUpdatePayroll(data.employee.id, { allowance: val })}
                              className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="text-gray-600">{formatCurrency(payroll?.allowance || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-b text-red-600 transform-gpu">{formatCurrency(data.totalAdvance)}</td>
                        <td className="px-4 py-3 border-r border-b transform-gpu">
                          {hasManagementPrivileges ? (
                            <CurrencyInput 
                              value={payroll?.paidAmount || 0}
                              onChange={(val) => handleUpdatePayroll(data.employee.id, { paidAmount: val })}
                              className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="text-gray-600">{formatCurrency(payroll?.paidAmount || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-b transform-gpu">
                          {hasManagementPrivileges ? (
                            <CurrencyInput 
                              value={payroll?.previousBalance || 0}
                              onChange={(val) => handleUpdatePayroll(data.employee.id, { previousBalance: val })}
                              className="w-full p-1 border rounded focus:ring-1 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                              disabled={isLocked}
                            />
                          ) : (
                            <span className="text-gray-600">{formatCurrency(payroll?.previousBalance || 0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 border-r border-b font-bold text-blue-700 bg-blue-50/50 transform-gpu">{formatCurrency(data.finalSalary)}</td>
                        <td className="px-4 py-3 border-b transform-gpu">
                          <div className="flex flex-col gap-2">
                            {payroll?.employeeFeedback === EmployeeFeedback.AGREE ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <IconCheck className="w-4 h-4" />
                                Đã đồng ý
                              </span>
                            ) : payroll?.employeeFeedback === EmployeeFeedback.DISAGREE ? (
                              <span className="flex items-center gap-1 text-red-600 font-medium">
                                <IconX className="w-4 h-4" />
                                Không đồng ý
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Chờ phản hồi</span>
                            )}
                            
                            {payroll?.employeeNote && (
                              <div className="text-[10px] text-gray-500 italic flex items-start gap-1">
                                <IconMessageSquare className="w-3 h-3 mt-0.5" />
                                <span className="line-clamp-2">{payroll.employeeNote}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* End of Desktop View */}
            </div>

            {/* Mobile View for Employees */}
            {!hasManagementPrivileges && (
              <div className="md:hidden space-y-4">
                {filteredPayrollData.map((data) => (
                  <div key={data.employee.id} className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
                    <div className="bg-navy-800 p-4 text-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold">Thông báo lương</h3>
                          <p className="text-xs opacity-80">Tháng {selectedMonth}</p>
                        </div>
                        <div className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          {data.employee.department || 'Nhân viên'}
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-medium">{data.employee.name}</p>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Lương cơ bản:</span>
                        <span className="font-medium text-sm">{formatCurrency(data.info?.monthlySalary || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Lương NC ({data.totalNC} công):</span>
                        <span className="font-medium text-sm">{formatCurrency(data.salaryNC)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Lương TC ({data.totalTC} công):</span>
                        <span className="font-medium text-sm">{formatCurrency(data.salaryTC)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Phụ cấp:</span>
                        <span className="font-medium text-sm text-green-600">+{formatCurrency(data.payroll?.allowance || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Tạm ứng:</span>
                        <span className="font-medium text-sm text-red-600">-{formatCurrency(data.totalAdvance)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Đã nhận:</span>
                        <span className="font-medium text-sm text-red-600">-{formatCurrency(data.payroll?.paidAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                        <span className="text-gray-500 text-xs">Dư tháng trước:</span>
                        <span className="font-medium text-sm">{formatCurrency(data.payroll?.previousBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 text-blue-700">
                        <span className="text-base font-bold">Thực lĩnh:</span>
                        <span className="text-xl font-black">{formatCurrency(data.finalSalary)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Employee Feedback Section - Only visible after Director locks payroll */}
            {!isDirector && isLocked && (
              <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-blue-100 space-y-4">
                {(() => {
                  const myPayrollData = payrollData.find(d => d.employee.id === currentUser.id);
                  if (!myPayrollData) return <p className="text-sm text-gray-500 italic">Chưa có dữ liệu lương của bạn trong tháng này.</p>;
                  
                  const isSigned = myPayrollData.payroll?.status === PayrollStatus.APPROVED;
                  const [year, month] = selectedMonth.split('-');
                  const formattedMonth = `${month}-${year}`;

                  return (
                    <div className="space-y-6">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <IconMessageSquare className="w-5 h-5 text-blue-600" />
                        Bảng phản hồi lương tháng {formattedMonth}
                      </h3>

                      {isSigned && (
                        <div className="p-6 bg-green-50 border border-green-100 rounded-2xl flex flex-col items-center justify-center gap-4 text-center mb-6">
                          <div className="bg-green-600 p-3 rounded-full text-white shadow-lg shadow-green-200">
                            <IconCheck className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xl font-bold text-green-800">Bạn đã ký nhận bảng lương tháng {formattedMonth}</p>
                            <p className="text-sm text-green-600">Phản hồi của bạn đã được ghi nhận và không thể thay đổi.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4">
                        <button
                          disabled={isSigned}
                          onClick={() => handleUpdatePayroll(currentUser.id, { 
                            employeeFeedback: EmployeeFeedback.AGREE
                          })}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                            myPayrollData.payroll?.employeeFeedback === EmployeeFeedback.AGREE
                              ? 'bg-green-600 text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                          } ${isSigned ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                        >
                          <IconThumbsUp className="w-5 h-5" />
                          Đồng ý
                        </button>
                        <button
                          disabled={isSigned}
                          onClick={() => handleUpdatePayroll(currentUser.id, { 
                            employeeFeedback: EmployeeFeedback.DISAGREE
                          })}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                            myPayrollData.payroll?.employeeFeedback === EmployeeFeedback.DISAGREE
                              ? 'bg-red-600 text-white shadow-lg scale-105'
                              : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                          } ${isSigned ? 'opacity-50 cursor-not-allowed scale-100' : ''}`}
                        >
                          <IconThumbsDown className="w-5 h-5" />
                          Không đồng ý
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Ghi chú / Ý kiến phản hồi</label>
                        <textarea
                          disabled={isSigned}
                          value={myPayrollData.payroll?.employeeNote || ''}
                          onChange={(e) => handleUpdatePayroll(currentUser.id, { employeeNote: e.target.value })}
                          placeholder="Nhập ý kiến của bạn về bảng lương này..."
                          className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] text-sm disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>

                      {!isSigned && (
                        <button
                          onClick={() => setShowSignatureConfirm(true)}
                          disabled={!myPayrollData.payroll?.employeeFeedback}
                          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all disabled:bg-gray-300 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                          <IconCheck className="w-6 h-6" />
                          Xác nhận & Ký nhận bảng lương
                        </button>
                      )}
                    </div>
                  );
                })()}
                
                <p className="text-[10px] text-gray-400 italic">
                  * Ý kiến của bạn sẽ được gửi trực tiếp đến Ban Giám Đốc để xem xét.
                </p>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'config' && editConfig && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border space-y-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <IconSettings className="w-6 h-6 text-blue-600" />
              Cấu hình tính lương
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Số giờ làm việc / ngày</label>
                <input 
                  type="number" 
                  value={editConfig.workingHoursPerDay}
                  onChange={(e) => setEditConfig({ ...editConfig, workingHoursPerDay: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Hệ số tăng ca</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={editConfig.overtimeRate}
                  onChange={(e) => setEditConfig({ ...editConfig, overtimeRate: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Hệ số làm Chủ Nhật</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={editConfig.sundayCoefficient || 1}
                  onChange={(e) => setEditConfig({ ...editConfig, sundayCoefficient: parseFloat(e.target.value) || 1 })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Danh sách ca làm việc</h3>
                <button 
                  onClick={() => {
                    const newShift: Shift = { id: Math.random().toString(36).substr(2, 9), name: `Ca ${editConfig.shifts?.length || 0 + 1}`, startTime: '08:00', endTime: '17:00' };
                    setEditConfig({ ...editConfig, shifts: [...(editConfig.shifts || []), newShift] });
                  }}
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <IconPlus className="w-3 h-3" />
                  Thêm ca
                </button>
              </div>
              <div className="space-y-3">
                {editConfig.shifts?.map((shift, sIdx) => (
                  <div key={shift.id} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-[150px]">
                      <input 
                        type="text" 
                        value={shift.name}
                        onChange={(e) => {
                          const newShifts = [...(editConfig.shifts || [])];
                          newShifts[sIdx].name = e.target.value;
                          setEditConfig({ ...editConfig, shifts: newShifts });
                        }}
                        className="w-full p-2 border rounded-lg text-sm font-medium"
                        placeholder="Tên ca"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="time" 
                        value={shift.startTime}
                        onChange={(e) => {
                          const newShifts = [...(editConfig.shifts || [])];
                          newShifts[sIdx].startTime = e.target.value;
                          setEditConfig({ ...editConfig, shifts: newShifts });
                        }}
                        className="p-2 border rounded-lg text-sm"
                      />
                      <span className="text-gray-400">→</span>
                      <input 
                        type="time" 
                        value={shift.endTime}
                        onChange={(e) => {
                          const newShifts = [...(editConfig.shifts || [])];
                          newShifts[sIdx].endTime = e.target.value;
                          setEditConfig({ ...editConfig, shifts: newShifts });
                        }}
                        className="p-2 border rounded-lg text-sm"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newShifts = editConfig.shifts?.filter((_, i) => i !== sIdx);
                        setEditConfig({ ...editConfig, shifts: newShifts });
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!editConfig.shifts || editConfig.shifts.length === 0) && (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed text-gray-400 text-sm">
                    Chưa có ca làm việc nào.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button 
                onClick={handleSaveConfig}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                <IconSave className="w-5 h-5" />
                Lưu cấu hình
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Detail Modal */}
      {showAttendanceDetail && viewingAttendance && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Chi tiết chấm công</h3>
              <button onClick={() => setShowAttendanceDetail(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <IconX className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 font-bold">
                    <IconCamera className="w-5 h-5" />
                    <span>Giờ vào: {viewingAttendance.checkIn || '--:--'}</span>
                  </div>
                  <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden border-2 border-blue-100 shadow-inner flex items-center justify-center">
                    {viewingAttendance.checkInImage ? (
                      <img src={viewingAttendance.checkInImage} alt="Check-in" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <IconImage className="w-12 h-12 text-gray-300" />
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-orange-600 font-bold">
                    <IconCamera className="w-5 h-5" />
                    <span>Giờ ra: {viewingAttendance.checkOut || '--:--'}</span>
                  </div>
                  <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden border-2 border-orange-100 shadow-inner flex items-center justify-center">
                    {viewingAttendance.checkOutImage ? (
                      <img src={viewingAttendance.checkOutImage} alt="Check-out" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <IconImage className="w-12 h-12 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Giờ làm (NC)</div>
                  <div className="text-2xl font-black text-blue-800">{viewingAttendance.nc || 0}h</div>
                </div>
                <div className="text-center border-l border-blue-200">
                  <div className="text-xs text-orange-600 font-medium uppercase tracking-wider mb-1">Tăng ca (TC)</div>
                  <div className="text-2xl font-black text-orange-800">
                    {viewingAttendance.tc || 0}h
                    {viewingAttendance.otStatus === OTStatus.PENDING && (
                      <span className="text-[10px] block text-red-500 animate-pulse">(Chờ duyệt: {viewingAttendance.otHours}h)</span>
                    )}
                  </div>
                </div>
              </div>

              {hasManagementPrivileges && viewingAttendance.otStatus === OTStatus.PENDING && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApproveOT(viewingAttendance)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <IconCheck className="w-5 h-5" /> Duyệt Tăng Ca
                  </button>
                  <button 
                    onClick={() => handleRejectOT(viewingAttendance)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <IconX className="w-5 h-5" /> Từ Chối
                  </button>
                </div>
              )}

              {viewingAttendance.flag && viewingAttendance.flag !== AttendanceFlag.NORMAL && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                  viewingAttendance.flag === AttendanceFlag.LATE_EARLY ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-red-50 border-red-100 text-red-800'
                }`}>
                  <IconAlert className="w-5 h-5 flex-shrink-0" />
                  <div className="text-sm font-medium">
                    {viewingAttendance.flag === AttendanceFlag.LATE_EARLY && 'Nhân viên đi muộn hoặc về sớm.'}
                    {viewingAttendance.flag === AttendanceFlag.MISSING_OUT && 'Nhân viên quên bấm Check-out (Hệ thống tự đóng ca).'}
                    {viewingAttendance.flag === AttendanceFlag.DATA_ERROR && 'Lỗi dữ liệu: Chỉ có Check-out, không có Check-in.'}
                  </div>
                </div>
              )}

              {hasManagementPrivileges && viewingAttendance.flag === AttendanceFlag.DATA_ERROR && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="text-sm font-bold text-gray-700">Nhập tay giờ Check-in (Quản lý)</label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={manualCheckInTime}
                      onChange={(e) => setManualCheckInTime(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!manualCheckInTime) {
                          alert("Vui lòng nhập giờ Check-in.");
                          return;
                        }
                        try {
                          const updatedAtt = { ...viewingAttendance, checkIn: manualCheckInTime + ":00" };
                          const stats = calculateAttendanceStats(updatedAtt, config);
                          updatedAtt.nc = stats.nc;
                          updatedAtt.tc = stats.tc;
                          updatedAtt.otHours = stats.otHours;
                          updatedAtt.otStatus = stats.otStatus;
                          updatedAtt.flag = stats.flag;
                          
                          await apiUpdateAttendance(updatedAtt);
                          setViewingAttendance(updatedAtt);
                          setManualCheckInTime('');
                          alert("Đã cập nhật giờ Check-in thành công.");
                        } catch (err) {
                          console.error("Error updating manual check-in:", err);
                          alert("Có lỗi xảy ra khi cập nhật.");
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {hasManagementPrivileges && viewingAttendance.flag === AttendanceFlag.MISSING_OUT && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="text-sm font-bold text-gray-700">Điều chỉnh giờ Check-out (Quản lý)</label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={manualCheckOutTime}
                      onChange={(e) => setManualCheckOutTime(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!manualCheckOutTime) {
                          alert("Vui lòng nhập giờ Check-out.");
                          return;
                        }
                        try {
                          const updatedAtt = { ...viewingAttendance, checkOut: manualCheckOutTime + ":00" };
                          const stats = calculateAttendanceStats(updatedAtt, config);
                          updatedAtt.nc = stats.nc;
                          updatedAtt.tc = stats.tc;
                          updatedAtt.otHours = stats.otHours;
                          updatedAtt.otStatus = stats.otStatus;
                          updatedAtt.flag = stats.flag;
                          
                          await apiUpdateAttendance(updatedAtt);
                          setViewingAttendance(updatedAtt);
                          setManualCheckOutTime('');
                          alert("Đã cập nhật giờ Check-out thành công.");
                        } catch (err) {
                          console.error("Error updating manual check-out:", err);
                          alert("Có lỗi xảy ra khi cập nhật.");
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {viewingAttendance.missingOutReason && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lý do quên Check-out</label>
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100 italic text-red-800 text-sm">
                    {viewingAttendance.missingOutReason}
                  </div>
                </div>
              )}

              {viewingAttendance.note && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ghi chú</label>
                  <div className="p-3 bg-gray-50 rounded-xl border italic text-gray-600 text-sm">
                    {viewingAttendance.note}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setShowAttendanceDetail(false)}
                className="px-6 py-2 bg-navy-800 text-white rounded-xl font-bold hover:bg-navy-900 transition-all shadow-md active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Advance Modal */}
      {showAddAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Thêm tạm ứng mới</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
                <select 
                  value={newAdvance.employeeId}
                  onChange={(e) => setNewAdvance({ ...newAdvance, employeeId: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn nhân viên...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
                <CurrencyInput 
                  value={newAdvance.amount}
                  onChange={(val) => setNewAdvance({ ...newAdvance, amount: val })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nhập số tiền..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tạm ứng</label>
                <input 
                  type="date" 
                  value={newAdvance.date}
                  onChange={(e) => setNewAdvance({ ...newAdvance, date: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea 
                  value={newAdvance.note}
                  onChange={(e) => setNewAdvance({ ...newAdvance, note: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  placeholder="Nội dung tạm ứng..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowAddAdvance(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
              >
                Hủy
              </button>
              <button 
                onClick={handleAddAdvance}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Advance Modal */}
      {editingAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Chỉnh sửa tạm ứng</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
                <select 
                  value={editingAdvance.employeeId}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, employeeId: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Chọn nhân viên...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
                <CurrencyInput 
                  value={editingAdvance.amount}
                  onChange={(val) => setEditingAdvance({ ...editingAdvance, amount: val })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nhập số tiền..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tạm ứng</label>
                <input 
                  type="date" 
                  value={editingAdvance.date}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, date: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea 
                  value={editingAdvance.note}
                  onChange={(e) => setEditingAdvance({ ...editingAdvance, note: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                  placeholder="Nội dung tạm ứng..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setEditingAdvance(null)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
              >
                Hủy
              </button>
              <button 
                onClick={handleUpdateAdvance}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Signature Confirmation Modal */}
      {showSignatureConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 bg-blue-50/50">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <IconCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Xác nhận ký bảng lương</h3>
              <p className="text-sm text-gray-500 mt-1">
                Tháng {selectedMonth.split('-')[1]}-{selectedMonth.split('-')[0]}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Sau khi xác nhận, bạn sẽ <strong>không thể thay đổi</strong> phản hồi của mình. Bạn có chắc chắn muốn ký nhận bảng lương này?
              </p>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3 text-yellow-800 text-sm">
                <IconMessageSquare className="w-5 h-5 shrink-0 text-yellow-600" />
                <p>Hành động này tương đương với chữ ký điện tử của bạn trên bảng lương.</p>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button 
                onClick={() => setShowSignatureConfirm(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  handleUpdatePayroll(currentUser.id, { status: PayrollStatus.APPROVED });
                  setShowSignatureConfirm(false);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <IconCheck className="w-5 h-5" />
                Đồng ý ký nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPayslip && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white w-full max-w-2xl rounded-t-2xl shadow-2xl flex justify-between items-center p-3 sm:p-4 border-b shrink-0">
            <h3 className="text-lg font-bold text-navy-800 truncate pr-2">Phiếu báo lương</h3>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handlePrintSingle(viewingPayslip)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center"
                title="In phiếu lương"
              >
                <IconPrinter className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewingPayslip(null)} 
                className="p-2 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                title="Đóng"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="bg-gray-100 w-full max-w-2xl rounded-b-2xl shadow-2xl overflow-y-auto flex-1 p-2 sm:p-4">
            <Payslip data={viewingPayslip} month={selectedMonth} companyName={currentUser.companyName || 'CÔNG TY TNHH ABC'} />
          </div>
        </div>
      )}

      {printMode !== 'none' && createPortal(
        <div className="hidden print:block print:static print:w-full print:h-auto bg-white z-[9999] print:p-4">
          {printMode === 'single' && viewingPayslip && (
            <Payslip data={viewingPayslip} month={selectedMonth} companyName={currentUser.companyName || 'CÔNG TY TNHH ABC'} />
          )}
          {printMode === 'all' && filteredPayrollData.map((data) => (
            <Payslip key={data.employee.id} data={data} month={selectedMonth} companyName={currentUser.companyName || 'CÔNG TY TNHH ABC'} />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SalaryTab;
