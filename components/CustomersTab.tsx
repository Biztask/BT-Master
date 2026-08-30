import React, { useState, useEffect } from 'react';
import MobileTabNavigation from './MobileTabNavigation';
import { User, Customer, PaymentCategory, CustomerTransaction, FinanceCategory, RowTag } from '../types';
import { 
  subscribeToCustomers, 
  subscribeToPaymentCategories, 
  subscribeToCustomerTransactions,
  subscribeToFinanceCategories,
  subscribeToRowTags,
  apiAddCustomer,
  apiAddPaymentCategory,
  apiAddCustomerTransaction,
  apiDeleteCustomerTransaction,
  apiUpdateCustomer,
  apiDeleteCustomer,
  apiUpdatePaymentCategory,
  apiDeletePaymentCategory,
  apiUpdateCustomerTransaction
} from '../services/storageService';
import { IconPlus, IconX, IconEdit, IconTrash, IconDownload } from './Icons';
import RowTagSelector from './RowTagSelector';
import * as XLSX from 'xlsx';

const InlineCurrencyInput = ({ value, onBlur }: { value: number | undefined | null, onBlur: (val: number | undefined) => void }) => {
  const [internalValue, setInternalValue] = useState((value !== undefined && value !== null) ? value.toString() : '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setInternalValue((value !== undefined && value !== null) ? value.toString() : '');
    }
  }, [value, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(internalValue.replace(/,/g, ''), 10);
    if (isNaN(parsed)) {
      onBlur(undefined);
    } else {
      onBlur(parsed);
    }
  };

  const displayValue = isEditing 
    ? internalValue 
    : ((value !== undefined && value !== null) ? new Intl.NumberFormat('vi-VN').format(value) : '');

  return (
    <input
      type="text"
      className="w-full text-right bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none px-1"
      value={displayValue}
      onFocus={() => setIsEditing(true)}
      onChange={(e) => {
        if (isEditing) {
          const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
          if (rawValue) {
             setInternalValue(new Intl.NumberFormat('en-US').format(parseInt(rawValue, 10)));
          } else {
             setInternalValue('');
          }
        }
      }}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      placeholder="Nhập..."
    />
  );
};

interface CustomersTabProps {
  currentUser: User;
}

