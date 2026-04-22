
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  User, 
  Task, 
  UserRole, 
  TaskStatus, 
  TaskPriority,
  SalaryConfig,
  Attendance,
  OTStatus,
  AttendanceFlag,
  BillingConfig,
  Company
} from './types';
import CreateTaskModal from './components/CreateTaskModal';
import TaskDetailModal from './components/TaskDetailModal';
import Auth from './components/Auth';
import UserManagement from './components/UserManagement';
import SetupScreen from './components/SetupScreen'; 
import PaywallModal from './components/PaywallModal';
import { 
  getStoredSession, 
  saveStoredSession,
  subscribeToTasks,
  subscribeToUsers,
  subscribeToAttendance,
  subscribeToSalaryConfig,
  subscribeToBillingConfig,
  subscribeToCompany,
  apiAddTask,
  apiUpdateTask,
  apiAddUser,
  apiDeleteUser,
  apiUpdateUser,
  apiAddAttendance,
  apiUpdateAttendance,
  cleanupOldTasks,
  calculateAttendanceStats,
  uploadTaskImage,
  uploadImageToStorage,
  getMissingCheckOuts
} from './services/storageService';
import { isConfigured, resetFirebaseConfig, updateCompanyConfig } from './services/firebaseConfig';
import { 
  IconHome, 
  IconList, 
  IconUser, 
  IconCheck, 
  IconClock, 
  IconAlert,
  IconPlus,
  IconLogOut,
  IconSearch,
  IconShare,
  IconChart,
  IconBuilding,
  IconDollarSign,
  IconCloud,
  IconUpload,
  IconBriefcase, 
  IconFlag,
  IconEdit,
  IconImage,
  IconX,
  IconKey,
  IconCamera,
  IconTrophy,
  IconDownload,
  IconDatabase,
  IconUsers,
  IconWallet,
  IconThumbsUp,
  IconThumbsDown,
  IconMessageSquare,
  IconArrowLeft
} from './components/Icons';

import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

// --- Helper Functions ---
const isOverdue = (dateString: string) => {
  const due = new Date(dateString);
  const now = new Date();
  return due < now;
};

const isDueSoon = (dateString: string, days: number = 3) => {
    const due = new Date(dateString);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit',
    day: '2-digit', 
    month: '2-digit',
  }).format(date);
};

const getDeadlineInfo = (dueDateStr: string, status: TaskStatus) => {
  if (status === TaskStatus.COMPLETED) return null;

  const due = new Date(dueDateStr);
  const now = new Date();
  
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Quá hạn', className: 'bg-red-600 text-white', icon: true };
  }
  
  if (diffDays === 0) {
    return { text: 'Hết hạn hôm nay', className: 'bg-orange-100 text-orange-800 border border-orange-200' };
  }

  if (diffDays <= 3) {
    return { text: `Còn ${diffDays} ngày`, className: 'bg-orange-50 text-orange-700 border border-orange-200' };
  }

  if (diffDays <= 7) {
    return { text: `Còn ${diffDays} ngày`, className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' };
  }

  return { text: `Còn ${diffDays} ngày`, className: 'bg-gray-100 text-gray-600 border border-gray-200' };
};

import PartnersTab from './components/PartnersTab';
import CustomersTab from './components/CustomersTab';
import FinanceTab from './components/FinanceTab';
import SalaryTab from './components/SalaryTab';
import InventoryTab from './components/InventoryTab';
import { InformationTab } from './components/InformationTab';

