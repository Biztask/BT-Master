import React, { useState, useEffect } from 'react';
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
  const [summaryTypeFilter, setSummaryTypeFilter] = useState<'ALL' | 'PROJECT' | 'GOODS'>('ALL');

  const [editingTransaction, setEditingTransaction] = useState<CustomerTransaction | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingCategory, setEditingCategory] = useState<PaymentCategory | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'debts' | 'customers' | 'categories'>('debts');

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
  const customerSummaries = customers
    .filter(c => {
      if (summaryStartDate && c.startDate && c.startDate < summaryStartDate) return false;
      if (summaryEndDate && c.startDate && c.startDate > summaryEndDate) return false;
      return true;
    })
    .map(customer => {
    let allTx = transactions.filter(t => t.customerId === customer.id);
    
    // Calculate debt before start date (Dư nợ đầu kỳ)
    let periodInitialDebt = customer.initialDebt;

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
    .filter(c => summaryTypeFilter === 'ALL' ? true : (summaryTypeFilter === 'PROJECT' ? (c.type === 'PROJECT' || !c.type) : c.type === 'GOODS'))
    .sort((a, b) => b.remainingDebt - a.remainingDebt);

  const totalSummaryPurchase = customerSummaries.reduce((sum, c) => sum + c.periodInitialDebt + c.totalPurchase, 0);
  const totalSummaryPaid = customerSummaries.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalSummaryDebt = customerSummaries.reduce((sum, c) => sum + c.remainingDebt, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const exportSummaryToExcel = () => {
    const data = customerSummaries.map((c, index) => ({
      'STT': index + 1,
      'Ngày BĐ': c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '',
      'Tên Khách Hàng': c.name,
      'SĐT': c.phone,
      'Địa Chỉ': c.address,
      'Loại': c.type === 'GOODS' ? 'Hàng hóa' : 'Công trình',
      'Giá Trị HĐ': c.periodInitialDebt,
      'Tiền Mua': c.totalPurchase,
      'Đã Trả': c.totalPaid,
      'Còn Nợ': c.remainingDebt
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CongNoKhachHang");
    XLSX.writeFile(wb, `CongNoKhachHang_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummaryTable = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Tìm kiếm:</label>
            <input 
              type="text" 
              placeholder="Tên khách hàng..."
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
            <label className="text-sm text-gray-600">Loại:</label>
            <select
              value={summaryTypeFilter}
              onChange={e => setSummaryTypeFilter(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả</option>
              <option value="PROJECT">Công trình</option>
              <option value="GOODS">Hàng hóa</option>
            </select>
          </div>
        </div>
        <button 
          onClick={exportSummaryToExcel}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <IconDownload className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
        <span className="font-bold text-red-800 text-lg">Tổng công nợ:</span>
        <span className="font-bold text-red-600 text-xl">{formatCurrency(totalSummaryDebt)}</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <table className="w-full text-[11px] md:text-sm text-left relative">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
            <tr>
              <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">STT</th>
              <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Ngày BĐ</th>
              <th className="px-2 md:px-4 py-3">Tên Khách Hàng</th>
              <th className="px-2 md:px-4 py-3">SĐT</th>
              <th className="px-2 md:px-4 py-3">Địa Chỉ</th>
              <th className="px-2 md:px-4 py-3">Loại</th>
              <th className="px-2 md:px-4 py-3 text-right">Giá Trị HĐ</th>
              <th className="px-2 md:px-4 py-3 text-right">Đã Trả</th>
              <th className="px-2 md:px-4 py-3 text-right">Còn Nợ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-blue-50/80 font-bold text-blue-900 border-b-2 border-blue-200">
              <td colSpan={6} className="px-2 md:px-4 py-3 text-center sticky left-0 z-10 bg-blue-50/80">Tổng cộng</td>
              <td className="px-2 md:px-4 py-3 text-right">{formatCurrency(totalSummaryPurchase)}</td>
              <td className="px-2 md:px-4 py-3 text-right text-green-700">{formatCurrency(totalSummaryPaid)}</td>
              <td className="px-2 md:px-4 py-3 text-right text-red-700">{formatCurrency(totalSummaryDebt)}</td>
            </tr>
            {customerSummaries.map((c, index) => {
              return (
              <tr 
                key={c.id} 
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => setSelectedCustomerId(c.id)}
              >
                <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 z-10 bg-white">{index + 1}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600 sticky left-8 md:left-12 z-10 bg-white">{c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : ''}</td>
                <td className="px-2 md:px-4 py-3 font-medium text-gray-900 bg-white">{c.name}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600">{c.phone}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600">{c.address}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600">{c.type === 'GOODS' ? 'Hàng hóa' : 'Công trình'}</td>
                <td className="px-2 md:px-4 py-3 text-right text-gray-600">{formatCurrency(c.periodInitialDebt + c.totalPurchase)}</td>
                <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(c.totalPaid)}</td>
                <td className="px-2 md:px-4 py-3 text-right font-bold text-red-600">{formatCurrency(c.remainingDebt)}</td>
              </tr>
            )})}
            {customerSummaries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Chưa có khách hàng nào. Bấm dấu + để thêm giao dịch/khách hàng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );

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
        const category = categories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId);
        return {
          'STT': index + 1,
          'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
          'Tên Khách Hàng': customer.name,
          'Nội Dung Thanh Toán': category?.name || 'N/A',
          'Tiền Trả': t.paidAmount,
          'Nội dung': t.note || ''
        };
      });
      
      data.unshift({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Khách Hàng': '' as any,
        'Nội Dung Thanh Toán': 'Dư nợ đầu:' as any,
        'Tiền Trả': '' as any,
        'Nội dung': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Khách Hàng': '' as any,
        'Nội Dung Thanh Toán': 'Tổng cộng:' as any,
        'Tiền Trả': totalPaid,
        'Nội dung': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên Khách Hàng': '' as any,
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
          <table className="w-full text-[11px] md:text-sm text-left relative">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
              <tr>
                <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">STT</th>
                <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Ngày</th>
                <th className="px-2 md:px-4 py-3">Tên Khách Hàng</th>
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
                const category = categories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId);
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
          <IconPlus className="w-4 h-4" /> Thêm khách hàng
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Ngày BĐ</th>
                <th className="px-4 py-3">Tên Khách Hàng</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Địa chỉ</th>
                <th className="px-4 py-3">Loại</th>
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
                  <td className="px-4 py-3 text-gray-600">{c.type === 'GOODS' ? 'Hàng hóa' : 'Công trình'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.initialDebt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingCustomer(c)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa khách hàng"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Bạn có chắc chắn muốn xóa khách hàng này? Các giao dịch liên quan có thể bị ảnh hưởng.')) {
                            try {
                              await apiDeleteCustomer(c.id);
                            } catch (error) {
                              console.error('Error deleting customer:', error);
                              alert('Có lỗi xảy ra khi xóa khách hàng.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa khách hàng"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Chưa có khách hàng nào.
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
          <table className="w-full text-sm text-left">
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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 relative pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase">QUẢN LÝ CÔNG TRÌNH</h1>
          <p className="text-gray-500 text-sm mt-1">Theo dõi công nợ khách hàng</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'debts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveSubTab('debts')}
        >
          Công nợ
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveSubTab('customers')}
        >
          Danh mục Khách Hàng
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'categories' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveSubTab('categories')}
        >
          Danh mục Thanh Toán
        </button>
      </div>

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
      alert("Vui lòng chọn khách hàng và nội dung thanh toán");
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Khách Hàng</label>
              <div className="flex gap-2">
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                  <option value="">-- Chọn khách hàng --</option>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Khách Hàng' : 'Thêm Khách Hàng'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên Khách Hàng</label>
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
            {initialData ? 'Cập Nhật Khách Hàng' : 'Lưu Khách Hàng'}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
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