export default function CustomersTab({ currentUser }: CustomersTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [rowTags, setRowTags] = useState<RowTag[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

  // Detail view filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Summary view filters
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');
  const [summarySearchTerm, setSummarySearchTerm] = useState('');
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

  const [editingTransaction, setEditingTransaction] = useState<CustomerTransaction | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingCategory, setEditingCategory] = useState<PaymentCategory | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'debts' | 'customers' | 'categories'>('debts');
  const [activeTableTab, setActiveTableTab] = useState<'PROJECT' | 'GOODS'>('PROJECT');

  useEffect(() => {
    const unsubCustomers = subscribeToCustomers(currentUser.companyId, setCustomers);
    const unsubCategories = subscribeToPaymentCategories(currentUser.companyId, setCategories);
    const unsubTransactions = subscribeToCustomerTransactions(currentUser.companyId, setTransactions);
    const unsubFinanceCategories = subscribeToFinanceCategories(currentUser.companyId, setFinanceCategories);
    const unsubRowTags = subscribeToRowTags(currentUser.companyId, 'CUSTOMER', setRowTags);

    return () => {
      unsubCustomers();
      unsubCategories();
      unsubTransactions();
      unsubFinanceCategories();
      unsubRowTags();
    };
  }, [currentUser.companyId]);

  // Calculate summary
  const allCustomerSummaries = customers
    .filter(c => {
      if (summaryStartDate && c.startDate && c.startDate < summaryStartDate) return false;
      if (summaryEndDate && c.startDate && c.startDate > summaryEndDate) return false;
      if (summaryStatusFilter !== 'ALL') {
        const isCompleted = c.status === 'COMPLETED';
        if (summaryStatusFilter === 'COMPLETED' && !isCompleted) return false;
        if (summaryStatusFilter === 'IN_PROGRESS' && isCompleted) return false;
      }
      return true;
    })
    .map(customer => {
    let allTx = transactions.filter(t => t.customerId === customer.id);
    
    // Calculate debt before start date (Dư nợ đầu kỳ)
    let periodInitialDebt = customer.actualValue !== undefined && customer.actualValue !== null 
      ? customer.actualValue 
      : customer.initialDebt;

    // Filter transactions in the period
    let periodTx = allTx;

    const totalPurchase = periodTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
    const totalPaid = periodTx.reduce((sum, t) => sum + t.paidAmount, 0);
    const remainingDebt = periodInitialDebt + totalPurchase - totalPaid;

    return {
      ...customer,
      periodInitialDebt,
      totalPurchase,
      totalPaid,
      remainingDebt
    };
  }).filter(c => c.name.toLowerCase().includes(summarySearchTerm.toLowerCase()))
    .sort((a, b) => b.remainingDebt - a.remainingDebt);

  const projectSummaries = allCustomerSummaries.filter(c => c.type === 'PROJECT' || !c.type);
  const goodsSummaries = allCustomerSummaries.filter(c => c.type === 'GOODS');

  const totalSummaryPurchase = allCustomerSummaries.reduce((sum, c) => sum + c.periodInitialDebt + c.totalPurchase, 0);
  const totalSummaryPaid = allCustomerSummaries.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalSummaryDebt = allCustomerSummaries.reduce((sum, c) => sum + c.remainingDebt, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const exportSummaryToExcel = () => {
    const data = allCustomerSummaries.map((c, index) => ({
      'STT': index + 1,
      'Ngày BĐ': c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '',
      'Tên Công Trình': c.name,
      'SĐT': c.phone,
      'Địa Chỉ': c.address,
      'Giá Trị HĐ': c.initialDebt,
      'Giá Trị TT': c.actualValue !== undefined ? c.actualValue : '',
      'Tiền Mua': c.totalPurchase,
      'Đã Trả': c.totalPaid,
      'Còn Nợ': c.remainingDebt
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CongNoKhachHang");
    XLSX.writeFile(wb, `CongNoKhachHang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummaryTable = () => {
    const renderTable = (data: any[], totalPurchase: number, totalPaid: number, totalDebt: number) => (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="overflow-x-auto overflow-y-auto max-h-[50vh]">
          <table className="w-full text-[11px] md:text-sm text-left relative min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">STT</th>
                <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Ngày BĐ</th>
                <th className="px-2 md:px-4 py-3">Tên Công Trình</th>
                <th className="px-2 md:px-4 py-3">SĐT</th>
                <th className="px-2 md:px-4 py-3">Địa Chỉ</th>
                <th className="px-2 md:px-4 py-3 text-right">Giá Trị HĐ</th>
                <th className="px-2 md:px-4 py-3 text-right">Giá Trị TT</th>
                <th className="px-2 md:px-4 py-3 text-right">Đã Trả</th>
                <th className="px-2 md:px-4 py-3 text-right">Còn Nợ</th>
                <th className="px-2 md:px-4 py-3 text-center">Hoàn Thành</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-blue-50/80 font-bold text-blue-900 border-b-2 border-blue-200">
                <td colSpan={5} className="px-2 md:px-4 py-3 text-center sticky left-0 z-10 bg-blue-50/80">Tổng cộng</td>
                <td className="px-2 md:px-4 py-3 text-right">{formatCurrency(totalPurchase)}</td>
                <td className="px-2 md:px-4 py-3 text-right"></td>
                <td className="px-2 md:px-4 py-3 text-right text-green-700">{formatCurrency(totalPaid)}</td>
                <td className="px-2 md:px-4 py-3 text-right text-red-700">{formatCurrency(totalDebt)}</td>
                <td></td>
              </tr>
              {data.map((c, index) => {
                return (
                <tr 
                  key={c.id} 
                  className={`hover:bg-blue-50 cursor-pointer transition-colors ${c.status === 'COMPLETED' ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedCustomerId(c.id)}
                >
                  <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 z-10 bg-white">{index + 1}</td>
                  <td className="px-2 md:px-4 py-3 text-gray-600 sticky left-8 md:left-12 z-10 bg-white">{c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : ''}</td>
                  <td className="px-2 md:px-4 py-3 font-medium text-gray-900 bg-white">{c.name}</td>
                  <td className="px-2 md:px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-2 md:px-4 py-3 text-gray-600">{c.address}</td>
                  <td className="px-2 md:px-4 py-3 text-right text-gray-600">{formatCurrency(c.initialDebt + c.totalPurchase)}</td>
                  <td className="px-2 md:px-4 py-3 text-right min-w-[120px]" onClick={e => e.stopPropagation()}>
                    <InlineCurrencyInput 
                      value={c.actualValue} 
                      onBlur={(val) => {
                        const { periodInitialDebt, totalPurchase, totalPaid, remainingDebt, ...trueCustomer } = c;
                        apiUpdateCustomer({
                          ...trueCustomer,
                          actualValue: val
                        });
                      }} 
                    />
                  </td>
                  <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(c.totalPaid)}</td>
                  <td className="px-2 md:px-4 py-3 text-right font-bold text-red-600">{formatCurrency(c.remainingDebt)}</td>
                  <td className="px-2 md:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 cursor-pointer accent-green-600"
                      checked={c.status === 'COMPLETED'}
                      onChange={(e) => {
                        const { periodInitialDebt, totalPurchase, totalPaid, remainingDebt, ...trueCustomer } = c;
                        apiUpdateCustomer({
                          ...trueCustomer,
                          status: e.target.checked ? 'COMPLETED' : 'IN_PROGRESS'
                        });
                      }}
                    />
                  </td>
                </tr>
              )})}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Chưa có đối tượng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

    const projectPurchase = projectSummaries.reduce((sum, c) => sum + c.periodInitialDebt + c.totalPurchase, 0);
    const projectPaid = projectSummaries.reduce((sum, c) => sum + c.totalPaid, 0);
    const projectDebt = projectSummaries.reduce((sum, c) => sum + c.remainingDebt, 0);

    const goodsPurchase = goodsSummaries.reduce((sum, c) => sum + c.periodInitialDebt + c.totalPurchase, 0);
    const goodsPaid = goodsSummaries.reduce((sum, c) => sum + c.totalPaid, 0);
    const goodsDebt = goodsSummaries.reduce((sum, c) => sum + c.remainingDebt, 0);

    return (
      <div className="space-y-4">
        {/* Lọc Controls */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Tìm kiếm:</label>
              <input 
                type="text" 
                placeholder="Tên công trình..."
                value={summarySearchTerm}
                onChange={e => setSummarySearchTerm(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500 w-48"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Từ ngày:</label>
              <input 
                type="date" 
                value={summaryStartDate}
                onChange={e => setSummaryStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Đến ngày:</label>
              <input 
                type="date" 
                value={summaryEndDate}
                onChange={e => setSummaryEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {(summaryStartDate || summaryEndDate || summarySearchTerm) && (
              <button 
                onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); setSummarySearchTerm(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Xóa lọc
              </button>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Trạng thái:</label>
              <select
                value={summaryStatusFilter}
                onChange={e => setSummaryStatusFilter(e.target.value as any)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="ALL">Tất cả</option>
                <option value="IN_PROGRESS">Chưa hoàn thành</option>
                <option value="COMPLETED">Đã hoàn thành</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                if(window.confirm('Bạn có chắc chắn muốn xóa toàn bộ công trình/hàng hóa Đã hoàn thành khỏi hệ thống tài chính?')) {
                  const completedCustomers = allCustomerSummaries.filter(c => c.status === 'COMPLETED');
                  for (const c of completedCustomers) {
                    await apiDeleteCustomer(c.id, currentUser.companyId);
                  }
                }
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <IconTrash className="w-4 h-4" /> Xóa CT Hoàn Thành
            </button>
            <button 
              onClick={exportSummaryToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <IconDownload className="w-4 h-4" /> Xuất Excel
            </button>
          </div>
        </div>

        <div className="p-4 bg-red-50 border border-red-100 flex justify-between items-center rounded-xl mb-4">
          <span className="font-bold text-red-800 text-lg">TỔNG CỘNG NỢ TẤT CẢ:</span>
          <span className="font-bold text-red-600 text-xl">{formatCurrency(totalSummaryDebt)}</span>
        </div>

        <div className="flex gap-2">
          <button
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTableTab === 'PROJECT' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setActiveTableTab('PROJECT')}
          >
            CÔNG TRÌNH
          </button>
          <button
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all shadow-sm ${activeTableTab === 'GOODS' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => setActiveTableTab('GOODS')}
          >
            HÀNG HÓA
          </button>
        </div>

        {activeTableTab === 'PROJECT' && renderTable(projectSummaries, projectPurchase, projectPaid, projectDebt)}
        {activeTableTab === 'GOODS' && renderTable(goodsSummaries, goodsPurchase, goodsPaid, goodsDebt)}
      </div>
    );
  };

  const renderDetailView = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return null;

    let allTx = transactions.filter(t => t.customerId === customer.id);
    
    let periodInitialDebt = customer.initialDebt;
    if (startDate) {
      const beforeTx = allTx.filter(t => t.date < startDate);
      const beforePurchase = beforeTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
      const beforePaid = beforeTx.reduce((sum, t) => sum + t.paidAmount, 0);
      periodInitialDebt = customer.initialDebt + beforePurchase - beforePaid;
    }

    let filteredTx = allTx;
    if (startDate) {
      filteredTx = filteredTx.filter(t => t.date >= startDate);
    }
    if (endDate) {
      filteredTx = filteredTx.filter(t => t.date <= endDate);
    }

    const totalPurchase = filteredTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
    const totalPaid = filteredTx.reduce((sum, t) => sum + t.paidAmount, 0);
    const finalDebt = periodInitialDebt + totalPurchase - totalPaid;

    const exportDetailToExcel = () => {
      const data = filteredTx.map((t, index) => {
        const category = categories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId) || (t.paymentCategoryId === 'inventory_export' ? { name: 'Xuất kho' } : undefined);
        return {
          'STT': index + 1,
          'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
          'Tên Công Trình': customer.name,
          'Nội Dung Thanh Toán': category?.name || 'N/A',
          'Tiền Trả': t.paidAmount,
          'Nội dung': t.note || ''
        };
      });
      
      data.unshift({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Công Trình': '' as any,
        'Nội Dung Thanh Toán': 'Dư nợ đầu:' as any,
        'Tiền Trả': '' as any,
        'Nội dung': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Công Trình': '' as any,
        'Nội Dung Thanh Toán': 'Tổng cộng:' as any,
        'Tiền Trả': totalPaid,
        'Nội dung': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Công Trình': '' as any,
        'Nội Dung Thanh Toán': 'Nợ cuối:' as any,
        'Tiền Trả': '' as any,
        'Nội dung': '' as any
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ChiTietCongNo");
      XLSX.writeFile(wb, `ChiTietCongNo_${customer.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
            <p className="text-sm text-gray-500">{customer.phone} • {customer.address}</p>
          </div>
          <button 
            onClick={() => setSelectedCustomerId(null)}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <IconX className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Từ ngày:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Đến ngày:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Xóa lọc
              </button>
            )}
          </div>
          <button 
            onClick={exportDetailToExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <IconDownload className="w-4 h-4" /> Xuất Excel
          </button>
        </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
          <span className="font-bold text-red-800 text-lg">Nợ cuối (Tổng cộng + Dư nợ đầu - Đã trả):</span>
          <span className="font-bold text-red-600 text-xl">{formatCurrency(finalDebt)}</span>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full text-[11px] md:text-sm text-left relative min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">STT</th>
                <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Ngày</th>
                <th className="px-2 md:px-4 py-3">Tên Công Trình</th>
                <th className="px-2 md:px-4 py-3">Nội Dung Thanh Toán</th>
                <th className="px-2 md:px-4 py-3 text-right">Tiền Trả</th>
                <th className="px-2 md:px-4 py-3">Nội dung</th>
                <th className="px-2 md:px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-gray-50 font-medium">
                <td colSpan={4} className="px-2 md:px-4 py-3 text-right text-gray-700 sticky left-0 z-10">Tổng cộng:</td>
                <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(totalPaid)}</td>
                <td colSpan={2}></td>
              </tr>
              <tr className="bg-blue-50/50">
                <td colSpan={4} className="px-2 md:px-4 py-3 font-medium text-gray-700 text-right sticky left-0 z-10">Dư nợ đầu:</td>
                <td colSpan={1} className="px-2 md:px-4 py-3 font-bold text-gray-900 text-right">{formatCurrency(periodInitialDebt)}</td>
                <td colSpan={2}></td>
              </tr>
              {filteredTx.map((t, index) => {
                const category = categories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId) || (t.paymentCategoryId === 'inventory_export' ? { name: 'Xuất kho' } : undefined);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 bg-white z-10">{index + 1}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900 sticky left-8 md:left-12 bg-white z-10">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900">{customer.name}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900">{category?.name || 'N/A'}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(t.paidAmount)}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-600">{t.note}</td>
                    <td className="px-2 md:px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTransaction(t);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Sửa giao dịch"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) {
                                try {
                                  await apiDeleteCustomerTransaction(t.id);
                                } catch (error) {
                                  console.error('Error deleting transaction:', error);
                                  alert('Có lỗi xảy ra khi xóa giao dịch.');
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Xóa giao dịch"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomersDirectory = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAddCustomerModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <IconPlus className="w-4 h-4" /> Thêm công trình
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Ngày BĐ</th>
                <th className="px-4 py-3">Tên Công Trình</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Địa chỉ</th>
                <th className="px-4 py-3 text-right">Giá Trị HĐ</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c, index) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-600">{c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : ''}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.address}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.initialDebt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingCustomer(c)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa công trình"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Bạn có chắc chắn muốn xóa công trình này? Các giao dịch liên quan có thể bị ảnh hưởng.')) {
                            try {
                              await apiDeleteCustomer(c.id, currentUser.companyId);
                            } catch (error) {
                              console.error('Error deleting customer:', error);
                              alert('Có lỗi xảy ra khi xóa công trình.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa công trình"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Chưa có công trình nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCategoriesDirectory = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAddCategoryModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <IconPlus className="w-4 h-4" /> Thêm nội dung TT
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Nội Dung Thanh Toán</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((c, index) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingCategory(c)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa nội dung"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Bạn có chắc chắn muốn xóa nội dung này? Các giao dịch liên quan có thể bị ảnh hưởng.')) {
                            try {
                              await apiDeletePaymentCategory(c.id);
                            } catch (error) {
                              console.error('Error deleting category:', error);
                              alert('Có lỗi xảy ra khi xóa nội dung.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa nội dung"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Chưa có nội dung thanh toán nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-2 md:p-4 w-full mx-auto space-y-6 relative pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase">QUẢN LÝ CÔNG TRÌNH</h1>
          <p className="text-gray-500 text-sm mt-1">Theo dõi công nợ khách hàng / công trình</p>
        </div>
      </div>

      <MobileTabNavigation
        tabs={[
          { id: 'debts', label: 'Công nợ' },
          { id: 'customers', label: 'Danh mục Công Trình' },
          { id: 'categories', label: 'Danh mục Thanh Toán' }
        ]}
        activeTab={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id as any)}
      />

      {activeSubTab === 'debts' && (
        selectedCustomerId ? renderDetailView() : renderSummaryTable()
      )}
      {activeSubTab === 'customers' && renderCustomersDirectory()}
      {activeSubTab === 'categories' && renderCategoriesDirectory()}

      {/* FAB Add Transaction */}
      {activeSubTab === 'debts' && (
        <button
          onClick={() => setShowAddTransactionModal(true)}
          className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center hover:bg-blue-700 hover:scale-105 transition-all z-40"
        >
          <IconPlus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      {(showAddTransactionModal || editingTransaction) && (
        <AddTransactionModal 
          onClose={() => {
            setShowAddTransactionModal(false);
            setEditingTransaction(null);
          }}
          currentUser={currentUser}
          customers={customers}
          categories={categories}
          onAddCustomer={() => setShowAddCustomerModal(true)}
          onAddCategory={() => setShowAddCategoryModal(true)}
          initialData={editingTransaction}
        />
      )}

      {(showAddCustomerModal || editingCustomer) && (
        <AddCustomerModal 
          onClose={() => {
            setShowAddCustomerModal(false);
            setEditingCustomer(null);
          }}
          currentUser={currentUser}
          initialData={editingCustomer}
        />
      )}

      {(showAddCategoryModal || editingCategory) && (
        <AddCategoryModal 
          onClose={() => {
            setShowAddCategoryModal(false);
            setEditingCategory(null);
          }}
          currentUser={currentUser}
          initialData={editingCategory}
        />
      )}
    </div>
  );
}

// --- MODALS ---

function CurrencyInput({ value, onChange, label, required = false }: any) {
  const displayValue = value ? new Intl.NumberFormat('vi-VN').format(Number(value)) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '') {
      onChange('');
      return;
    }
    const num = parseInt(rawValue, 10);
    if (!isNaN(num)) {
      onChange(num.toString());
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input 
        type="text" 
        value={displayValue} 
        onChange={handleChange} 
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" 
        required={required} 
      />
    </div>
  );
}

function AddTransactionModal({ onClose, currentUser, customers, categories, onAddCustomer, onAddCategory, initialData }: any) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState(initialData?.customerId || '');
  const [paymentCategoryId, setPaymentCategoryId] = useState(initialData?.paymentCategoryId || '');
  const [purchaseAmount, setPurchaseAmount] = useState(initialData?.purchaseAmount?.toString() || '');
  const [paidAmount, setPaidAmount] = useState(initialData?.paidAmount?.toString() || '');
  const [note, setNote] = useState(initialData?.note || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !paymentCategoryId) {
      alert("Vui lòng chọn công trình và nội dung thanh toán");
      return;
    }

    const tx: CustomerTransaction = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      customerId,
      paymentCategoryId,
      date,
      purchaseAmount: Number(purchaseAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      executor: initialData?.executor || '',
      note,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      createdBy: initialData?.createdBy || currentUser.id
    };

    if (initialData) {
      await apiUpdateCustomerTransaction(tx);
    } else {
      await apiAddCustomerTransaction(tx);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-2 pb-24 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-h-[75dvh] sm:max-h-[90vh] max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Giao Dịch' : 'Thêm Giao Dịch'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <form id="tx-form-customer" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Công Trình</label>
              <div className="flex gap-2">
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                  <option value="">-- Chọn công trình --</option>
                  {customers.map((c: Customer) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={onAddCustomer} className="px-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100">
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội Dung Thanh Toán</label>
              <div className="flex gap-2">
                <select value={paymentCategoryId} onChange={e => setPaymentCategoryId(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                  <option value="">-- Chọn nội dung --</option>
                  {categories.map((c: PaymentCategory) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={onAddCategory} className="px-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100">
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CurrencyInput 
                label="Tiền Mua" 
                value={purchaseAmount} 
                onChange={setPurchaseAmount} 
                required={false} 
              />
              <CurrencyInput 
                label="Tiền Trả" 
                value={paidAmount} 
                onChange={setPaidAmount} 
                required={false} 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"></textarea>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
          <button type="submit" form="tx-form-customer" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
            {initialData ? 'Cập Nhật Giao Dịch' : 'Lưu Giao Dịch'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCustomerModal({ onClose, currentUser, initialData }: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [initialDebt, setInitialDebt] = useState(initialData?.initialDebt?.toString() || '');
  const [type, setType] = useState<'PROJECT' | 'GOODS'>(initialData?.type || 'PROJECT');
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer: Customer = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      name,
      phone,
      address,
      type,
      startDate,
      initialDebt: Number(initialDebt) || 0,
      createdAt: initialData?.createdAt || new Date().toISOString()
    };
    if (initialData) {
      await apiUpdateCustomer(customer);
    } else {
      await apiAddCustomer(customer);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-2 pb-24 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-h-[75dvh] sm:max-h-[90vh] max-w-sm overflow-hidden shadow-2xl animate-fade-in flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Công Trình' : 'Thêm Công Trình'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên Công Trình</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
            >
              <option value="PROJECT">Công trình</option>
              <option value="GOODS">Hàng hóa</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu CT</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" 
            />
          </div>
          <CurrencyInput 
            label="Giá Trị HĐ (Dư nợ đầu)" 
            value={initialDebt} 
            onChange={setInitialDebt} 
            required={false} 
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4">
            {initialData ? 'Cập Nhật Công Trình' : 'Lưu Công Trình'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddCategoryModal({ onClose, currentUser, initialData }: any) {
  const [name, setName] = useState(initialData?.name || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const category: PaymentCategory = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      name,
      createdAt: initialData?.createdAt || new Date().toISOString()
    };
    if (initialData) {
      await apiUpdatePaymentCategory(category);
    } else {
      await apiAddPaymentCategory(category);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-2 pb-24 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-h-[75dvh] sm:max-h-[90vh] max-w-sm overflow-hidden shadow-2xl animate-fade-in flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Nội Dung TT' : 'Thêm Nội Dung TT'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội Dung Thanh Toán</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4">
            {initialData ? 'Cập Nhật Nội Dung' : 'Lưu Nội Dung'}
          </button>
        </form>
      </div>
    </div>
  );
}