export default function App() {
  const [isSystemReady, setIsSystemReady] = useState(isConfigured());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Tab State
  type TabType = 'dashboard' | 'tasks' | 'team' | 'profile' | 'partners' | 'customers' | 'finance' | 'salary' | 'information' | 'inventory';
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Swipe State
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const touchOnScrollable = useRef(false);
  const minSwipeDistance = 50;

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null); 
  const [viewingTask, setViewingTask] = useState<Task | null>(null); 
  
  // Attendance State
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [missingCheckOuts, setMissingCheckOuts] = useState<Attendance[]>([]);
  const [showMissingCheckOutModal, setShowMissingCheckOutModal] = useState(false);
  const [missingOutReason, setMissingOutReason] = useState('');
  const [missingOutTime, setMissingOutTime] = useState('18:00');
  const attendanceInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);

  // Completion Modal State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  // Change Password Modal State
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [newSelfPass, setNewSelfPass] = useState('');

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL' | 'OVERDUE'>('ALL');
  // New State: Sub-filter for Completed tasks
  const [completionFilter, setCompletionFilter] = useState<'ALL' | 'ON_TIME' | 'OVERDUE'>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  
  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Billing State
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const isAppLocked = useMemo(() => {
    if (!billingConfig?.isPaywallActive || !currentCompany?.expiredAt) return false;
    const now = new Date();
    const expiry = new Date(currentCompany.expiredAt);
    return now > expiry;
  }, [billingConfig, currentCompany]);

  // Update Config state
  const [showUpdateConfigModal, setShowUpdateConfigModal] = useState(false);
  const [newConfigJson, setNewConfigJson] = useState('');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // FIX IOS CRASH: Safely initialize notification permission
  // On iOS, 'Notification' object might not exist, causing ReferenceError
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification !== 'undefined') {
      return Notification.permission;
    }
    return 'default';
  });

  const isNative = Capacitor.isNativePlatform();

  // Role Checks helpers
  const isDirector = currentUser?.role === UserRole.DIRECTOR;
  const isManager = currentUser?.role === UserRole.MANAGER;
  const isWorker = currentUser?.role === UserRole.WORKER;
  const isContractor = currentUser?.role === UserRole.CONTRACTOR;
  const hasManagementPrivileges = isDirector || isManager;

  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setCurrentUser(session);
      if (session.role === UserRole.WORKER) {
        setActiveTab('salary');
      } else if (session.role === UserRole.CONTRACTOR) {
        setActiveTab('dashboard');
      }
    }
  }, []);

  useEffect(() => {
    saveStoredSession(currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isSystemReady) {
      setTasks([]);
      setUsers([]);
      setTodayAttendance(null);
      return;
    }

    setIsLoadingData(true);
    const unsubTasks = subscribeToTasks(currentUser.companyId, (updatedTasks) => {
      setTasks(updatedTasks);
      setIsLoadingData(false);
    });
    const unsubUsers = subscribeToUsers(currentUser.companyId, (updatedUsers) => {
      setUsers(updatedUsers);
    });
    const unsubConfig = subscribeToSalaryConfig(currentUser.companyId, (config) => {
      setSalaryConfig(config);
    });

    // Subscribe to today's attendance
    const today = new Date().toISOString().split('T')[0];
    const unsubAttendance = subscribeToAttendance(currentUser.companyId, today.slice(0, 7), (atts) => {
      setAttendances(atts);
      const myAtt = atts.find(a => a.employeeId === currentUser.id && a.date === today);
      setTodayAttendance(myAtt || null);
    });

    const unsubBilling = subscribeToBillingConfig(setBillingConfig);
    const unsubCompany = subscribeToCompany(currentUser.companyId, setCurrentCompany);

    cleanupOldTasks(currentUser.companyId);

    return () => {
      unsubTasks();
      unsubUsers();
      unsubConfig();
      unsubAttendance();
      unsubBilling();
      unsubCompany();
    };
  }, [currentUser?.companyId, isSystemReady]); 

  // Side effect to show paywall when locked
  useEffect(() => {
    if (isAppLocked) {
      if (currentUser?.role === UserRole.DIRECTOR) {
        setShowPaywall(true);
      }
    } else {
      setShowPaywall(false);
    }
  }, [isAppLocked, currentUser?.role]);
  // Fetch missing checkouts when salary config is ready
  useEffect(() => {
    if (currentUser && salaryConfig) {
      getMissingCheckOuts(currentUser.companyId, currentUser.id, salaryConfig).then(missing => {
        setMissingCheckOuts(missing);
      });
    }
  }, [currentUser, salaryConfig]);

  // Reset completion filter when main status changes
  useEffect(() => {
     if (statusFilter !== TaskStatus.COMPLETED) {
         setCompletionFilter('ALL');
     }
  }, [statusFilter]);

  // --- Swipe Logic ---
  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchEndY.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    
    // Check if touch started on a horizontally scrollable element
    let target = e.target as HTMLElement;
    let isScrollable = false;
    while (target && target !== e.currentTarget) {
      const style = window.getComputedStyle(target);
      const overflowX = style.overflowX;
      const overflow = style.overflow;
      if (overflowX === 'auto' || overflowX === 'scroll' || overflow === 'auto' || overflow === 'scroll') {
        if (target.scrollWidth > target.clientWidth) {
          isScrollable = true;
          break;
        }
      }
      target = target.parentElement as HTMLElement;
    }
    touchOnScrollable.current = isScrollable;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null || 
        touchStartY.current === null || touchEndY.current === null) return;
    
    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = touchStartY.current - touchEndY.current;
    
    // If the swipe is more vertical than horizontal, don't switch tabs
    if (Math.abs(distanceY) > Math.abs(distanceX)) return;
    
    // If it started on a scrollable element, don't switch tabs
    if (touchOnScrollable.current) return;

    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    
    // Define available tabs based on user role
    let availableTabs: TabType[] = [];
    if (isWorker) {
      availableTabs = ['salary', 'profile'];
    } else if (isContractor) {
      availableTabs = ['dashboard', 'profile'];
    } else {
      availableTabs = ['dashboard', 'tasks', 'team'];
      if (hasManagementPrivileges) {
        availableTabs.push('partners', 'customers', 'finance');
      }
      availableTabs.push('salary', 'profile');
    }

    const currentIndex = availableTabs.indexOf(activeTab);

    if (isLeftSwipe && currentIndex < availableTabs.length - 1) {
       setActiveTab(availableTabs[currentIndex + 1]);
    }
    if (isRightSwipe && currentIndex > 0) {
       setActiveTab(availableTabs[currentIndex - 1]);
    }
  };

  const myPendingTaskCount = useMemo(() => {
    if (!currentUser || hasManagementPrivileges || isWorker || isContractor) return 0;
    return tasks.filter(t => t.assigneeId === currentUser.id && t.status === TaskStatus.TODO).length;
  }, [tasks, currentUser, hasManagementPrivileges, isWorker, isContractor]);

  const updateAppBadge = async (count: number) => {
    try {
      if (isNative) {
        await Badge.requestPermissions();
        if (count > 0) {
          await Badge.set({ count });
        } else {
          await Badge.clear();
        }
      } else {
        if ('setAppBadge' in navigator) {
          if (count > 0) {
            // @ts-ignore
            navigator.setAppBadge(count).catch(e => console.error("Set badge error", e));
          } else {
             // @ts-ignore
            navigator.clearAppBadge().catch(e => console.error("Clear badge error", e));
          }
        }
      }
    } catch (e) {
      console.error("Badge Error:", e);
    }
  };

  useEffect(() => {
    updateAppBadge(myPendingTaskCount);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateAppBadge(myPendingTaskCount);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [myPendingTaskCount, isNative]);

  const requestNotificationAccess = async () => {
    if (isNative) {
       await Badge.requestPermissions();
       alert("Đã yêu cầu quyền thông báo.");
       return;
    }
    // Safe check for Notification API
    if (typeof Notification === 'undefined') {
       alert("Trình duyệt này không hỗ trợ thông báo.");
       return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') updateAppBadge(myPendingTaskCount);
  };

  const testBadge = async () => {
     try {
       const randomNum = Math.floor(Math.random() * 10) + 1;
       if (isNative) {
         await Badge.set({ count: randomNum });
         alert(`[Native] Badge: ${randomNum}`);
       } else {
         if ('setAppBadge' in navigator) {
            // @ts-ignore
            await navigator.setAppBadge(randomNum);
            alert(`[Web] Badge: ${randomNum}`);
         } else {
            alert("Trình duyệt không hỗ trợ App Badge API.");
         }
       }
     } catch (e: any) {
       alert(`Lỗi: ${e.message}`);
     }
  };

  const handleRegisterCompany = (newUser: User) => {
    setCurrentUser(newUser);
    setActiveTab(newUser.role === UserRole.WORKER ? 'salary' : 'dashboard');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab(user.role === UserRole.WORKER ? 'salary' : 'dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    updateAppBadge(0);
  };

  const handleAddUser = async (newUser: User) => {
    await apiAddUser(newUser);
  };

  const handleDeleteUser = async (userId: string) => {
    await apiDeleteUser(userId);
  };

  const handleChangeSelfPass = async () => {
    if(!currentUser || !newSelfPass) return;
    try {
      const updatedUser = { ...currentUser, password: newSelfPass };
      await apiUpdateUser(updatedUser);
      const { password: _, ...userWithoutPassword } = updatedUser;
      setCurrentUser(userWithoutPassword as User);
      setNewSelfPass('');
      setShowChangePassModal(false);
      alert('Đổi mật khẩu thành công!');
    } catch (e) {
      alert('Có lỗi xảy ra, vui lòng thử lại.');
    }
  };
  
  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${currentUser.id}/${Date.now()}.${ext}`;
      const imageUrl = await uploadImageToStorage(file, path);
      
      if (imageUrl) {
        const updatedUser = { ...currentUser, avatar: imageUrl };
        
        // Update DB
        await apiUpdateUser(updatedUser);
        
        // Update State immediately
        setCurrentUser(updatedUser);
      }
      
    } catch (error) {
      console.error("Avatar update failed:", error);
      alert("Lỗi cập nhật ảnh đại diện.");
    }
  };

  const handleCheckOutWithoutPhoto = async () => {
    if (!currentUser || !todayAttendance) return;
    setIsProcessingAttendance(true);
    try {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
      
      const updatedAtt: Attendance = {
        ...todayAttendance,
        checkOut: timeStr,
      };
      const stats = calculateAttendanceStats(updatedAtt, salaryConfig);
      updatedAtt.nc = stats.nc;
      updatedAtt.tc = stats.tc;
      updatedAtt.otHours = stats.otHours;
      updatedAtt.otStatus = stats.otStatus;
      updatedAtt.flag = stats.flag;
      
      await apiUpdateAttendance(updatedAtt);
      alert(`Đã kết thúc ngày làm việc lúc ${timeStr}. NC: ${stats.nc}, TC: ${stats.tc}`);
    } catch (error) {
      console.error("Check-out failed:", error);
      alert("Lỗi khi kết thúc ngày làm việc.");
    } finally {
      setIsProcessingAttendance(false);
    }
  };

  const handleAttendanceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !e.target.files?.[0]) return;
    setIsProcessingAttendance(true);
    const file = e.target.files[0];
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      const path = `attendance/${currentUser.companyId}/${dateStr}/${currentUser.id}_${Date.now()}.${ext}`;
      const imageUrl = await uploadImageToStorage(file, path);

      if (!imageUrl) {
        throw new Error("Failed to upload image");
      }

      if (!todayAttendance) {
        // Check-in
        const newAtt: Attendance = {
          id: Math.random().toString(36).substr(2, 9),
          companyId: currentUser.companyId,
          employeeId: currentUser.id,
          date: dateStr,
          nc: 0,
          tc: 0,
          checkIn: timeStr,
          checkInImage: imageUrl,
          otHours: 0,
          otStatus: OTStatus.NONE,
          flag: AttendanceFlag.NORMAL
        };
        
        const stats = calculateAttendanceStats(newAtt, salaryConfig);
        newAtt.nc = stats.nc;
        newAtt.tc = stats.tc;
        newAtt.otHours = stats.otHours;
        newAtt.otStatus = stats.otStatus;
        newAtt.flag = stats.flag;

        await apiAddAttendance(newAtt);
        alert(`Check-in thành công lúc ${timeStr}. NC: ${stats.nc}, TC: ${stats.tc}`);
      } else {
        // Check-out
        const updatedAtt: Attendance = {
          ...todayAttendance,
          checkOut: timeStr,
          checkOutImage: imageUrl
        };
        
        const stats = calculateAttendanceStats(updatedAtt, salaryConfig);
        updatedAtt.nc = stats.nc;
        updatedAtt.tc = stats.tc;
        updatedAtt.otHours = stats.otHours;
        updatedAtt.otStatus = stats.otStatus;
        updatedAtt.flag = stats.flag;

        await apiUpdateAttendance(updatedAtt);
        alert(`Check-out thành công lúc ${timeStr}. NC: ${stats.nc}, TC: ${stats.tc}`);
      }
    } catch (error) {
      console.error("Check-in/out failed:", error);
      alert("Lỗi xử lý ảnh chấm công. Vui lòng thử lại.");
    } finally {
      setIsProcessingAttendance(false);
      if (attendanceInputRef.current) {
        attendanceInputRef.current.value = '';
      }
    }
  };


  // --- Task Operations ---
  const createTask = async (taskData: any) => {
    if (!currentUser) return;
    const newTask: Task = {
      id: taskData.id || Math.random().toString(36).substr(2, 9),
      companyId: currentUser.companyId,
      ...taskData,
      status: TaskStatus.TODO,
      creatorId: currentUser.id,
      createdAt: new Date().toISOString()
    };
    await apiAddTask(newTask);
    setShowCreateModal(false);
  };

  const handleEditTask = (task: Task) => {
      setEditingTask(task);
  };

  const submitEditTask = async (updatedData: Task) => {
      await apiUpdateTask(updatedData);
      setEditingTask(null); 
  };

  const handleStatusClick = (task: Task) => {
    if (isAppLocked) {
      if (currentUser?.role === UserRole.DIRECTOR) {
        setShowPaywall(true);
      } else {
        alert("Ứng dụng bị khóa do hết hạn sử dụng. Vui lòng liên hệ Giám đốc.");
      }
      return;
    }
    if (task.status === TaskStatus.TODO) {
      updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);
      if (statusFilter === TaskStatus.TODO) {
        setStatusFilter('ALL');
      }
    } else if (task.status === TaskStatus.IN_PROGRESS) {
      setCompletingTask(task);
      setCompletionFile(null);
      setShowCompleteModal(true);
    }
  };

  const confirmCompleteTask = async () => {
    if (!completingTask) return;
    setIsSubmittingComplete(true);
    
    let imageUrl = '';
    if (completionFile) {
       const url = await uploadTaskImage(completionFile, completingTask.id);
       if (url) imageUrl = url;
    }

    const updatedTask = {
      ...completingTask,
      status: TaskStatus.COMPLETED,
      completedAt: new Date().toISOString(),
      completionImage: imageUrl || undefined
    };

    await apiUpdateTask(updatedTask);
    setIsSubmittingComplete(false);
    setShowCompleteModal(false);
    setCompletingTask(null);
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (isAppLocked) {
      if (currentUser?.role === UserRole.DIRECTOR) {
        setShowPaywall(true);
      } else {
        alert("Ứng dụng bị khóa do hết hạn sử dụng. Vui lòng liên hệ Giám đốc.");
      }
      return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedTask = {
      ...task,
      status: newStatus,
      completedAt: newStatus === TaskStatus.COMPLETED ? new Date().toISOString() : null
    };
    await apiUpdateTask(updatedTask);
  };

  const handleReassign = async (userId: string) => {
    if (isAppLocked) {
      if (currentUser?.role === UserRole.DIRECTOR) {
        setShowPaywall(true);
      } else {
        alert("Ứng dụng bị khóa do hết hạn sử dụng. Vui lòng liên hệ Giám đốc.");
      }
      return;
    }
    if (!reassignTask) return;
    const updatedTask = { ...reassignTask, assigneeId: userId };
    await apiUpdateTask(updatedTask);
    setReassignTask(null);
  };

  // --- Filter Logic ---
  
  const myRelevantTasks = useMemo(() => {
    if (!currentUser) return [];
    if (hasManagementPrivileges) {
      return tasks;
    }
    return tasks.filter(t => t.assigneeId === currentUser.id);
  }, [tasks, currentUser, hasManagementPrivileges]);

  const filteredTasks = useMemo(() => {
    let result = [...myRelevantTasks];
    
    result.sort((a, b) => {
       if (a.status === TaskStatus.COMPLETED && b.status !== TaskStatus.COMPLETED) return 1;
       if (a.status !== TaskStatus.COMPLETED && b.status === TaskStatus.COMPLETED) return -1;
       if (a.status === TaskStatus.IN_PROGRESS && b.status !== TaskStatus.IN_PROGRESS) return -1;
       if (a.status !== TaskStatus.IN_PROGRESS && b.status === TaskStatus.IN_PROGRESS) return 1;
       return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    if (statusFilter === 'OVERDUE') {
      result = result.filter(t => t.status !== TaskStatus.COMPLETED && isOverdue(t.dueDate));
    } else if (statusFilter !== 'ALL') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Special sub-filter logic for COMPLETED tab
    if (statusFilter === TaskStatus.COMPLETED && completionFilter !== 'ALL') {
      result = result.filter(t => {
         if (!t.completedAt) return false; // Should not happen for completed tasks
         const isLate = new Date(t.completedAt) > new Date(t.dueDate);
         if (completionFilter === 'OVERDUE') return isLate;
         if (completionFilter === 'ON_TIME') return !isLate;
         return true;
      });
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q)
      );
    }

    if (startDate || endDate) {
      result = result.filter(t => {
        const taskDate = new Date(t.dueDate).toISOString().split('T')[0];
        let inRange = true;
        if (startDate && taskDate < startDate) inRange = false;
        if (endDate && taskDate > endDate) inRange = false;
        return inRange;
      });
    }
    
    return result;
  }, [myRelevantTasks, statusFilter, completionFilter, searchQuery, startDate, endDate]);

  // --- Export Excel Logic (Real .xlsx) ---
  const handleExportExcel = async () => {
    if (filteredTasks.length === 0) {
      alert("Không có dữ liệu để xuất.");
      return;
    }

    setIsExporting(true);

    // Use setTimeout to allow UI to update (show spinner) before heavy sync operation
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // 1. Prepare Data
      const dataToExport = filteredTasks.map((t, index) => {
        const creator = users.find(u => u.id === t.creatorId)?.name || 'N/A';
        const assignee = users.find(u => u.id === t.assigneeId)?.name || 'N/A';
        
        const isLate = t.status === TaskStatus.COMPLETED && t.completedAt && new Date(t.completedAt) > new Date(t.dueDate);
        const isOverdueNow = t.status !== TaskStatus.COMPLETED && new Date(t.dueDate) < new Date();
        
        let statusText = '';
        if (t.status === TaskStatus.TODO) statusText = 'Chờ xử lý';
        else if (t.status === TaskStatus.IN_PROGRESS) statusText = 'Đang làm';
        else statusText = 'Đã xong';

        let deadlineStatus = '';
        if (t.status === TaskStatus.COMPLETED) {
          deadlineStatus = isLate ? 'Trễ hạn' : 'Đúng hạn';
        } else {
          deadlineStatus = isOverdueNow ? 'Quá hạn' : 'Trong hạn';
        }

        return {
          "STT": index + 1,
          "Tiêu đề công việc": t.title,
          "Mô tả chi tiết": t.description,
          "Trạng thái": statusText,
          "Độ ưu tiên": t.priority,
          "Người giao": creator,
          "Người nhận": assignee,
          "Ngày giao": formatDateTime(t.createdAt),
          "Hạn chót": formatDateTime(t.dueDate),
          "Ngày hoàn thành": t.completedAt ? formatDateTime(t.completedAt) : '',
          "Đánh giá hạn": deadlineStatus
        };
      });

      // 2. Create Worksheet
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // 3. Format Columns (Width)
      const columnWidths = [
        { wch: 5 },  // STT
        { wch: 30 }, // Tieu de
        { wch: 40 }, // Mo ta
        { wch: 15 }, // Trang thai
        { wch: 10 }, // Uu tien
        { wch: 20 }, // Nguoi giao
        { wch: 20 }, // Nguoi nhan
        { wch: 18 }, // Ngay giao
        { wch: 18 }, // Han chot
        { wch: 18 }, // Ngay hoan thanh
        { wch: 15 }  // Danh gia
      ];
      worksheet['!cols'] = columnWidths;

      // 4. Create Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách công việc");

      // 5. Trigger Download
      const fileName = `Bao_Cao_Cong_Viec_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Export failed", error);
      alert("Có lỗi khi xuất file.");
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => {
    const defaultStats = { 
        pending: 0, 
        inProgress: 0, 
        overdueTotal: 0, 
        dueSoonTotal: 0,
        urgentTotal: 0,
        completedMonth: 0, 
        overdueRate: 0,
        totalCreatedMonth: 0 
    };

    if (!currentUser) return defaultStats;

    const sourceTasks = hasManagementPrivileges ? tasks : myRelevantTasks;

    const pending = sourceTasks.filter(t => t.status === TaskStatus.TODO).length;
    const inProgress = sourceTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    
    const overdueTotal = sourceTasks.filter(t => t.status !== TaskStatus.COMPLETED && isOverdue(t.dueDate)).length;
    const dueSoonTotal = sourceTasks.filter(t => t.status !== TaskStatus.COMPLETED && !isOverdue(t.dueDate) && isDueSoon(t.dueDate, 3)).length;
    const urgentTotal = overdueTotal + dueSoonTotal;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const totalCreatedMonth = sourceTasks.filter(t => {
        const d = new Date(t.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const completedTasksThisMonth = sourceTasks.filter(t => {
       if (t.status !== TaskStatus.COMPLETED || !t.completedAt) return false;
       const d = new Date(t.completedAt); 
       return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const completedMonth = completedTasksThisMonth.length;
    const completedLateMonth = completedTasksThisMonth.filter(t => {
        const completedDate = new Date(t.completedAt!);
        const dueDate = new Date(t.dueDate);
        return completedDate > dueDate;
    }).length;

    const overdueRate = completedMonth > 0 ? Math.round((completedLateMonth / completedMonth) * 100) : 0;

    return { 
        pending, 
        inProgress, 
        overdueTotal,
        dueSoonTotal,
        urgentTotal,
        completedMonth, 
        overdueRate,
        totalCreatedMonth
    };
  }, [tasks, myRelevantTasks, currentUser, hasManagementPrivileges]);

  const chartData = useMemo(() => {
     if (!currentUser) return [];
     const sourceTasks = hasManagementPrivileges ? tasks : myRelevantTasks;
     const data = [];
     const now = new Date();
     
     // Last 12 months
     for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth();
        const year = d.getFullYear();
        
        const count = sourceTasks.filter(t => {
           if (t.status !== TaskStatus.COMPLETED || !t.completedAt) return false;
           const cDate = new Date(t.completedAt);
           return cDate.getMonth() === month && cDate.getFullYear() === year;
        }).length;
        
        data.push({ 
           label: `T${month + 1}`, 
           count,
           fullLabel: `Tháng ${month + 1}/${year}`
        });
     }
     return data;
  }, [tasks, myRelevantTasks, currentUser, hasManagementPrivileges]);

  // Calculations for Trend Line in Chart
  const chartConfig = useMemo(() => {
      const maxVal = Math.max(...chartData.map(d => d.count), 5);
      
      const points = chartData.map((item, index) => {
          const x = ((index + 0.5) / chartData.length) * 100; // Center of the bar
          const y = 100 - (item.count / maxVal) * 100;
          return `${x},${y}`;
      });

      const polylinePoints = points.join(' ');
      
      return { maxVal, polylinePoints };
  }, [chartData]);


  const teamStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const stats = users.map(user => {
      const userTasks = tasks.filter(t => t.assigneeId === user.id);
      const todo = userTasks.filter(t => t.status === TaskStatus.TODO).length;
      const doing = userTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
      const done = userTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
      const overdue = userTasks.filter(t => t.status !== TaskStatus.COMPLETED && isOverdue(t.dueDate)).length;
      
      const totalBacklog = todo + doing; 

      const completedThisMonth = userTasks.filter(t => {
         if (t.status !== TaskStatus.COMPLETED) return false;
         const d = new Date(t.completedAt || t.dueDate);
         return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      
      const doneMonthCount = completedThisMonth.length;
      const overdueDoneMonth = completedThisMonth.filter(t => {
         if(!t.completedAt) return false;
         return new Date(t.completedAt) > new Date(t.dueDate);
      }).length;
      
      const onTimeRate = doneMonthCount > 0 
         ? Math.round(((doneMonthCount - overdueDoneMonth) / doneMonthCount) * 100) 
         : 0;

      return { user, todo, doing, done, overdue, doneMonthCount, onTimeRate, totalBacklog };
    });

    return stats.sort((a, b) => b.totalBacklog - a.totalBacklog);
  }, [users, tasks]);

  const leaderboardStats = useMemo(() => {
      // Exclude Managers and Directors from leaderboard and hide 0 values
      const lb = teamStats.filter(stat => stat.user.role === UserRole.EMPLOYEE && stat.doneMonthCount > 0);
      return lb.sort((a, b) => b.doneMonthCount - a.doneMonthCount).slice(0, 5); 
  }, [teamStats]);

  const attendanceStats = useMemo(() => {
    const stats = users.map(user => {
      const userAtts = attendances.filter(a => a.employeeId === user.id);
      
      let lateCount = 0;
      let earlyCount = 0;

      userAtts.forEach(a => {
        if (a.flag === AttendanceFlag.LATE_EARLY) {
          let isLate = false;
          let isEarly = false;
          
          if (a.checkIn) {
            const [h, m] = a.checkIn.split(':').map(Number);
            const checkInTime = h * 60 + m;
            isLate = checkInTime > 8 * 60 && !(checkInTime >= 12 * 60 && checkInTime <= 14 * 60);
          }
          
          if (a.checkOut) {
            const [h, m] = a.checkOut.split(':').map(Number);
            const checkOutTime = h * 60 + m;
            isEarly = checkOutTime < 18 * 60 && checkOutTime > 8 * 60;
          } else if (!a.checkOut) {
            isLate = true;
          }
          
          if (isLate) lateCount++;
          if (isEarly) earlyCount++;
        }
      });

      const totalNC = userAtts.reduce((sum, a) => sum + (a.nc || 0), 0);
      return { user, lateCount, earlyCount, totalNC };
    });
    return stats;
  }, [users, attendances]);

  const lateLeaderboard = useMemo(() => {
    return attendanceStats
      .filter(stat => stat.user.role === UserRole.EMPLOYEE && (stat.lateCount > 0 || stat.earlyCount > 0))
      .sort((a, b) => {
        if (b.lateCount !== a.lateCount) return b.lateCount - a.lateCount;
        return b.earlyCount - a.earlyCount;
      });
  }, [attendanceStats]);

  const ncLeaderboard = useMemo(() => {
    return attendanceStats
      .filter(stat => stat.user.role === UserRole.EMPLOYEE && stat.totalNC > 0)
      .sort((a, b) => b.totalNC - a.totalNC);
  }, [attendanceStats]);
  
  const totalCompanyTasksMonth = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      return tasks.filter(t => {
          const d = new Date(t.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length;
  }, [tasks]);

  const selectedEmployeeTasks = useMemo(() => {
    if (!selectedEmployee) return [];
    const list = tasks.filter(t => t.assigneeId === selectedEmployee.id);
    list.sort((a, b) => {
        const isAComplete = a.status === TaskStatus.COMPLETED;
        const isBComplete = b.status === TaskStatus.COMPLETED;
        if (isAComplete !== isBComplete) return isAComplete ? 1 : -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    return list;
  }, [tasks, selectedEmployee]);

  const navigateToMonthStats = (status: TaskStatus | 'OVERDUE') => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const format = (d: Date) => d.toISOString().split('T')[0];
      
      setStartDate(format(firstDay));
      setEndDate(format(lastDay));
      setStatusFilter(status);
      setActiveTab('tasks');
  };

  const resetFilters = () => {
      setStartDate('');
      setEndDate('');
      setStatusFilter('ALL');
  };

  const assignableUsers = useMemo(() => users.filter(u => u.role !== UserRole.WORKER && u.role !== UserRole.CONTRACTOR), [users]);

  if (!isSystemReady) return <SetupScreen onComplete={() => setIsSystemReady(true)} />;
  if (!currentUser) return <Auth onLogin={handleLogin} onRegisterCompany={handleRegisterCompany} onReset={() => setIsSystemReady(false)} />;

  const hasOverdue = stats.overdueTotal > 0;

  return (
    <div 
      className="flex flex-col h-full bg-[#F0F4F8] font-sans relative print:hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-slate-100 pointer-events-none"></div>
      
      {/* HEADER */}
      <header className="bg-navy-800 px-6 py-4 shadow-md flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            {activeTab === 'dashboard' ? 'Tổng quan' : 
             activeTab === 'tasks' ? 'Danh sách việc' : 
             activeTab === 'team' ? 'Nhân sự' : 
             activeTab === 'information' ? 'Thông tin' :
             activeTab === 'partners' ? 'Đối tác' : 
             activeTab === 'customers' ? 'Công trình' : 
             activeTab === 'finance' ? 'Tài chính' : 
             activeTab === 'inventory' ? 'Kho' :
             activeTab === 'salary' ? 'Lương' : 'Hồ sơ'}
          </h1>
          <div className="flex items-center gap-1 text-xs text-blue-200 mt-1">
            <IconBuilding className="w-3 h-3" />
            <span className="uppercase font-bold tracking-wider">{currentUser.companyName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className={`w-2.5 h-2.5 rounded-full border-2 border-navy-900 ${isLoadingData ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} title={isLoadingData ? 'Đang tải...' : 'Online'}></div>
           <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-navy-700 object-cover shadow-sm" />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto hide-scrollbar p-4 pb-24 w-full max-w-7xl mx-auto relative z-0">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-6xl mx-auto">

            {/* BIRTHDAY NOTIFICATION */}
            {isDirector && (() => {
              const today = new Date();
              const todayMonth = today.getMonth() + 1;
              const todayDate = today.getDate();
              
              const birthdayUsers = users.filter(u => {
                if (!u.dob) return false;
                const dob = new Date(u.dob);
                return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDate;
              });

              if (birthdayUsers.length === 0) return null;

              return (
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-6 shadow-lg border border-pink-400 text-white flex items-center gap-6 animate-fade-in relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 opacity-20 transform rotate-12">
                    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                  </div>
                  <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                  </div>
                  <div className="z-10">
                    <h2 className="text-2xl font-black tracking-wide mb-1 drop-shadow-md">CHÚC MỪNG SINH NHẬT!</h2>
                    <p className="text-lg font-medium text-pink-50">
                      Hôm nay là sinh nhật của <span className="font-bold text-white text-xl">{birthdayUsers.map(u => u.name).join(', ')}</span> 🎂🎉
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* 1. GREETING & ATTENDANCE */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
              <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                  Chào <span className="text-navy-800 font-bold text-base">
                    {isDirector ? 'Giám đốc ' : isManager ? 'Quản lý ' : ''}{currentUser.name}
                  </span>, chúc bạn một ngày làm việc hiệu quả!
              </div>

              {!isDirector && (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={attendanceInputRef}
                    onChange={handleAttendanceFileChange}
                  />
                  <button
                    disabled={isProcessingAttendance || isAppLocked}
                    onClick={() => {
                      if (isAppLocked) {
                        setShowPaywall(true);
                        return;
                      }
                      if (!todayAttendance) {
                        if (missingCheckOuts.length > 0) {
                          setShowMissingCheckOutModal(true);
                        } else {
                          attendanceInputRef.current?.click();
                        }
                      } else if (!todayAttendance.checkOut) {
                        handleCheckOutWithoutPhoto();
                      }
                    }}
                    className={`flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 w-full sm:w-auto ${
                      isProcessingAttendance ? 'bg-gray-400 cursor-not-allowed' :
                      !todayAttendance ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                      !todayAttendance.checkOut ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                      'bg-green-600 text-white opacity-80 cursor-default'
                    }`}
                  >
                    {isProcessingAttendance ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <IconCamera className="w-5 h-5" />
                    )}
                    {!todayAttendance ? 'Chấm Công' : 
                     !todayAttendance.checkOut ? 'Kết Thúc' : 'Đã Hoàn Thành'}
                  </button>
                  {todayAttendance && (
                    <div className="text-[10px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 shadow-inner flex gap-3">
                      {todayAttendance.checkIn && <div className="flex flex-col"><span>Vào:</span><span className="font-bold text-blue-600">{todayAttendance.checkIn}</span></div>}
                      {todayAttendance.checkOut && <div className="flex flex-col border-l pl-3"><span>Ra:</span><span className="font-bold text-orange-600">{todayAttendance.checkOut}</span></div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. DEADLINE WARNING MODULE */}
            <div 
              className="relative w-full cursor-pointer"
              onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setStatusFilter(hasOverdue ? 'OVERDUE' : 'ALL');
                  setActiveTab('tasks');
              }}
            >
               <div className={`rounded-[2rem] p-1 shadow-2xl relative overflow-hidden group transition-all duration-500 ${hasOverdue ? 'shadow-red-500/40' : 'shadow-emerald-500/40'}`}>
                   {/* Background Logic */}
                   <div className={`absolute inset-0 transition-colors duration-500 ${
                       hasOverdue 
                       ? 'bg-gradient-to-br from-red-600 via-red-500 to-rose-700' 
                       : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-green-600'
                   }`}></div>

                   {/* Glossy Effect */}
                   <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                   <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                   
                   {/* Inner Card Content */}
                   <div className="relative rounded-[1.8rem] p-6 flex flex-row items-center justify-between overflow-hidden z-10">
                       <div className="z-10 flex flex-col justify-center flex-1 pr-4">
                           <div className="flex items-center gap-2 mb-2">
                               <div className={`p-1.5 rounded-full ${hasOverdue ? 'bg-white/20' : 'bg-white/20'}`}>
                                   <IconAlert className="w-4 h-4 text-white" />
                               </div>
                               <h3 className="text-white/90 font-bold text-xs uppercase tracking-[0.2em]">
                                   {hasOverdue ? 'Cảnh báo hạn chót' : 'Trạng thái ổn định'}
                               </h3>
                           </div>
                           <div className="text-white text-base leading-snug font-medium">
                              {hasOverdue ? (
                                <>
                                  Bạn có <span className="font-bold text-yellow-300 text-lg">{stats.overdueTotal}</span> việc trễ và <br/>
                                  <span className="font-bold text-white">{stats.dueSoonTotal}</span> việc gấp cần xử lý.
                                </>
                              ) : (
                                <>
                                  Tuyệt vời! Hiện tại không có công việc nào bị quá hạn.
                                </>
                              )}
                           </div>
                       </div>
                       <div className="z-10 flex items-center gap-6 border-l border-white/20 pl-6">
                           <div className="flex flex-col items-center">
                                <div className="text-6xl font-black text-white leading-none drop-shadow-md">
                                   {stats.urgentTotal < 10 ? `0${stats.urgentTotal}` : stats.urgentTotal}
                                </div>
                                <div className="text-[9px] text-white/80 font-bold uppercase tracking-widest mt-2">Tổng báo động</div>
                           </div>
                       </div>
                   </div>
               </div>
            </div>

            {/* --- NEW INFOGRAPHIC LAYOUT --- */}
            <div className="relative w-full">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-32 h-32 bg-gradient-to-tr from-emerald-600 to-green-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.6)] flex flex-col items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                  <span className="text-3xl font-black text-white">{stats.totalCreatedMonth}</span>
                  <span className="text-[10px] text-white/90 font-bold uppercase text-center leading-tight mt-1">Việc mới<br/>tháng này</span>
                  <IconList className="w-4 h-4 text-white/70 mt-1" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(TaskStatus.TODO); setActiveTab('tasks'); }}
                    className="h-40 bg-yellow-400/85 backdrop-blur-md rounded-tl-[3rem] rounded-tr-2xl rounded-bl-2xl rounded-br-[1rem] p-5 flex flex-col justify-between shadow-[0_8px_0_0_#b45309] active:shadow-none active:translate-y-[8px] transition-all cursor-pointer relative overflow-hidden group border-b-2 border-yellow-600/50 items-start"
                  >
                     <div className="absolute top-0 right-0 p-8 bg-white/20 rounded-bl-full transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform"></div>
                     <div className="flex justify-between items-start text-white w-full">
                        <span className="font-bold text-4xl drop-shadow-md">{stats.pending}</span>
                        <div className="bg-white/20 p-2 rounded-lg"><IconClock className="w-5 h-5" /></div>
                     </div>
                     <span className="text-white font-bold uppercase text-xs tracking-wider">Chờ xử lý</span>
                  </div>

                  <div 
                    onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter(TaskStatus.IN_PROGRESS); setActiveTab('tasks'); }}
                    className="h-40 bg-orange-500/85 backdrop-blur-md rounded-tr-[3rem] rounded-tl-2xl rounded-br-2xl rounded-bl-[1rem] p-5 flex flex-col justify-between shadow-[0_8px_0_0_#c2410c] active:shadow-none active:translate-y-[8px] transition-all cursor-pointer relative overflow-hidden group border-b-2 border-orange-700/50 items-end"
                  >
                     <div className="absolute top-0 left-0 p-8 bg-white/20 rounded-br-full transform -translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform"></div>
                     <div className="flex justify-between items-start text-white w-full">
                        <div className="bg-white/20 p-2 rounded-lg"><IconList className="w-5 h-5" /></div>
                        <span className="font-bold text-4xl drop-shadow-md">{stats.inProgress}</span>
                     </div>
                     <span className="text-white font-bold uppercase text-xs tracking-wider text-right">Đang làm</span>
                  </div>

                  <div 
                    onClick={() => navigateToMonthStats(TaskStatus.COMPLETED)}
                    className="h-40 bg-cyan-500/85 backdrop-blur-md rounded-bl-[3rem] rounded-br-2xl rounded-tl-2xl rounded-tr-[1rem] p-5 flex flex-col justify-between shadow-[0_8px_0_0_#0e7490] active:shadow-none active:translate-y-[8px] transition-all cursor-pointer relative overflow-hidden group border-b-2 border-cyan-700/50 items-start"
                  >
                     <div className="absolute bottom-0 right-0 p-8 bg-white/20 rounded-tl-full transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform"></div>
                     <span className="text-white font-bold uppercase text-xs tracking-wider">Đã xong</span>
                     <div className="flex justify-between items-end text-white w-full">
                        <span className="font-bold text-4xl drop-shadow-md">{stats.completedMonth}</span>
                        <div className="bg-white/20 p-2 rounded-lg"><IconCheck className="w-5 h-5" /></div>
                     </div>
                  </div>

                  <div 
                    onClick={() => navigateToMonthStats('OVERDUE')}
                    className="h-40 bg-rose-500/85 backdrop-blur-md rounded-br-[3rem] rounded-bl-2xl rounded-tr-2xl rounded-tl-[1rem] p-5 flex flex-col justify-between shadow-[0_8px_0_0_#be123c] active:shadow-none active:translate-y-[8px] transition-all cursor-pointer relative overflow-hidden group border-b-2 border-rose-700/50 items-end"
                  >
                     <div className="absolute bottom-0 left-0 p-8 bg-white/20 rounded-tr-full transform -translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform"></div>
                     <span className="text-white font-bold uppercase text-xs tracking-wider text-right">Quá hạn</span>
                     <div className="flex justify-between items-end text-white w-full">
                        <div className="bg-white/20 p-2 rounded-lg"><IconAlert className="w-5 h-5" /></div>
                        <span className="font-bold text-4xl drop-shadow-md">{stats.overdueTotal}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* MONTH SUMMARY & CHART */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
                <div className="lg:col-span-12">
                    <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-100 p-8 rounded-3xl shadow-xl text-gray-800 relative overflow-hidden group text-center h-full">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black mb-6 uppercase tracking-widest text-red-600" style={{ textShadow: '1px 1px 0 #fff, 2px 2px 0 rgba(0,0,0,0.1), 3px 3px 0 rgba(0,0,0,0.05)' }}>
                               TỔNG KẾT THÁNG {new Date().getMonth() + 1}
                            </h3>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mx-auto">
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-blue-600 text-xs font-bold uppercase mb-1">Tổng giao</div>
                                    <div className="text-2xl font-bold text-gray-800">{stats.totalCreatedMonth}</div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-green-600 text-xs font-bold uppercase mb-1">Hoàn thành</div>
                                    <div className="text-2xl font-bold text-green-600">{stats.completedMonth}</div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="text-red-500 text-xs font-bold uppercase mb-1">Tỷ lệ trễ</div>
                                    <div className="text-2xl font-bold text-red-500">{stats.overdueRate}%</div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow">
                                    <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden shadow-inner border border-gray-100 relative">
                                        <div 
                                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-1000 shadow-[0_0_10px_rgba(74,222,128,0.5)]" 
                                          style={{ width: `${(stats.completedMonth / (stats.totalCreatedMonth || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className="ml-2 text-xs font-bold text-gray-700">{Math.round((stats.completedMonth / (stats.totalCreatedMonth || 1)) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-12">
                    {hasManagementPrivileges ? (
                        <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-800 relative overflow-hidden">
                             <div className="flex items-center justify-between mb-8 relative z-10">
                                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                   <div className="bg-brand-500 p-1.5 rounded-lg"><IconChart className="w-5 h-5 text-white" /></div>
                                   HIỆU SUẤT NĂM
                                </h3>
                                <span className="text-[10px] text-gray-400 font-bold bg-gray-800 px-3 py-1 rounded-full border border-gray-700">TASK/MONTH</span>
                             </div>
                             <div className="relative h-64 w-full flex items-end gap-2 sm:gap-4 z-10 px-2 pt-6">
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                                    <div className="w-full h-px bg-gray-500"></div>
                                    <div className="w-full h-px bg-gray-500"></div>
                                    <div className="w-full h-px bg-gray-500"></div>
                                    <div className="w-full h-px bg-gray-500"></div>
                                </div>
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible" preserveAspectRatio="none">
                                    <defs>
                                        <filter id="glow">
                                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                            <feMerge>
                                                <feMergeNode in="coloredBlur"/>
                                                <feMergeNode in="SourceGraphic"/>
                                            </feMerge>
                                        </filter>
                                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#fbbf24" />
                                            <stop offset="100%" stopColor="#f59e0b" />
                                        </linearGradient>
                                    </defs>
                                    <polyline 
                                        points={chartConfig.polylinePoints} 
                                        fill="none" 
                                        stroke="url(#lineGradient)" 
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        filter="url(#glow)"
                                    />
                                    {chartData.map((item, index) => {
                                       const x = ((index + 0.5) / chartData.length) * 100;
                                       const y = 100 - (item.count / chartConfig.maxVal) * 100;
                                       return (
                                         <circle key={index} cx={`${x}%`} cy={`${y}%`} r="3" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                                       );
                                    })}
                                </svg>
                                {chartData.map((item, index) => (
                                   <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                      <div className="w-full flex flex-col items-center justify-end" style={{ height: `${(item.count / chartConfig.maxVal) * 100}%`, minHeight: '20px' }}>
                                          <span className="mb-1 text-[10px] font-bold text-cyan-300 drop-shadow-sm">{item.count > 0 ? item.count : ''}</span>
                                          <div 
                                            className="w-full max-w-[20px] sm:max-w-[40px] bg-gradient-to-b from-cyan-400 to-blue-600 rounded-t-md relative transition-all duration-500 group-hover:from-cyan-300 group-hover:to-blue-500 h-full"
                                            style={{ minHeight: '4px', boxShadow: '0 4px 10px rgba(6,182,212,0.3)' }}
                                          >
                                              <div className="absolute top-0 left-0 w-full h-1 bg-white/50 rounded-t-md"></div>
                                          </div>
                                      </div>
                                      <span className="text-[10px] sm:text-xs text-gray-400 mt-3 font-medium">{item.label}</span>
                                   </div>
                                ))}
                             </div>
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 relative overflow-hidden">
                             <div className="flex items-center justify-between mb-8 relative z-10">
                                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                   <div className="bg-blue-100 p-1.5 rounded-lg"><IconChart className="w-5 h-5 text-blue-600" /></div>
                                   HIỆU SUẤT NHÂN VIÊN
                                </h3>
                                <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full border border-gray-200">THÁNG NÀY</span>
                             </div>
                             
                             {(() => {
                                const myAttsMonth = attendances.filter(a => a.employeeId === currentUser.id);
                                const myNC = myAttsMonth.reduce((sum, a) => sum + (a.nc || 0), 0);
                                
                                let myLate = 0;
                                let myEarly = 0;
                                myAttsMonth.forEach(a => {
                                  if (a.flag === AttendanceFlag.LATE_EARLY) {
                                    let isLate = false;
                                    let isEarly = false;
                                    if (a.checkIn) {
                                      const [h, m] = a.checkIn.split(':').map(Number);
                                      const checkInTime = h * 60 + m;
                                      isLate = checkInTime > 8 * 60 && !(checkInTime >= 12 * 60 && checkInTime <= 14 * 60);
                                    }
                                    if (a.checkOut) {
                                      const [h, m] = a.checkOut.split(':').map(Number);
                                      const checkOutTime = h * 60 + m;
                                      isEarly = checkOutTime < 18 * 60 && checkOutTime > 8 * 60;
                                    } else if (!a.checkOut) {
                                      isLate = true;
                                    }
                                    if (isLate) myLate++;
                                    if (isEarly) myEarly++;
                                  }
                                });
                                
                                return (
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-green-50 rounded-2xl p-6 border border-green-100 flex flex-col items-center justify-center text-center">
                                            <span className="text-5xl font-black text-green-600 mb-2">{myNC}</span>
                                            <span className="text-sm font-bold text-green-800 uppercase tracking-wider">Ngày làm việc</span>
                                        </div>
                                        <div className="bg-red-50 rounded-2xl p-6 border border-red-100 flex flex-col items-center justify-center text-center">
                                            <span className="text-5xl font-black text-red-600 mb-2">{myLate}/{myEarly}</span>
                                            <span className="text-sm font-bold text-red-800 uppercase tracking-wider">Trễ / Sớm</span>
                                        </div>
                                    </div>
                                );
                             })()}
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <input type="text" placeholder={hasManagementPrivileges ? "Tìm công việc toàn công ty..." : "Tìm trong việc của tôi..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-navy-800 outline-none text-sm bg-white" />
                  <IconSearch className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                </div>
                <button 
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className={`text-white font-bold rounded-xl px-4 flex items-center gap-2 shadow-sm transition-all ${
                     isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'
                  }`}
                  title="Xuất Excel"
                >
                  {isExporting ? (
                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                     <IconDownload className="w-5 h-5" />
                  )}
                  <span className="hidden sm:inline text-sm">{isExporting ? 'Đang xử lý...' : 'Xuất Excel'}</span>
                </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
               <div className="flex-1">
                 <label className="text-[10px] text-gray-500 font-bold px-1 uppercase block mb-1">Từ ngày</label>
                 <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full text-xs text-gray-700 font-medium outline-none p-1 bg-gray-50 rounded" />
               </div>
               <div className="hidden sm:block w-px h-10 bg-gray-200 self-center"></div>
               <div className="flex-1">
                 <label className="text-[10px] text-gray-500 font-bold px-1 uppercase block mb-1">Đến ngày</label>
                 <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full text-xs text-gray-700 font-medium outline-none p-1 bg-gray-50 rounded" />
               </div>
               {(startDate || endDate) && <button onClick={resetFilters} className="p-2 text-gray-400 hover:text-red-500 self-center" title="Xóa lọc">&times;</button>}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {(['ALL', TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, 'OVERDUE'] as const).map((status) => (
                <button key={status} onClick={() => setStatusFilter(status)} className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${statusFilter === status ? 'bg-navy-800 text-white shadow-md transform scale-105' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  {status === 'ALL' ? 'Tất cả' : status === 'OVERDUE' ? 'Quá hạn' : status === TaskStatus.TODO ? 'Chờ xử lý' : status === TaskStatus.IN_PROGRESS ? 'Đang làm' : 'Đã xong'}
                </button>
              ))}
            </div>

            {/* Sub-filters for Completed Tasks */}
            {statusFilter === TaskStatus.COMPLETED && (
              <div className="flex gap-2 animate-fade-in pl-2">
                 <button onClick={() => setCompletionFilter('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${completionFilter === 'ALL' ? 'bg-cyan-100 text-cyan-700 border-cyan-200' : 'bg-white text-gray-500 border-gray-200'}`}>Tất cả</button>
                 <button onClick={() => setCompletionFilter('ON_TIME')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${completionFilter === 'ON_TIME' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200'}`}>Trong hạn</button>
                 <button onClick={() => setCompletionFilter('OVERDUE')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${completionFilter === 'OVERDUE' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-500 border-gray-200'}`}>Quá hạn</button>
              </div>
            )}

            {/* Optimized for desktop with xl:grid-cols-4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  currentUser={currentUser}
                  allUsers={users}
                  onStatusAction={handleStatusClick}
                  onReassign={setReassignTask}
                  onEdit={handleEditTask}
                  onViewImage={setLightboxImage}
                  onViewDetail={() => setViewingTask(task)}
                />
              ))}
            </div>
            {filteredTasks.length === 0 && <div className="text-center py-12 text-gray-500 flex flex-col items-center"><IconBriefcase className="w-12 h-12 text-gray-300 mb-2"/><p>{isLoadingData ? 'Đang tải dữ liệu...' : 'Không tìm thấy công việc phù hợp.'}</p></div>}
          </div>
        )}

        {/* TEAM & PROFILE TABS (No Changes) */}
        {activeTab === 'team' && (
          <div className="space-y-6">
             {!selectedEmployee ? (
                <div className="space-y-8">
                    {/* MODULE 1: BACKLOG LIST */}
                    <div className="space-y-4">
                        <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                           <span>Tiến độ nhân sự</span>
                           <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Sắp xếp theo lượng việc tồn</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {teamStats
                              .filter(stat => stat.user.role === UserRole.EMPLOYEE && stat.totalBacklog > 0)
                              .map(({ user, todo, doing, done, overdue, totalBacklog }, index) => {
                              let borderColor = 'border-gray-200';
                              let numberColor = 'text-gray-700';
                              
                              if (index === 0) { borderColor = 'border-l-rose-500'; numberColor = 'text-rose-600'; }
                              else if (index === 1) { borderColor = 'border-l-orange-500'; numberColor = 'text-orange-600'; }
                              else if (index === 2) { borderColor = 'border-l-yellow-500'; numberColor = 'text-yellow-600'; }
                              else { borderColor = 'border-l-blue-500'; numberColor = 'text-blue-600'; }

                              return (
                                <div key={user.id} onClick={() => setSelectedEmployee(user)} className={`bg-white p-4 rounded-r-xl rounded-l-md shadow-sm border-l-[6px] ${borderColor} cursor-pointer hover:shadow-md transition-all group flex items-center gap-4 relative overflow-hidden`}>
                                    <div className="absolute inset-0 bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10 pl-2">
                                        <div className={`text-4xl font-black ${numberColor} leading-none`}>{totalBacklog}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1">Việc tồn</div>
                                    </div>
                                    <div className="w-px h-10 bg-gray-200 relative z-10 mx-2"></div>
                                    <div className="flex-1 relative z-10 min-w-0">
                                        <div className="font-bold text-gray-800 text-lg truncate group-hover:text-navy-800 transition-colors">{user.name}</div>
                                        <div className="text-xs text-gray-500 font-medium">@{user.username}</div>
                                    </div>
                                    <div className="relative z-10 text-gray-300 group-hover:text-gray-500 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                    </div>
                                </div>
                              );
                          })}
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-200 my-8"></div>

                    {/* MODULE 2: LEADERBOARD */}
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600"><IconTrophy className="w-5 h-5" /></div>
                            <div>
                                <h2 className="font-bold text-gray-800 text-lg">Bảng xếp hạng tháng {new Date().getMonth() + 1}</h2>
                                <p className="text-xs text-gray-500 font-medium">Xếp hạng theo số lượng hoàn thành (Không tính Quản lý)</p>
                            </div>
                        </div>

                        <div className="relative pl-2 max-w-4xl mx-auto">
                           {leaderboardStats.map(({ user, doneMonthCount }, index) => {
                               let bgClass = 'bg-white text-gray-800 border-gray-200';
                               let numberClass = 'text-gray-200';
                               let zIndex = 50 - index;
                               const indent = index * 20;
                               
                               if (index === 0) { 
                                   bgClass = 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-400 shadow-yellow-200'; 
                                   numberClass = 'text-yellow-200';
                               } else if (index === 1) { 
                                   bgClass = 'bg-gradient-to-r from-orange-400 to-orange-500 text-white border-orange-400 shadow-orange-200'; 
                                   numberClass = 'text-orange-200';
                               } else if (index === 2) { 
                                   bgClass = 'bg-gradient-to-r from-rose-400 to-rose-500 text-white border-rose-400 shadow-rose-200'; 
                                   numberClass = 'text-rose-200';
                               } else if (index === 3) {
                                   bgClass = 'bg-gradient-to-r from-blue-400 to-blue-500 text-white border-blue-400 shadow-blue-200'; 
                                   numberClass = 'text-blue-200';
                               } else {
                                   bgClass = 'bg-white text-gray-700 border-gray-200 shadow-sm';
                                   numberClass = 'text-gray-100';
                               }

                               return (
                                   <div 
                                     key={user.id}
                                     onClick={() => setSelectedEmployee(user)}
                                     style={{ marginLeft: `${indent}px`, zIndex: zIndex }}
                                     className={`relative flex items-center p-4 rounded-xl shadow-lg border-b-4 mb-[-12px] transition-transform hover:-translate-y-1 cursor-pointer ${bgClass}`}
                                   >
                                       <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-6xl font-black opacity-30 select-none pointer-events-none ${numberClass}`}>
                                           {index + 1}
                                       </div>
                                       <div className="flex flex-col items-center mr-6 relative z-10 min-w-[50px]">
                                           <span className="text-3xl font-black leading-none">{doneMonthCount}</span>
                                           <span className="text-[9px] uppercase font-bold opacity-80 tracking-wide mt-1">Đã xong</span>
                                       </div>
                                       <div className="w-px h-10 bg-current opacity-30 mr-4 relative z-10"></div>
                                       <div className="flex-1 relative z-10">
                                           <div className="flex items-center gap-2">
                                               <span className="font-bold text-lg truncate max-w-[150px] sm:max-w-md">{user.name}</span>
                                               {index === 0 && <IconTrophy className="w-5 h-5 text-white animate-bounce" />}
                                           </div>
                                           <div className="text-xs opacity-80">@{user.username}</div>
                                       </div>
                                   </div>
                               );
                           })}
                           {leaderboardStats.length === 0 && (
                               <div className="text-gray-400 text-sm italic py-4">Chưa có số liệu xếp hạng tháng này.</div>
                           )}
                        </div>
                    </div>

                    {isDirector && (
                        <>
                            <div className="w-full h-px bg-gray-200 my-8"></div>
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><IconClock className="w-5 h-5" /></div>
                                    <div>
                                        <h2 className="font-bold text-gray-800 text-lg">Theo dõi Chuyên Cần</h2>
                                        <p className="text-xs text-gray-500 font-medium">Thống kê đi trễ / về sớm và số ngày làm việc</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Đi trễ / Về sớm */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            Thống kê đi trễ / về sớm
                                        </h3>
                                        <div className="space-y-3">
                                            {lateLeaderboard.map((stat, index) => (
                                                <div key={stat.user.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-red-600 shadow-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{stat.user.name}</div>
                                                            <div className="text-xs text-gray-500">@{stat.user.username}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xl font-black text-red-600">{stat.lateCount}/{stat.earlyCount}</span>
                                                        <span className="text-[10px] uppercase font-bold text-red-400">Trễ / Sớm</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {lateLeaderboard.length === 0 && (
                                                <div className="text-gray-400 text-sm italic py-4 text-center">Không có nhân sự đi trễ/về sớm.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Chuyên Cần (Số ngày làm việc) */}
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            Chuyên Cần (Ngày công)
                                        </h3>
                                        <div className="space-y-3">
                                            {ncLeaderboard.map((stat, index) => (
                                                <div key={stat.user.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-green-600 shadow-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{stat.user.name}</div>
                                                            <div className="text-xs text-gray-500">@{stat.user.username}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xl font-black text-green-600">{stat.totalNC}</span>
                                                        <span className="text-[10px] uppercase font-bold text-green-400">Ngày</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {ncLeaderboard.length === 0 && (
                                                <div className="text-gray-400 text-sm italic py-4 text-center">Chưa có dữ liệu ngày công.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
             ) : (
                <div className="space-y-6">
                   <button onClick={() => setSelectedEmployee(null)} className="text-sm font-bold text-gray-500 hover:text-navy-800 flex items-center gap-1 group">
                      <div className="p-1 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></div>
                      Quay lại danh sách
                   </button>

                   <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                          <img src={selectedEmployee.avatar} className="w-16 h-16 rounded-full border-2 border-white shadow-sm" />
                          <div>
                              <h2 className="text-xl font-bold text-navy-800">{selectedEmployee.name}</h2>
                              <p className="text-sm text-gray-500">@{selectedEmployee.username}</p>
                          </div>
                      </div>

                      {(() => {
                          const stats = teamStats.find(s => s.user.id === selectedEmployee.id);
                          if (!stats) return null;
                          return (
                              <div className="grid grid-cols-4 gap-2">
                                  <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center border border-gray-100">
                                      <span className="text-xl font-bold text-gray-700">{stats.todo}</span>
                                      <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">Chờ</span>
                                  </div>
                                  <div className="bg-blue-50 rounded-xl p-3 flex flex-col items-center border border-blue-100">
                                      <span className="text-xl font-bold text-blue-700">{stats.doing}</span>
                                      <span className="text-[10px] uppercase font-bold text-blue-400 mt-1">Làm</span>
                                  </div>
                                  <div className="bg-green-50 rounded-xl p-3 flex flex-col items-center border border-green-100">
                                      <span className="text-xl font-bold text-green-700">{stats.done}</span>
                                      <span className="text-[10px] uppercase font-bold text-green-400 mt-1">Xong</span>
                                  </div>
                                  <div className="bg-red-50 rounded-xl p-3 flex flex-col items-center border border-red-100">
                                      <span className="text-xl font-bold text-red-700">{stats.overdue}</span>
                                      <span className="text-[10px] uppercase font-bold text-red-400 mt-1">Trễ</span>
                                  </div>
                              </div>
                          );
                      })()}
                   </div>
                   
                   <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Danh sách công việc</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {selectedEmployeeTasks.map(task => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          currentUser={currentUser}
                          allUsers={users}
                          onStatusAction={handleStatusClick}
                          onReassign={setReassignTask}
                          onEdit={handleEditTask}
                          onViewImage={setLightboxImage}
                          onViewDetail={() => setViewingTask(task)}
                        />
                      ))}
                   </div>
                   {selectedEmployeeTasks.length === 0 && (
                       <div className="text-center py-10 text-gray-400 text-sm italic">
                           Nhân viên này chưa có công việc nào.
                       </div>
                   )}
                </div>
             )}
          </div>
        )}

        {activeTab === 'profile' && (
           <div className="p-2 space-y-6 max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 flex flex-col items-center relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-24 bg-navy-800"></div>
                 <div className="relative z-10 flex flex-col items-center w-full">
                   <div className="relative">
                      <img src={currentUser.avatar} className="w-28 h-28 rounded-full mb-4 object-cover border-4 border-white shadow-md bg-white" />
                      <button 
                        onClick={() => profileInputRef.current?.click()} 
                        className="absolute bottom-4 right-0 bg-white p-2 rounded-full shadow-md border border-gray-200 text-gray-600 hover:text-navy-800 transition-colors"
                        title="Đổi ảnh đại diện"
                      >
                         <IconCamera className="w-5 h-5" />
                      </button>
                      <input 
                         type="file" 
                         ref={profileInputRef} 
                         onChange={handleUpdateAvatar} 
                         className="hidden" 
                         accept="image/*" 
                      />
                   </div>
                   
                   <h2 className="text-2xl font-bold text-gray-800">{currentUser.name}</h2>
                   <p className="text-sm font-medium text-gray-500 mb-6">{currentUser.companyName} • {isDirector ? 'Giám Đốc' : isManager ? 'Quản lý' : isWorker ? 'Công nhân' : 'Nhân viên'}</p>
                   
                   <div className="flex gap-4 w-full max-w-md">
                      <button onClick={() => setShowChangePassModal(true)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-2 shadow-sm"><IconKey className="w-4 h-4" /> Đổi mật khẩu</button>
                      <button onClick={handleLogout} className="flex-1 py-3 bg-red-50 text-red-600 border border-red-100 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm"><IconLogOut className="w-4 h-4" /> Đăng xuất</button>
                   </div>
                 </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><IconAlert className="w-5 h-5 text-orange-500"/> Cài đặt Thông báo</h3>
                   <div className="space-y-3">
                     <button onClick={requestNotificationAccess} className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all">
                       <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${notificationPermission === 'granted' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{notificationPermission === 'granted' ? <IconCheck className="w-5 h-5" /> : <IconAlert className="w-5 h-5" />}</div><div className="text-left"><div className="font-bold text-sm text-gray-800">Quyền Thông báo & Badge</div><div className="text-xs text-gray-500">{notificationPermission === 'granted' ? 'Đã kích hoạt' : 'Chưa kích hoạt'}</div></div></div>
                     </button>
                     <button onClick={testBadge} className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all">
                       <div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-full text-blue-600"><IconCheck className="w-5 h-5" /></div><div className="text-left"><div className="font-bold text-sm text-gray-800">Kiểm tra Badge Icon</div><div className="text-xs text-gray-500">Test hiển thị số đỏ trên icon</div></div></div>
                     </button>
                   </div>
                </div>

                {/* Chỉ Giám Đốc mới thấy mục quản lý nhân sự và server */}
                {isDirector && (
                  <>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                       <UserManagement currentUser={currentUser} companyUsers={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                       <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><IconDatabase className="w-5 h-5 text-blue-500"/> Quản trị Máy chủ</h3>
                       <div className="space-y-3">
                         <button 
                           onClick={() => setShowUpdateConfigModal(true)}
                           className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all"
                         >
                           <div className="flex items-center gap-3"><div className="bg-blue-100 p-2 rounded-full text-blue-600"><IconDatabase className="w-5 h-5" /></div><div className="text-left"><div className="font-bold text-sm text-gray-800">Đổi cấu hình Firebase</div><div className="text-xs text-gray-500">Cập nhật nơi lưu dữ liệu</div></div></div>
                         </button>
                       </div>
                    </div>
                  </>
                )}
              </div>
           </div>
        )}

        {activeTab === 'partners' && hasManagementPrivileges && (
          <PartnersTab currentUser={currentUser} />
        )}

        {activeTab === 'customers' && hasManagementPrivileges && (
          <CustomersTab currentUser={currentUser} />
        )}

        {activeTab === 'finance' && hasManagementPrivileges && (
          <FinanceTab currentUser={currentUser} />
        )}

        {activeTab === 'salary' && (
          <div className="space-y-4">
            {isWorker && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
                <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                    Chào <span className="text-navy-800 font-bold text-base">
                      {currentUser.name}
                    </span>, chúc bạn một ngày làm việc hiệu quả!
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    ref={attendanceInputRef}
                    onChange={handleAttendanceFileChange}
                  />
                  <button
                    disabled={isProcessingAttendance || isAppLocked}
                    onClick={() => {
                      if (isAppLocked) {
                        setShowPaywall(true);
                        return;
                      }
                      if (!todayAttendance) {
                        if (missingCheckOuts.length > 0) {
                          setShowMissingCheckOutModal(true);
                        } else {
                          attendanceInputRef.current?.click();
                        }
                      } else if (!todayAttendance.checkOut) {
                        handleCheckOutWithoutPhoto();
                      }
                    }}
                    className={`flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 w-full sm:w-auto ${
                      isProcessingAttendance ? 'bg-gray-400 cursor-not-allowed' :
                      !todayAttendance ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                      !todayAttendance.checkOut ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                      'bg-green-600 text-white opacity-80 cursor-default'
                    }`}
                  >
                    {isProcessingAttendance ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <IconCamera className="w-5 h-5" />
                    )}
                    {!todayAttendance ? 'Chấm Công' : 
                     !todayAttendance.checkOut ? 'Kết Thúc' : 'Đã Hoàn Thành'}
                  </button>
                  {todayAttendance && (
                    <div className="text-[10px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 shadow-inner flex gap-3">
                      {todayAttendance.checkIn && <div className="flex flex-col"><span>Vào:</span><span className="font-bold text-blue-600">{todayAttendance.checkIn}</span></div>}
                      {todayAttendance.checkOut && <div className="flex flex-col border-l pl-3"><span>Ra:</span><span className="font-bold text-orange-600">{todayAttendance.checkOut}</span></div>}
                    </div>
                  )}
                </div>
              </div>
            )}
            <SalaryTab currentUser={currentUser} />
          </div>
        )}

        {activeTab === 'inventory' && isDirector && (
          <InventoryTab currentUser={currentUser} isLocked={isAppLocked} />
        )}

        {activeTab === 'information' && hasManagementPrivileges && (
          <InformationTab currentUser={currentUser} />
        )}
      </main>

      <PaywallModal 
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        company={currentCompany!}
        config={billingConfig!}
      />

      {/* Director và Manager đều thấy nút tạo Task */}
      {hasManagementPrivileges && activeTab !== 'partners' && activeTab !== 'customers' && activeTab !== 'finance' && activeTab !== 'salary' && (
        <button onClick={() => setShowCreateModal(true)} className="fixed bottom-24 right-6 bg-navy-800 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:bg-navy-900 transition-all z-20 border-4 border-white">
          <IconPlus className="w-7 h-7" />
        </button>
      )}

      {/* FOOTER NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-20 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.02)] overflow-x-auto">
        {!isWorker && !isContractor && (
          <>
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<IconHome />} label="Tổng quan" />
            <NavButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<IconList />} label="Công việc" badge={myPendingTaskCount > 0 ? myPendingTaskCount : undefined} />
          </>
        )}
        {isContractor && (
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<IconHome />} label="Tổng quan" />
        )}
        {hasManagementPrivileges && !isContractor && (
          <>
            <NavButton active={activeTab === 'partners'} onClick={() => setActiveTab('partners')} icon={<IconBriefcase />} label="Đối tác" />
            <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<IconBuilding />} label="Công trình" />
            <NavButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<IconDollarSign />} label="Tài chính" />
          </>
        )}
        {!isContractor && <NavButton active={activeTab === 'salary'} onClick={() => setActiveTab('salary')} icon={<IconWallet />} label="Lương" />}
        {isDirector && <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<IconDatabase />} label="Kho" />}
        {!isWorker && !isContractor && (
          <NavButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<IconUsers />} label="Nhân sự" />
        )}
        {hasManagementPrivileges && !isContractor && (
          <NavButton active={activeTab === 'information'} onClick={() => setActiveTab('information')} icon={<IconDatabase />} label="Thông tin" />
        )}
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<IconUser />} label="Cá nhân" />
      </nav>

      {/* MODALS */}
      {showCreateModal && <CreateTaskModal currentUser={currentUser} assignableUsers={assignableUsers} onClose={() => setShowCreateModal(false)} onCreate={createTask} isLocked={isAppLocked} />}
      {editingTask && <CreateTaskModal currentUser={currentUser} assignableUsers={assignableUsers} onClose={() => setEditingTask(null)} onCreate={async () => {}} onEdit={submitEditTask} initialData={editingTask} isLocked={isAppLocked} />}
      
      {/* Detail Modal */}
      {viewingTask && <TaskDetailModal task={viewingTask} users={users} onClose={() => setViewingTask(null)} onEdit={hasManagementPrivileges ? (t) => { setViewingTask(null); handleEditTask(t); } : undefined} />}

      {/* Missing Check-out Modal */}
      {showMissingCheckOutModal && missingCheckOuts.length > 0 && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all scale-100">
              <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
                <IconAlert className="w-5 h-5" />
                Quên Check-out
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Bạn đã quên check-out vào ngày <span className="font-bold">{missingCheckOuts[0].date}</span>. Vui lòng nhập giờ về thực tế và lý do để tiếp tục chấm công.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Giờ về thực tế (nếu có tăng ca)</label>
                <input
                  type="time"
                  value={missingOutTime}
                  onChange={(e) => setMissingOutTime(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <textarea
                value={missingOutReason}
                onChange={(e) => setMissingOutReason(e.target.value)}
                placeholder="Nhập lý do quên check-out..."
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-24 mb-6 text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMissingCheckOutModal(false);
                    setMissingOutReason('');
                    setMissingOutTime('18:00');
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    if (!missingOutReason.trim()) {
                      alert("Vui lòng nhập lý do.");
                      return;
                    }
                    if (!missingOutTime) {
                      alert("Vui lòng nhập giờ về thực tế.");
                      return;
                    }
                    try {
                      const att = missingCheckOuts[0];
                      const updatedAtt = {
                        ...att,
                        checkOut: missingOutTime + ":00",
                        missingOutReason: missingOutReason.trim()
                      };
                      const stats = calculateAttendanceStats(updatedAtt, salaryConfig);
                      updatedAtt.nc = stats.nc;
                      updatedAtt.tc = stats.tc;
                      updatedAtt.otHours = stats.otHours;
                      updatedAtt.otStatus = stats.otStatus;
                      updatedAtt.flag = stats.flag;
                      
                      await apiUpdateAttendance(updatedAtt);
                      setMissingCheckOuts(prev => prev.slice(1));
                      setMissingOutReason('');
                      setMissingOutTime('18:00');
                      if (missingCheckOuts.length <= 1) {
                        setShowMissingCheckOutModal(false);
                        attendanceInputRef.current?.click();
                      }
                    } catch (err) {
                      console.error("Error updating missing checkout reason:", err);
                      alert("Có lỗi xảy ra. Vui lòng thử lại.");
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                >
                  Xác nhận
                </button>
              </div>
           </div>
        </div>
      )}

      {showCompleteModal && completingTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all scale-100">
              <h3 className="text-lg font-bold text-navy-800 mb-2">Xác nhận hoàn thành</h3>
              <p className="text-sm text-gray-500 mb-6">Bạn có muốn tải ảnh minh chứng (kết quả công việc) lên không?</p>
              <div className="mb-6">
                 <label className="block w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-navy-500 hover:bg-gray-50 transition-colors group">
                    {completionFile ? (
                       <div className="relative">
                          <img src={URL.createObjectURL(completionFile)} className="h-32 mx-auto object-contain rounded shadow-sm" />
                          <button onClick={(e) => { e.preventDefault(); setCompletionFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><IconX className="w-3 h-3" /></button>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center text-gray-400 group-hover:text-navy-600">
                          <IconImage className="w-10 h-10 mb-2" /><span className="text-sm font-bold">Chọn ảnh (Tùy chọn)</span>
                       </div>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && setCompletionFile(e.target.files[0])} />
                 </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                <button onClick={confirmCompleteTask} disabled={isSubmittingComplete} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl flex justify-center items-center hover:bg-green-700 shadow-lg shadow-green-200">
                  {isSubmittingComplete ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Hoàn thành'}
                </button>
              </div>
           </div>
        </div>
      )}

      {showChangePassModal && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
               <h3 className="text-lg font-bold text-navy-800 mb-4">Đổi mật khẩu đăng nhập</h3>
               <p className="text-sm text-gray-500 mb-6">Nhập mật khẩu mới cho tài khoản của bạn.</p>
               <input type="text" value={newSelfPass} onChange={(e) => setNewSelfPass(e.target.value)} placeholder="Mật khẩu mới" className="w-full p-3.5 border border-gray-300 rounded-xl mb-6 focus:ring-2 focus:ring-navy-800 outline-none" />
               <div className="flex gap-3">
                  <button onClick={() => setShowChangePassModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                  <button onClick={handleChangeSelfPass} disabled={!newSelfPass} className="flex-1 py-3 bg-navy-800 text-white font-bold rounded-xl hover:bg-navy-900 shadow-lg disabled:opacity-50">Lưu</button>
               </div>
            </div>
         </div>
      )}

      {lightboxImage && (
         <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
            <img src={lightboxImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            <button className="absolute top-6 right-6 text-white bg-white/20 hover:bg-white/40 p-2 rounded-full backdrop-blur-sm transition-colors"><IconX className="w-6 h-6" /></button>
         </div>
      )}

      {/* Update Config Modal */}
      {showUpdateConfigModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-navy-800 mb-2 flex items-center gap-2">
              <IconDatabase className="w-6 h-6 text-blue-500" /> Cập nhật cấu hình Firebase
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Nhập cấu hình JSON mới cho công ty <strong>{currentUser.companyName}</strong>. Dữ liệu cũ sẽ không bị mất, ứng dụng chỉ chuyển hướng kết nối sang Firebase mới.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cấu hình JSON mới</label>
                <textarea
                  rows={6}
                  value={newConfigJson}
                  onChange={(e) => setNewConfigJson(e.target.value)}
                  placeholder='{ "apiKey": "...", "projectId": "..." }'
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowUpdateConfigModal(false);
                  setNewConfigJson('');
                }} 
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                disabled={isUpdatingConfig}
              >
                Hủy
              </button>
              <button 
                onClick={async () => {
                  if (!newConfigJson.trim()) {
                    alert('Vui lòng nhập cấu hình JSON');
                    return;
                  }
                  setIsUpdatingConfig(true);
                  try {
                    await updateCompanyConfig(currentUser.companyName, newConfigJson);
                    alert('Cập nhật cấu hình thành công! Ứng dụng sẽ tải lại.');
                    window.location.reload();
                  } catch (error: any) {
                    alert(error.message || 'Lỗi khi cập nhật cấu hình');
                  } finally {
                    setIsUpdatingConfig(false);
                  }
                }} 
                disabled={isUpdatingConfig || !newConfigJson.trim()} 
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-colors flex justify-center items-center"
              >
                {isUpdatingConfig ? 'Đang cập nhật...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
           <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-navy-800 mb-4">Giao lại việc cho</h3>
              <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
                 {assignableUsers.map(user => (
                   <button key={user.id} onClick={() => handleReassign(user.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors">
                     <img src={user.avatar} className="w-10 h-10 rounded-full border border-gray-200" />
                     <div className="text-left"><div className="font-bold text-gray-800">{user.name}</div><div className="text-xs text-gray-500">@{user.username}</div></div>
                   </button>
                 ))}
              </div>
              <button onClick={() => setReassignTask(null)} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy bỏ</button>
           </div>
        </div>
      )}
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all relative ${active ? 'text-navy-800 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
    <div className="relative">
       {React.cloneElement(icon, { className: 'w-6 h-6', strokeWidth: active ? 2.5 : 2 })}
       {badge && <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse border-2 border-white shadow-sm">{badge > 9 ? '9+' : badge}</span>}
    </div>
    <span className="text-[10px] tracking-wide">{label}</span>
  </button>
);

interface TaskCardProps {
  task: Task;
  currentUser: User;
  allUsers: User[];
  onStatusAction: (task: Task) => void;
  onReassign: (task: Task) => void;
  onEdit: (task: Task) => void;
  onViewImage: (url: string) => void;
  onViewDetail: () => void; 
  isDashboard?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, currentUser, allUsers, onStatusAction, onReassign, onEdit, onViewImage, onViewDetail, isDashboard }) => {
  const overdue = task.status !== TaskStatus.COMPLETED && isOverdue(task.dueDate);
  const dueSoon = task.status !== TaskStatus.COMPLETED && !overdue && isDueSoon(task.dueDate, 3);
  
  // Logic check completion overdue
  const isCompletedLate = task.status === TaskStatus.COMPLETED && task.completionImage && task.completedAt && new Date(task.completedAt) > new Date(task.dueDate);
  
  // Checks for permissions inside card
  const isDirector = currentUser.role === UserRole.DIRECTOR;
  const isManager = currentUser.role === UserRole.MANAGER;
  const hasManagementPrivileges = isDirector || isManager;
  const isAssignee = currentUser.id === task.assigneeId;

  // Director và Manager có thể edit status và content
  const canEditStatus = hasManagementPrivileges || isAssignee;
  const canEditContent = hasManagementPrivileges;
  
  const showAction = isDashboard ? isAssignee : canEditStatus;
  
  const priorityColors = {
    [TaskPriority.LOW]: 'bg-gray-100 text-gray-600',
    [TaskPriority.MEDIUM]: 'bg-blue-50 text-blue-600',
    [TaskPriority.HIGH]: 'bg-orange-50 text-orange-600',
    [TaskPriority.URGENT]: 'bg-red-50 text-red-600',
  };

  const assignee = allUsers.find(u => u.id === task.assigneeId);
  const creator = allUsers.find(u => u.id === task.creatorId);
  const deadlineInfo = getDeadlineInfo(task.dueDate, task.status);

  // Card Background Color Logic
  let cardBgClass = 'bg-white border-gray-100';
  if (task.status === TaskStatus.COMPLETED) {
      cardBgClass = 'bg-green-50/50 border-green-100';
  } else if (overdue) {
      cardBgClass = 'bg-red-50 border-red-200';
  } else if (dueSoon) {
      cardBgClass = 'bg-orange-50 border-orange-200';
  }

  return (
    <div 
      className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col cursor-pointer ${cardBgClass}`}
      onClick={onViewDetail} 
    >
      {overdue && <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold z-10 shadow-sm">Quá hạn</div>}
      
      <div className="flex justify-between items-start mb-3">
        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${priorityColors[task.priority]}`}>{task.priority}</span>
        <div className="flex flex-col items-end gap-1">
          {deadlineInfo && <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${deadlineInfo.className}`}>{deadlineInfo.icon && <IconAlert className="w-3 h-3" />}{deadlineInfo.text}</span>}
        </div>
      </div>

      <div className="flex justify-between items-start mb-2">
         <h3 className="font-bold text-gray-900 text-base leading-tight flex-1 group-hover:text-navy-800 transition-colors">{task.title}</h3>
         {canEditContent && (
             <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="text-gray-400 hover:text-navy-600 p-1 transition-colors"><IconEdit className="w-4 h-4" /></button>
         )}
      </div>
      
      <p className="text-sm text-gray-600 line-clamp-3 mb-4 whitespace-pre-line flex-1">{task.description}</p>
      
      {/* Attachments Preview (Max 3) */}
      {task.attachments && task.attachments.length > 0 && (
         <div className="flex gap-2 overflow-x-auto pb-2 mb-3 hide-scrollbar" onClick={(e) => e.stopPropagation()}>
            {task.attachments.slice(0, 4).map((url, i) => (
               <img key={i} src={url} onClick={() => onViewImage(url)} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer border border-gray-200 hover:opacity-80 transition-opacity" />
            ))}
            {task.attachments.length > 4 && <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-500 font-bold border border-gray-200">+{task.attachments.length - 4}</div>}
         </div>
      )}

      {/* Completion Proof */}
      {task.status === TaskStatus.COMPLETED && task.completionImage && (
         <div className="mb-4 bg-white/60 p-2.5 rounded-xl border border-green-200 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
             <img src={task.completionImage} onClick={() => onViewImage(task.completionImage!)} className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform" />
             <span className="text-xs text-green-700 font-bold">Minh chứng hoàn thành</span>
         </div>
      )}

      <div className="mb-4 text-xs bg-white/50 p-3 rounded-xl text-gray-600 border border-gray-100/50">
         <div className="flex justify-between mb-1.5"><span>Ngày giao:</span><span className="font-bold text-gray-800">{formatDateTime(task.createdAt)}</span></div>
         <div className="flex justify-between"><span>Hạn chót:</span><span className={`font-bold ${overdue ? 'text-red-600' : 'text-gray-800'}`}>{formatDateTime(task.dueDate)}</span></div>
      </div>
      
      <div className="flex items-start justify-between mb-4 border-b border-gray-100 pb-3">
         {creator && (
            <div className="flex flex-col gap-0.5" title="Người giao việc">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Người giao</span>
                <span className="text-xs text-gray-700 font-medium break-words max-w-[100px]">{creator.name}</span>
            </div>
         )}
         <div className="text-gray-300 text-xs self-center">→</div>
         {assignee && (
            <div className="flex flex-col gap-0.5 text-right items-end" title="Người thực hiện">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Người nhận</span>
                <span className="text-xs text-blue-700 font-bold break-words max-w-[100px]">{assignee.name}</span>
            </div>
         )}
      </div>

      <div className="flex items-center justify-between mt-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
           <span className={`w-2.5 h-2.5 rounded-full ${task.status === TaskStatus.COMPLETED ? 'bg-green-500' : task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
           <span className={`text-xs font-bold ${task.status === TaskStatus.COMPLETED ? 'text-green-600' : task.status === TaskStatus.IN_PROGRESS ? 'text-blue-600' : 'text-gray-500'}`}>
              {task.status === TaskStatus.COMPLETED ? 'Đã xong' : task.status === TaskStatus.IN_PROGRESS ? 'Đang làm' : 'Chờ xử lý'}
           </span>
           {/* Completion Time Status Badge */}
           {task.status === TaskStatus.COMPLETED && (
               <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${isCompletedLate ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                   {isCompletedLate ? 'Trễ hạn' : 'Đúng hạn'}
               </span>
           )}
        </div>

        <div className="flex gap-2">
          {hasManagementPrivileges && task.status !== TaskStatus.COMPLETED && (
             <button onClick={() => onReassign(task)} className="text-xs font-bold text-gray-500 hover:text-navy-600 bg-white hover:bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm transition-all" title="Giao lại"><IconShare className="w-3.5 h-3.5" /></button>
          )}
          {showAction && task.status !== TaskStatus.COMPLETED && (
            <button
              onClick={() => onStatusAction(task)}
              className="text-xs font-bold bg-navy-50 hover:bg-navy-100 text-navy-800 px-4 py-2 rounded-lg border border-navy-100 transition-colors shadow-sm"
            >
              {task.status === TaskStatus.TODO ? 'Bắt đầu' : 'Hoàn thành'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
