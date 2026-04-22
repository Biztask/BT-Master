
export enum UserRole {
  DIRECTOR = 'DIRECTOR', // Giám đốc (Người tạo công ty)
  MANAGER = 'MANAGER',   // Quản lý (Chức vụ mới)
  EMPLOYEE = 'EMPLOYEE', // Nhân viên
  WORKER = 'WORKER',     // Công nhân
  CONTRACTOR = 'CONTRACTOR' // Nhân công khoán
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface User {
  id: string;
  name: string;
  username: string; // Tên đăng nhập
  password?: string; // Mật khẩu (In real app, hash this!)
  companyName: string; // Tên công ty để đăng nhập
  companyId: string; // ID ẩn để link dữ liệu
  role: UserRole;
  avatar: string;
  email?: string;
  department?: string; // Bộ phận
  phone?: string;
  cccd?: string;
  dob?: string;
  hometown?: string;
  bankAccount?: string;
  qrCode?: string;
  notes?: string;
}

export interface Task {
  id: string;
  companyId: string; // Link task to a specific company
  title: string;
  description: string;
  assigneeId: string;
  creatorId: string;
  dueDate: string; // ISO string
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  completedAt?: string | null;
  attachments?: string[]; // Danh sách URL ảnh đính kèm khi giao việc
  completionImage?: string; // URL ảnh minh chứng khi hoàn thành
}

export interface Partner {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  address: string;
  initialDebt: number;
  createdAt: string;
  rowTagId?: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  createdAt: string;
}

export interface PartnerTransaction {
  id: string;
  companyId: string;
  partnerId: string; // Can be empty
  productId: string;
  customerId?: string; // Tên công trình
  content?: string; // Nội dung
  executor?: string; // Người thực hiện
  date: string; // ISO string
  quantity: number;
  purchaseAmount: number;
  paidAmount: number;
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  address: string;
  initialDebt: number; // Giá trị HĐ ban đầu
  createdAt: string;
  startDate?: string; // Ngày bắt đầu công trình
  status?: 'IN_PROGRESS' | 'COMPLETED'; // Tiến độ công trình
  rowTagId?: string;
  type?: 'PROJECT' | 'GOODS'; // Công Trình hoặc Hàng Hóa
  progressTagId?: string; // Tiến độ
  noteTagId?: string; // Ghi chú
}

export interface PaymentCategory {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
}

export interface RowTag {
  id: string;
  companyId: string;
  type: 'CUSTOMER' | 'PARTNER' | 'CUSTOMER_PROGRESS' | 'CUSTOMER_NOTE';
  text: string;
  color: string;
}

export interface FinanceCategory {
  id: string;
  companyId: string;
  name: string;
  type: 'THU' | 'CHI';
  createdAt: string;
}

export interface CustomerTransaction {
  id: string;
  companyId: string;
  customerId: string;
  paymentCategoryId: string;
  date: string; // ISO string
  purchaseAmount: number; // Tiền Mua
  paidAmount: number; // Tiền Trả
  executor?: string; // Người thực hiện
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface SalaryConfig {
  id: string;
  companyId: string;
  workingDaysInMonth: number;
  workingHoursPerDay: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  overtimeRate: number;
  sundayCoefficient?: number; // Hệ số làm Chủ Nhật
  updatedAt: string;
  shifts?: Shift[];
}

export enum OTStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum AttendanceFlag {
  NORMAL = 'NORMAL',
  LATE_EARLY = 'LATE_EARLY',
  MISSING_OUT = 'MISSING_OUT',
  DATA_ERROR = 'DATA_ERROR'
}

export enum PayrollStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum EmployeeFeedback {
  AGREE = 'AGREE',
  DISAGREE = 'DISAGREE'
}

export interface Attendance {
  id: string;
  companyId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  nc: number; // Ngày công
  tc: number; // Tăng ca (giờ)
  checkIn?: string; // HH:mm:ss
  checkOut?: string; // HH:mm:ss
  checkInImage?: string; // Base64
  checkOutImage?: string; // Base64
  missingOutReason?: string; // Lý do quên check-out
  note?: string;
  otStatus?: OTStatus;
  otHours?: number;
  flag?: AttendanceFlag;
  createdAt?: string;
}

export interface AdvancePayment {
  id: string;
  companyId: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note: string;
  createdAt: string;
}

export interface Payroll {
  id: string;
  companyId: string;
  employeeId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  dailySalary: number;
  totalNC: number;
  totalTC: number;
  salaryNC: number;
  salaryTC: number;
  totalSalary: number;
  allowance: number;
  totalAdvance: number;
  paidAmount: number;
  previousBalance: number;
  finalSalary: number;
  remainingBalance: number;
  status: PayrollStatus;
  employeeNote?: string;
  employeeFeedback?: EmployeeFeedback | null;
  updatedAt: string;
}

export interface EmployeeSalaryInfo {
  id: string; // userId
  companyId: string;
  monthlySalary: number;
  dailySalary: number;
}

export interface PayrollLock {
  id: string; // companyId_month
  companyId: string;
  month: string; // YYYY-MM
  isLocked: boolean;
  lockedBy: string;
  lockedAt: string;
}

export interface InventoryItem {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  supplierId?: string;
  note?: string;
  updatedAt: string;
}

export enum InventoryTxType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  CHECK = 'CHECK'
}

export interface InventoryTransaction {
  id: string;
  companyId: string;
  itemId: string;
  type: InventoryTxType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: string;
  partnerId?: string;
  customerId?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  linkedTxId?: string; // ID of the associated PartnerTransaction or CustomerTransaction
}

export interface InventoryCheckLog {
  id: string;
  companyId: string;
  date: string;
  createdBy: string;
  note?: string;
}

export interface BillingConfig {
  isPaywallActive: boolean;
  monthlyFee: number;
  durationDays: number;
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export interface Company {
  id: string;
  name: string;
  expiredAt: string; // ISO string
  createdAt: string;
}
