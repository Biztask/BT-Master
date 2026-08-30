import React, { useState, useEffect, useRef } from 'react';
import MobileTabNavigation from './MobileTabNavigation';
import { User, Customer, Partner, Product, PaymentCategory, FinanceCategory, CustomerTransaction, PartnerTransaction, RowTag, InventoryTransaction, Company, InventoryItem } from '../types';
import { 
  subscribeToCustomers, 
  subscribeToPartners,
  subscribeToProducts,
  subscribeToPaymentCategories,
  subscribeToFinanceCategories,
  subscribeToCustomerTransactions,
  subscribeToPartnerTransactions,
  subscribeToInventoryTransactions,
  subscribeToInventoryItems,
  apiAddCustomerTransaction,
  apiUpdateCustomerTransaction,
  apiDeleteCustomerTransaction,
  apiAddPartnerTransaction,
  apiUpdatePartnerTransaction,
  apiDeletePartnerTransaction,
  apiAddFinanceCategory,
  apiUpdateFinanceCategory,
  apiDeleteFinanceCategory,
  apiUpdateCustomer,
  subscribeToRowTags,
  apiGetCompanyOnce
} from '../services/storageService';
import { IconPlus, IconX, IconEdit, IconTrash, IconDownload, IconSearch } from './Icons';
import * as XLSX from 'xlsx';
import { exportCustomerDebtToExcel } from '../utils/excelExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import RowTagSelector from './RowTagSelector';

interface FinanceTabProps {
  currentUser: User;
}

const TAG_COLORS_ORDER = [
  'transparent',
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#64748b', // slate
];

const getColorIndex = (color?: string) => {
  if (!color || color === 'transparent') return 0;
  const index = TAG_COLORS_ORDER.indexOf(color);
  return index === -1 ? 0 : index;
};

export default function FinanceTab({ currentUser }: FinanceTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransaction[]>([]);
  const [partnerTransactions, setPartnerTransactions] = useState<PartnerTransaction[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [rowTags, setRowTags] = useState<RowTag[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const [activeSubTab, setActiveSubTab] = useState<'report' | 'thu' | 'chi'>('report');


  const [showAddThuModal, setShowAddThuModal] = useState(false);
  const [showAddChiModal, setShowAddChiModal] = useState(false);
  const [editingThu, setEditingThu] = useState<CustomerTransaction | null>(null);
  const [editingChi, setEditingChi] = useState<PartnerTransaction | null>(null);

  // Summary filters
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');

  // Thu filters
  const [thuStartDate, setThuStartDate] = useState('');
  const [thuEndDate, setThuEndDate] = useState('');

  // Chi filters
  const [chiStartDate, setChiStartDate] = useState('');
  const [chiEndDate, setChiEndDate] = useState('');

  // Report search
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Selected project for detailed report
  const [selectedProjectReport, setSelectedProjectReport] = useState<any>(null);
  const [showFinancialColumns, setShowFinancialColumns] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubCustomers = subscribeToCustomers(currentUser.companyId, setCustomers);
    const unsubPartners = subscribeToPartners(currentUser.companyId, setPartners);
    const unsubProducts = subscribeToProducts(currentUser.companyId, setProducts);
    const unsubPaymentCategories = subscribeToPaymentCategories(currentUser.companyId, setPaymentCategories);
    const unsubFinanceCategories = subscribeToFinanceCategories(currentUser.companyId, setFinanceCategories);
    const unsubCustomerTx = subscribeToCustomerTransactions(currentUser.companyId, setCustomerTransactions);
    const unsubPartnerTx = subscribeToPartnerTransactions(currentUser.companyId, setPartnerTransactions);
    const unsubInventoryTx = subscribeToInventoryTransactions(currentUser.companyId, setInventoryTransactions);
    const unsubInventoryItems = subscribeToInventoryItems(currentUser.companyId, setInventoryItems);
    const unsubRowTags = subscribeToRowTags(currentUser.companyId, ['CUSTOMER', 'CUSTOMER_PROGRESS', 'CUSTOMER_NOTE'], setRowTags);

    apiGetCompanyOnce(currentUser.companyId).then(comp => {
      setCompany(comp);
    });

    return () => {
      unsubCustomers();
      unsubPartners();
      unsubProducts();
      unsubPaymentCategories();
      unsubFinanceCategories();
      unsubCustomerTx();
      unsubPartnerTx();
      unsubInventoryTx();
      unsubInventoryItems();
      unsubRowTags();
    };
  }, [currentUser.companyId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  // Calculate Report
  const reportData = customers.map(customer => {
    let customerTx = customerTransactions.filter(t => t.customerId === customer.id);
    let partnerTx = partnerTransactions.filter(t => t.customerId === customer.id);

    if (summaryStartDate) {
      customerTx = customerTx.filter(t => t.date >= summaryStartDate);
      partnerTx = partnerTx.filter(t => t.date >= summaryStartDate);
    }
    if (summaryEndDate) {
      customerTx = customerTx.filter(t => t.date <= summaryEndDate);
      partnerTx = partnerTx.filter(t => t.date <= summaryEndDate);
    }

    const effectiveInitialDebt = customer.actualValue !== undefined && customer.actualValue !== null ? customer.actualValue : customer.initialDebt;
    const totalPurchase = customerTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
    const contractValue = customer.initialDebt + totalPurchase;
    const giaTriHD = effectiveInitialDebt + totalPurchase;
    const tongThu = customerTx.reduce((sum, t) => sum + t.paidAmount, 0);
    const tongChi = partnerTx.reduce((sum, t) => sum + t.purchaseAmount + (financeCategories.some(c => c.id === t.productId) ? t.paidAmount : 0), 0);
    const loiNhuan = giaTriHD - tongChi;

    return {
      ...customer,
      contractValue,
      giaTriHD,
      tongThu,
      tongChi,
      loiNhuan
    };
  }).filter(r => r.name.toLowerCase().includes(reportSearchTerm.toLowerCase()))
  .filter(r => hideCompleted ? r.financeStatus !== 'COMPLETED' : true)
  .sort((a, b) => {
    const tagA = rowTags.find(t => t.id === a.progressTagId);
    const tagB = rowTags.find(t => t.id === b.progressTagId);
    
    const colorIndexA = getColorIndex(tagA?.color);
    const colorIndexB = getColorIndex(tagB?.color);

    if (colorIndexA !== colorIndexB) {
      return colorIndexA - colorIndexB;
    }
    return b.loiNhuan - a.loiNhuan;
  });

  const exportReportToExcel = () => {
    const data = reportData.map((r, index) => ({
      'STT': index + 1,
      'Ngày BĐ': r.startDate ? new Date(r.startDate).toLocaleDateString('vi-VN') : '',
      'Tên công trình': r.name,
      'Giá trị HĐ': r.contractValue,
      'Giá trị TT': r.actualValue !== undefined ? r.actualValue : r.contractValue,
      'Tổng thu CT': r.tongThu,
      'Tổng Chi CT': r.tongChi,
      'Lợi Nhuận': r.loiNhuan,
      'Tiến độ': rowTags.find(t => t.id === r.progressTagId)?.text || '',
      'Ghi chú': rowTags.find(t => t.id === r.noteTagId)?.text || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BaoCaoTaiChinh");
    XLSX.writeFile(wb, `BaoCaoTaiChinh_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportThuToExcel = () => {
    let thuList = customerTransactions.filter(t => t.paidAmount > 0);
    if (thuStartDate) thuList = thuList.filter(t => t.date >= thuStartDate);
    if (thuEndDate) thuList = thuList.filter(t => t.date <= thuEndDate);
    thuList = thuList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const data = thuList.map((t, index) => {
      const customer = customers.find(c => c.id === t.customerId);
      const category = paymentCategories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId) || (t.paymentCategoryId === 'inventory_export' ? { name: 'Xuất kho' } : undefined);
      return {
        'STT': index + 1,
        'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
        'Công trình': customer?.name || 'N/A',
        'Hạng mục': category?.name || 'N/A',
        'Số tiền': t.paidAmount,
        'Nội dung': t.note
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachThu");
    XLSX.writeFile(wb, `DanhSachThu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportChiToExcel = () => {
    let chiList = partnerTransactions.filter(t => t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0));
    if (chiStartDate) chiList = chiList.filter(t => t.date >= chiStartDate);
    if (chiEndDate) chiList = chiList.filter(t => t.date <= chiEndDate);
    chiList = chiList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const data = chiList.map((t, index) => {
      const customer = customers.find(c => c.id === t.customerId);
      const partner = partners.find(p => p.id === t.partnerId);
      const category = products.find(p => p.id === t.productId) || financeCategories.find(c => c.id === t.productId) || (t.productId === 'inventory_export' ? { name: 'Xuất kho' } : (t.productId === 'inventory_import' ? { name: 'Nhập kho' } : { name: 'Chưa xác định' }));
      return {
        'STT': index + 1,
        'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
        'Công trình': customer?.name || 'N/A',
        'Nhà cung cấp': partner?.name || '-',
        'Hạng mục chi': category?.name || 'N/A',
        'Nội dung': t.content || '-',
        'Người thực hiện': t.executor || '-',
        'Số tiền': t.purchaseAmount || t.paidAmount
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachChi");
    XLSX.writeFile(wb, `DanhSachChi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderReport = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
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
            {(summaryStartDate || summaryEndDate) && (
              <button 
                onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Xóa lọc
              </button>
            )}
            <div className="flex items-center gap-2 ml-2">
              <input 
                type="checkbox" 
                id="hideCompleted"
                checked={hideCompleted}
                onChange={e => setHideCompleted(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="hideCompleted" className="text-sm text-gray-600 cursor-pointer">Ẩn công trình hoàn thành</label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm tên công trình..." 
                value={reportSearchTerm}
                onChange={e => setReportSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 w-48 md:w-64"
              />
            </div>
            <button 
              onClick={() => setShowFinancialColumns(!showFinancialColumns)}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {showFinancialColumns ? 'Ẩn cột tài chính' : 'Hiện cột tài chính'}
            </button>
            <button 
              onClick={exportReportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <IconDownload className="w-4 h-4" /> Xuất Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-[11px] md:text-sm text-left relative min-w-[800px]">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">STT</th>
                  <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Ngày BĐ</th>
                  <th className="px-2 md:px-4 py-3">Tên công trình</th>
                  {showFinancialColumns && (
                    <>
                      <th className="px-2 md:px-4 py-3 text-right">Giá trị HĐ</th>
                      <th className="px-2 md:px-4 py-3 text-right">Giá trị TT</th>
                      <th className="px-2 md:px-4 py-3 text-right">Tổng thu CT</th>
                      <th className="px-2 md:px-4 py-3 text-right">Tổng Chi CT</th>
                      <th className="px-2 md:px-4 py-3 text-right">Lợi Nhuận</th>
                    </>
                  )}
                  <th className="px-2 md:px-4 py-3 text-center">Tiến độ</th>
                  <th className="px-2 md:px-4 py-3 text-center">Ghi chú</th>
                  <th className="px-2 md:px-4 py-3 text-center">Hoàn Thành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.length > 0 && (
                  <tr className="bg-blue-50/80 font-bold border-b-2 border-blue-200">
                    <td colSpan={3} className="px-2 md:px-4 py-3 text-right text-gray-900 sticky left-0 z-10 bg-blue-50/80">Tổng cộng:</td>
                    {showFinancialColumns && (
                      <>
                        <td className="px-2 md:px-4 py-3 text-right text-gray-900"></td>
                        <td className="px-2 md:px-4 py-3 text-right text-gray-900"></td>
                        <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(reportData.reduce((sum, r) => sum + r.tongThu, 0))}</td>
                        <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(reportData.reduce((sum, r) => sum + r.tongChi, 0))}</td>
                        <td className="px-2 md:px-4 py-3 text-right text-blue-600"></td>
                      </>
                    )}
                    <td className="px-2 md:px-4 py-3"></td>
                    <td className="px-2 md:px-4 py-3"></td>
                    <td className="px-2 md:px-4 py-3"></td>
                  </tr>
                )}
                {reportData.map((r, index) => {
                  const progressTag = rowTags.find(t => t.id === r.progressTagId);
                  const noteTag = rowTags.find(t => t.id === r.noteTagId);
                  const rowColor = progressTag?.color && progressTag.color !== 'transparent' ? progressTag.color : (noteTag?.color && noteTag.color !== 'transparent' ? noteTag.color : undefined);
                  return (
                  <tr 
                    key={r.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    style={{ backgroundColor: rowColor ? `${rowColor}15` : undefined }}
                    onClick={() => setSelectedProjectReport(r)}
                  >
                    <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 z-10" style={{ backgroundColor: rowColor ? `${rowColor}15` : 'white' }}>{index + 1}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-600 sticky left-8 md:left-12 z-10" style={{ backgroundColor: rowColor ? `${rowColor}15` : 'white' }}>{r.startDate ? new Date(r.startDate).toLocaleDateString('vi-VN') : ''}</td>
                    <td className="px-2 md:px-4 py-3 font-medium text-blue-600 hover:underline">{r.name}</td>
                    {showFinancialColumns && (
                      <>
                        <td className="px-2 md:px-4 py-3 text-right text-gray-600">{formatCurrency(r.contractValue)}</td>
                        <td className="px-2 md:px-4 py-3 text-right text-gray-600">{r.actualValue !== undefined ? formatCurrency(r.actualValue) : '-'}</td>
                        <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(r.tongThu)}</td>
                        <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(r.tongChi)}</td>
                        <td className="px-2 md:px-4 py-3 text-right font-bold text-blue-600">{formatCurrency(r.loiNhuan)}</td>
                      </>
                    )}
                    <td className="px-2 md:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <RowTagSelector 
                        companyId={currentUser.companyId}
                        type="CUSTOMER_PROGRESS"
                        tags={rowTags}
                        selectedTagId={r.progressTagId}
                        onSelect={async (tagId) => {
                          const originalCustomer = customers.find(c => c.id === r.id);
                          if (originalCustomer) {
                            await apiUpdateCustomer({ ...originalCustomer, progressTagId: tagId });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 md:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <RowTagSelector 
                        companyId={currentUser.companyId}
                        type="CUSTOMER_NOTE"
                        tags={rowTags}
                        selectedTagId={r.noteTagId}
                        onSelect={async (tagId) => {
                          const originalCustomer = customers.find(c => c.id === r.id);
                          if (originalCustomer) {
                            await apiUpdateCustomer({ ...originalCustomer, noteTagId: tagId });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 md:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={r.financeStatus === 'COMPLETED'}
                        onChange={async (e) => {
                          const originalCustomer = customers.find(c => c.id === r.id);
                          if (originalCustomer) {
                            await apiUpdateCustomer({ 
                              ...originalCustomer, 
                              financeStatus: e.target.checked ? 'COMPLETED' : 'IN_PROGRESS' 
                            });
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                )})}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart at the bottom */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Biểu đồ Giá trị HĐ & Lợi nhuận</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={reportData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={isMobile ? false : { fill: '#6b7280', fontSize: 12 }} 
                  hide={isMobile}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="giaTriHD" name="Giá trị HĐ" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="loiNhuan" name="Lợi nhuận" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderThuList = () => {
    let thuList = customerTransactions.filter(t => t.paidAmount > 0);
    if (thuStartDate) thuList = thuList.filter(t => t.date >= thuStartDate);
    if (thuEndDate) thuList = thuList.filter(t => t.date <= thuEndDate);
    thuList = thuList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Từ ngày:</label>
              <input 
                type="date" 
                value={thuStartDate}
                onChange={e => setThuStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Đến ngày:</label>
              <input 
                type="date" 
                value={thuEndDate}
                onChange={e => setThuEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {(thuStartDate || thuEndDate) && (
              <button 
                onClick={() => { setThuStartDate(''); setThuEndDate(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Xóa lọc
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={exportThuToExcel}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <IconDownload className="w-4 h-4" /> Xuất Excel
            </button>
            <button 
              onClick={() => setShowAddThuModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <IconPlus className="w-4 h-4" /> Thêm Thu
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
            <span className="font-bold text-green-800 text-lg">Tổng Thu:</span>
            <span className="font-bold text-green-600 text-xl">{formatCurrency(thuList.reduce((sum, t) => sum + t.paidAmount, 0))}</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-[11px] md:text-sm text-left relative min-w-[800px]">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">Ngày</th>
                  <th className="px-2 md:px-4 py-3 sticky left-16 md:left-24 bg-gray-50 z-30">Tên công trình</th>
                  <th className="px-2 md:px-4 py-3">Hạng mục thu</th>
                  <th className="px-2 md:px-4 py-3">Người thực hiện</th>
                  <th className="px-2 md:px-4 py-3 text-right">Số tiền</th>
                  <th className="px-2 md:px-4 py-3">Nội dung</th>
                  <th className="px-2 md:px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {thuList.length > 0 && (
                  <tr className="bg-green-50/80 font-bold border-b-2 border-green-200">
                    <td colSpan={4} className="px-2 md:px-4 py-3 text-right text-gray-900 sticky left-0 z-10 bg-green-50/80">Tổng cộng:</td>
                    <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(thuList.reduce((sum, t) => sum + t.paidAmount, 0))}</td>
                    <td className="px-2 md:px-4 py-3"></td>
                    <td className="px-2 md:px-4 py-3"></td>
                  </tr>
                )}
                {thuList.map(t => {
                  const customer = customers.find(c => c.id === t.customerId);
                  const category = paymentCategories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId) || (t.paymentCategoryId === 'inventory_export' ? { name: 'Xuất kho' } : undefined);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-4 py-3 text-gray-900 sticky left-0 bg-white z-10">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                      <td className="px-2 md:px-4 py-3 font-medium text-gray-900 sticky left-16 md:left-24 bg-white z-10">{customer?.name || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{category?.name || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{t.executor || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-right text-green-600 font-medium">{formatCurrency(t.paidAmount)}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{t.note}</td>
                      <td className="px-2 md:px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {t.paymentCategoryId !== 'inventory_export' && t.paymentCategoryId !== 'inventory_import' ? (
                            <>
                              <button onClick={() => setEditingThu(t)} className="text-blue-600 hover:text-blue-800 p-1"><IconEdit className="w-4 h-4" /></button>
                              <button onClick={() => { if(window.confirm('Xóa bản ghi này?')) apiDeleteCustomerTransaction(t.id); }} className="text-red-600 hover:text-red-800 p-1"><IconTrash className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Từ Kho</span>
                          )}
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

  const renderChiList = () => {
    let chiList = partnerTransactions.filter(t => t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0));
    if (chiStartDate) chiList = chiList.filter(t => t.date >= chiStartDate);
    if (chiEndDate) chiList = chiList.filter(t => t.date <= chiEndDate);
    chiList = chiList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Từ ngày:</label>
              <input 
                type="date" 
                value={chiStartDate}
                onChange={e => setChiStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Đến ngày:</label>
              <input 
                type="date" 
                value={chiEndDate}
                onChange={e => setChiEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {(chiStartDate || chiEndDate) && (
              <button 
                onClick={() => { setChiStartDate(''); setChiEndDate(''); }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Xóa lọc
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={exportChiToExcel}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <IconDownload className="w-4 h-4" /> Xuất Excel
            </button>
            <button 
              onClick={() => setShowAddChiModal(true)}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            >
              <IconPlus className="w-4 h-4" /> Thêm Chi
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
            <span className="font-bold text-orange-800 text-lg">Tổng Chi:</span>
            <span className="font-bold text-orange-600 text-xl">{formatCurrency(chiList.reduce((sum, t) => sum + (t.purchaseAmount || t.paidAmount), 0))}</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-[11px] md:text-sm text-left relative min-w-[800px]">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0 z-20">
                <tr>
                  <th className="px-2 md:px-4 py-3 sticky left-0 bg-gray-50 z-30">Ngày</th>
                  <th className="px-2 md:px-4 py-3 sticky left-16 md:left-24 bg-gray-50 z-30">Tên công trình</th>
                  <th className="px-2 md:px-4 py-3">Hạng mục chi</th>
                  <th className="px-2 md:px-4 py-3">Nhà cung cấp</th>
                  <th className="px-2 md:px-4 py-3">Nội dung</th>
                  <th className="px-2 md:px-4 py-3">Người thực hiện</th>
                  <th className="px-2 md:px-4 py-3 text-right">Số tiền</th>
                  <th className="px-2 md:px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chiList.length > 0 && (
                  <tr className="bg-orange-50/80 font-bold border-b-2 border-orange-200">
                    <td colSpan={6} className="px-2 md:px-4 py-3 text-right text-gray-900 sticky left-0 z-10 bg-orange-50/80">Tổng cộng:</td>
                    <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(chiList.reduce((sum, t) => sum + (t.purchaseAmount || t.paidAmount), 0))}</td>
                    <td className="px-2 md:px-4 py-3"></td>
                  </tr>
                )}
                {chiList.map(t => {
                  const customer = customers.find(c => c.id === t.customerId);
                  const partner = partners.find(p => p.id === t.partnerId);
                  const category = products.find(p => p.id === t.productId) || financeCategories.find(c => c.id === t.productId) || (t.productId === 'inventory_export' ? { name: 'Xuất kho' } : (t.productId === 'inventory_import' ? { name: 'Nhập kho' } : { name: 'Chưa xác định' }));
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-2 md:px-4 py-3 text-gray-900 sticky left-0 bg-white z-10">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                      <td className="px-2 md:px-4 py-3 font-medium text-gray-900 sticky left-16 md:left-24 bg-white z-10">{customer?.name || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{category?.name || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{partner?.name || '-'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{t.content || '-'}</td>
                      <td className="px-2 md:px-4 py-3 text-gray-600">{t.executor || 'N/A'}</td>
                      <td className="px-2 md:px-4 py-3 text-right text-orange-600 font-medium">{formatCurrency(t.purchaseAmount || t.paidAmount)}</td>
                      <td className="px-2 md:px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {t.productId !== 'inventory_export' && t.productId !== 'inventory_import' ? (
                            <>
                              <button onClick={() => setEditingChi(t)} className="text-blue-600 hover:text-blue-800 p-1"><IconEdit className="w-4 h-4" /></button>
                              <button onClick={() => { if(window.confirm('Xóa bản ghi này?')) apiDeletePartnerTransaction(t.id); }} className="text-red-600 hover:text-red-800 p-1"><IconTrash className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Từ Kho</span>
                          )}
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

  return (
    <div className="p-2 md:p-4 w-full mx-auto space-y-6 relative pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase">QUẢN LÝ TÀI CHÍNH</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý thu chi và lợi nhuận công trình</p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full p-6 shadow-lg flex flex-col items-center justify-center text-white transform transition-transform hover:scale-[1.02]">
          <span className="text-blue-100 text-sm md:text-base font-medium uppercase tracking-wider mb-1">Tổng giá trị HĐ</span>
          <span className="text-2xl md:text-4xl font-black">{formatCurrency(reportData.reduce((sum, r) => sum + r.giaTriHD, 0))}</span>
        </div>
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full p-6 shadow-lg flex flex-col items-center justify-center text-white transform transition-transform hover:scale-[1.02]">
          <span className="text-indigo-100 text-sm md:text-base font-medium uppercase tracking-wider mb-1">Tổng lợi nhuận</span>
          <span className="text-2xl md:text-4xl font-black">{formatCurrency(reportData.reduce((sum, r) => sum + r.loiNhuan, 0))}</span>
        </div>
      </div>

      <MobileTabNavigation
        tabs={[
          { id: 'report', label: 'Báo cáo tài chính' },
          { id: 'thu', label: 'Danh sách Thu' },
          { id: 'chi', label: 'Danh sách Chi' }
        ]}
        activeTab={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id as any)}
      />

      {activeSubTab === 'report' && renderReport()}
      {activeSubTab === 'thu' && renderThuList()}
      {activeSubTab === 'chi' && renderChiList()}

      {(showAddThuModal || editingThu) && (
        <AddThuModal 
          onClose={() => { setShowAddThuModal(false); setEditingThu(null); }}
          currentUser={currentUser}
          customers={customers}
          paymentCategories={paymentCategories}
          financeCategories={financeCategories.filter(c => c.type === 'THU')}
          initialData={editingThu}
        />
      )}

      {(showAddChiModal || editingChi) && (
        <AddChiModal 
          onClose={() => { setShowAddChiModal(false); setEditingChi(null); }}
          currentUser={currentUser}
          customers={customers}
          partners={partners}
          products={products}
          financeCategories={financeCategories.filter(c => c.type === 'CHI')}
          initialData={editingChi}
        />
      )}

      {selectedProjectReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-fade-in flex flex-col max-h-[90dvh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-lg text-gray-900">Chi tiết tài chính: {selectedProjectReport.name}</h3>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-600">Từ:</label>
                  <input 
                    type="date" 
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                  />
                  <label className="text-gray-600">Đến:</label>
                  <input 
                    type="date" 
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                  />
                </div>
                <button 
                  onClick={() => {
                    const customer = customers.find(c => c.id === selectedProjectReport.id);
                    if (customer) {
                      exportCustomerDebtToExcel(
                        customer, 
                        company, 
                        customerTransactions, 
                        partnerTransactions, 
                        inventoryTransactions, 
                        financeCategories, 
                        inventoryItems,
                        exportStartDate,
                        exportEndDate
                      );
                    }
                  }}
                  className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors flex items-center gap-1"
                >
                  <IconDownload className="w-4 h-4" />
                  Xuất Excel
                </button>
                <button onClick={() => setSelectedProjectReport(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-600 font-bold uppercase mb-1">Giá trị HĐ</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(selectedProjectReport.giaTriHD)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <p className="text-xs text-green-600 font-bold uppercase mb-1">Tổng Thu</p>
                  <p className="text-lg font-bold text-green-900">{formatCurrency(selectedProjectReport.tongThu)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                  <p className="text-xs text-orange-600 font-bold uppercase mb-1">Tổng Chi</p>
                  <p className="text-lg font-bold text-orange-900">{formatCurrency(selectedProjectReport.tongChi)}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-bold uppercase mb-1">Lợi Nhuận</p>
                  <p className="text-lg font-bold text-indigo-900">{formatCurrency(selectedProjectReport.loiNhuan)}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Danh sách Thu</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto overflow-y-auto max-h-[40vh]">
                  <table className="w-full text-sm text-left relative min-w-[600px]">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2">Ngày</th>
                        <th className="px-4 py-2">Hạng mục</th>
                        <th className="px-4 py-2 text-right">Số tiền</th>
                        <th className="px-4 py-2">Nội dung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerTransactions.filter(t => t.customerId === selectedProjectReport.id && t.paidAmount > 0).length > 0 && (
                        <tr className="bg-green-50/80 font-bold border-b-2 border-green-200">
                          <td colSpan={2} className="px-4 py-2 text-right text-gray-900">Tổng cộng:</td>
                          <td className="px-4 py-2 text-right text-green-600">{formatCurrency(customerTransactions.filter(t => t.customerId === selectedProjectReport.id && t.paidAmount > 0).reduce((sum, t) => sum + t.paidAmount, 0))}</td>
                          <td className="px-4 py-2"></td>
                        </tr>
                      )}
                      {customerTransactions.filter(t => t.customerId === selectedProjectReport.id && t.paidAmount > 0).map(t => {
                        const category = paymentCategories.find(c => c.id === t.paymentCategoryId) || financeCategories.find(c => c.id === t.paymentCategoryId) || (t.paymentCategoryId === 'inventory_export' ? { name: 'Xuất kho' } : undefined);
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-2">{category?.name || 'N/A'}</td>
                            <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(t.paidAmount)}</td>
                            <td className="px-4 py-2 text-gray-600">{t.note || '-'}</td>
                          </tr>
                        );
                      })}
                      {customerTransactions.filter(t => t.customerId === selectedProjectReport.id && t.paidAmount > 0).length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">Chưa có khoản thu nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Danh sách Chi</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto overflow-y-auto max-h-[40vh]">
                  <table className="w-full text-sm text-left relative min-w-[600px]">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2">Ngày</th>
                        <th className="px-4 py-2">Hạng mục</th>
                        <th className="px-4 py-2">Nhà cung cấp</th>
                        <th className="px-4 py-2 text-right">Số tiền</th>
                        <th className="px-4 py-2">Nội dung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {partnerTransactions.filter(t => t.customerId === selectedProjectReport.id && (t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0))).length > 0 && (
                        <tr className="bg-orange-50/80 font-bold border-b-2 border-orange-200">
                          <td colSpan={3} className="px-4 py-2 text-right text-gray-900">Tổng cộng:</td>
                          <td className="px-4 py-2 text-right text-orange-600">{formatCurrency(partnerTransactions.filter(t => t.customerId === selectedProjectReport.id && (t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0))).reduce((sum, t) => sum + (t.purchaseAmount || t.paidAmount), 0))}</td>
                          <td className="px-4 py-2"></td>
                        </tr>
                      )}
                      {partnerTransactions.filter(t => t.customerId === selectedProjectReport.id && (t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0))).map(t => {
                        const partner = partners.find(p => p.id === t.partnerId);
                        const category = products.find(p => p.id === t.productId) || financeCategories.find(c => c.id === t.productId) || (t.productId === 'inventory_export' ? { name: 'Xuất kho' } : (t.productId === 'inventory_import' ? { name: 'Nhập kho' } : { name: 'Chưa xác định' }));
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-2">{category?.name || 'N/A'}</td>
                            <td className="px-4 py-2">{partner?.name || '-'}</td>
                            <td className="px-4 py-2 text-right text-orange-600 font-medium">{formatCurrency(t.purchaseAmount || t.paidAmount)}</td>
                            <td className="px-4 py-2 text-gray-600">{t.content || '-'}</td>
                          </tr>
                        );
                      })}
                      {partnerTransactions.filter(t => t.customerId === selectedProjectReport.id && (t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0))).length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">Chưa có khoản chi nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CurrencyInput({ value, onChange, label, required = false }: any) {
  const displayValue = value ? new Intl.NumberFormat('vi-VN').format(Number(value)) : '';
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '') { onChange(''); return; }
    const num = parseInt(rawValue, 10);
    if (!isNaN(num)) onChange(num.toString());
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={displayValue} onChange={handleChange} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required={required} />
    </div>
  );
}

function AddThuModal({ onClose, currentUser, customers, paymentCategories, financeCategories, initialData }: any) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState(initialData?.customerId || '');
  const [paymentCategoryId, setPaymentCategoryId] = useState(initialData?.paymentCategoryId || '');
  const [amount, setAmount] = useState(initialData?.paidAmount?.toString() || '');
  const [executor, setExecutor] = useState(initialData?.executor || currentUser.name);
  const [note, setNote] = useState(initialData?.note || '');

  const [paymentSearch, setPaymentSearch] = useState(paymentCategories.find((c: any) => c.id === initialData?.paymentCategoryId)?.name || '');
  const [financeSearch, setFinanceSearch] = useState(financeCategories.find((c: any) => c.id === initialData?.paymentCategoryId)?.name || '');
  const [customerSearch, setCustomerSearch] = useState(customers.find((c: any) => c.id === initialData?.customerId)?.name || '');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !paymentCategoryId) {
      alert("Vui lòng chọn công trình và hạng mục thu");
      return;
    }
    const tx: CustomerTransaction = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      customerId,
      paymentCategoryId,
      date,
      purchaseAmount: initialData?.purchaseAmount || 0, // Keep existing if editing
      paidAmount: Number(amount) || 0,
      executor,
      note,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      createdBy: initialData?.createdBy || currentUser.id
    };
    if (initialData) await apiUpdateCustomerTransaction(tx);
    else await apiAddCustomerTransaction(tx);
    onClose();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const cat: FinanceCategory = {
      id: Date.now().toString(),
      companyId: currentUser.companyId,
      name: newCategoryName.trim(),
      type: 'THU',
      createdAt: new Date().toISOString()
    };
    await apiAddFinanceCategory(cat);
    setPaymentCategoryId(cat.id);
    setFinanceSearch(cat.name);
    setPaymentSearch('');
    setShowAddCategory(false);
    setNewCategoryName('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] sm:max-h-[90dvh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Thu' : 'Thêm Thu'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition-all">
            <IconX className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <form id="thu-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
            </div>
            <CurrencyInput label="Số tiền" value={amount} onChange={setAmount} required={true} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hạng mục thu</label>
              <div>
                <label className="text-xs text-gray-500 mb-1 block font-medium">Danh mục thanh toán (Công trình)</label>
                <input 
                  list="payment-category-list"
                  value={paymentSearch}
                  onChange={e => {
                    setPaymentSearch(e.target.value);
                    const selected = paymentCategories.find((c: any) => c.name === e.target.value);
                    if (selected) {
                      setPaymentCategoryId(selected.id);
                    } else if (e.target.value === '') {
                      setPaymentCategoryId('');
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
                  placeholder="Tìm hoặc chọn danh mục thanh toán..."
                />
                <datalist id="payment-category-list">
                  {paymentCategories.map((c: any) => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên công trình</label>
              <input 
                list="customer-list-thu"
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  const selected = customers.find((c: Customer) => c.name === e.target.value);
                  if (selected) setCustomerId(selected.id);
                  else if (e.target.value === '') setCustomerId('');
                }}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
                placeholder="Tìm hoặc chọn công trình..."
                required
              />
              <datalist id="customer-list-thu">
                {customers.map((c: Customer) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
              <input type="text" value={executor} onChange={e => setExecutor(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"></textarea>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
          <button type="submit" form="thu-form" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">
            {initialData ? 'Cập Nhật Thu' : 'Lưu Thu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChiModal({ onClose, currentUser, customers, partners, products, financeCategories, initialData }: any) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState((initialData?.purchaseAmount || initialData?.paidAmount)?.toString() || '');
  const [productId, setProductId] = useState(initialData?.productId || '');
  const [customerId, setCustomerId] = useState(initialData?.customerId || '');
  const [partnerId, setPartnerId] = useState(initialData?.partnerId || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [executor, setExecutor] = useState(initialData?.executor || currentUser.name);
  const [note, setNote] = useState(initialData?.note || '');
  const [isAutoPaid, setIsAutoPaid] = useState(initialData ? (initialData.purchaseAmount > 0 && initialData.purchaseAmount === initialData.paidAmount) : false);

  const [productSearch, setProductSearch] = useState(initialData?.productId === 'inventory_export' ? 'Xuất kho' : initialData?.productId === 'inventory_import' ? 'Nhập kho' : products.find((p: any) => p.id === initialData?.productId)?.name || '');
  const [financeSearch, setFinanceSearch] = useState(financeCategories.find((c: any) => c.id === initialData?.productId)?.name || '');
  const [customerSearch, setCustomerSearch] = useState(customers.find((c: any) => c.id === initialData?.customerId)?.name || '');
  const [partnerSearch, setPartnerSearch] = useState(partners.find((p: any) => p.id === initialData?.partnerId)?.name || '');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      alert("Vui lòng chọn hạng mục chi");
      return;
    }

    const isProductCategory = products.some((p: any) => p.id === productId) || productId === 'inventory_export' || productId === 'inventory_import';
    const isFinanceCategory = financeCategories.some((c: any) => c.id === productId);

    if (isProductCategory) {
      if ((!customerId || !partnerId) && productId !== "inventory_export" && productId !== "inventory_import") {
        alert("Thao tác sai: Lấy vật tư đối tác chi cho công trình (Danh mục hàng hóa). Yêu cầu phải chọn cả Công Trình và Đối Tác.");
        return;
      }
    } else if (isFinanceCategory) {
      if (customerId && partnerId) {
        alert("Thiết lập sai: Không thể chọn cùng lúc Công Trình và Đối Tác cho Hạng mục độc lập (Tài chính). Bạn vui lòng xem hướng dẫn bên cạnh để chọn đúng.");
        return;
      }
    }

    let finalPurchaseAmount = 0;
    let finalPaidAmount = 0;

    if (isProductCategory) {
      finalPurchaseAmount = Number(amount) || 0;
      if (isAutoPaid) {
        finalPaidAmount = finalPurchaseAmount;
      } else {
        const wasProductCategory = products.some((p: any) => p.id === initialData?.productId);
        finalPaidAmount = wasProductCategory ? (initialData?.paidAmount || 0) : 0;
      }
    } else if (isFinanceCategory) {
      if (partnerId) {
        finalPaidAmount = Number(amount) || 0;
        finalPurchaseAmount = 0;
      } else {
        finalPurchaseAmount = Number(amount) || 0;
        finalPaidAmount = 0;
      }
    }

    const tx: PartnerTransaction = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      partnerId,
      productId,
      customerId,
      content,
      executor,
      date,
      quantity: initialData?.quantity || 1, // Default quantity 1 for CHI
      purchaseAmount: finalPurchaseAmount,
      paidAmount: finalPaidAmount,
      note,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      createdBy: initialData?.createdBy || currentUser.id
    };
    if (initialData) await apiUpdatePartnerTransaction(tx);
    else await apiAddPartnerTransaction(tx);
    onClose();
  };

  const [editingFinanceCategory, setEditingFinanceCategory] = useState<FinanceCategory | null>(null);

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (editingFinanceCategory) {
      const updatedCat: FinanceCategory = {
        ...editingFinanceCategory,
        name: newCategoryName.trim()
      };
      await apiUpdateFinanceCategory(updatedCat);
      setEditingFinanceCategory(null);
    } else {
      const cat: FinanceCategory = {
        id: Date.now().toString(),
        companyId: currentUser.companyId,
        name: newCategoryName.trim(),
        type: 'CHI',
        createdAt: new Date().toISOString()
      };
      await apiAddFinanceCategory(cat);
      setProductId(cat.id);
    }
    setFinanceSearch(newCategoryName.trim());
    setProductSearch('');
    setShowAddCategory(false);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (cat: FinanceCategory) => {
    if (confirm(`Bạn có chắc chắn muốn xóa hạng mục "${cat.name}"?`)) {
      await apiDeleteFinanceCategory(cat.id);
      if (productId === cat.id) {
        setProductId('');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row w-full max-w-4xl max-h-[95vh] sm:max-h-[90dvh] gap-4">
        
        {/* Guide Side */}
        <div className="hidden md:flex flex-col w-[350px] bg-[#f8faff] rounded-2xl p-6 shadow-2xl shrink-0 overflow-y-auto">
          <h3 className="text-xl font-bold text-blue-900 mb-6">Hướng Dẫn Thực Hiện:</h3>
          <div className="space-y-6 text-sm text-blue-900">
            <div>
              <p>1. Lấy vật tư đối tác chi cho công trình. Phải chọn vào <span className="font-bold">Danh mục hàng hóa (Đối tác)</span> lúc này ứng dụng bắt buộc phải chọn <span className="font-bold">Tên Công Trình</span> và <span className="font-bold">Tên Đối Tác</span> mới cho cập nhật chi để tránh nhầm lẫn.</p>
            </div>
            <div>
              <p>2. Chi cho công trình nhưng không lấy vật tư đối tác. Chọn hạng mục chi trong mục <span className="font-bold">Hạng mục độc lập (Tài chính)</span>, chọn <span className="font-bold">Tên Công Trình</span> và KHÔNG chọn Tên Đối Tác.</p>
            </div>
            <div>
              <p>3. Chi trả nợ đối tác. Chọn hạng mục chi trong mục <span className="font-bold">Hạng mục độc lập (Tài chính)</span>, chọn <span className="font-bold">Tên Đối Tác</span> và KHÔNG chọn Tên Công Trình.</p>
            </div>
            <div>
              <p>4. Chi khoản khác. Chọn hạng mục chi trong mục <span className="font-bold">Hạng mục độc lập (Tài chính)</span>, bỏ chọn các ô còn lại và cập nhật thêm chi.</p>
            </div>
          </div>
        </div>

        {/* Form Side */}
        <div className="bg-white rounded-2xl flex-1 overflow-hidden shadow-2xl flex flex-col">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Chi' : 'Thêm Chi'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition-all">
              <IconX className="w-6 h-6" />
            </button>
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <form id="chi-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
            </div>
            <CurrencyInput label="Số tiền" value={amount} onChange={setAmount} required={true} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hạng mục chi</label>
              <div className="flex gap-2" ref={dropdownRef}>
                <div className="relative flex-1">
                  <div 
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white cursor-pointer flex justify-between items-center outline-none focus:border-blue-500"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <span className={productId ? 'text-gray-900' : 'text-gray-500'}>
                      {products.find((p: any) => p.id === productId)?.name || financeCategories.find((c: any) => c.id === productId)?.name || '-- Chọn hạng mục --'}
                    </span>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 border-b border-gray-100 z-10">Danh mục hàng hóa (Đối tác)</div>
                      {products.map((p: any) => (
                        <div 
                          key={p.id} 
                          className={`px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm ${productId === p.id ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-gray-700'}`}
                          onClick={() => { setProductId(p.id); setIsDropdownOpen(false); }}
                        >
                          {p.name}
                        </div>
                      ))}
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 border-y border-gray-100 z-10 mt-1">Hạng mục độc lập (Tài chính)</div>
                      {financeCategories.map((c: any) => (
                        <div 
                          key={c.id} 
                          className={`flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 cursor-pointer text-sm group ${productId === c.id ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-gray-700'}`}
                          onClick={() => { setProductId(c.id); setIsDropdownOpen(false); }}
                        >
                          <span className="py-1">{c.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                               type="button" 
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setEditingFinanceCategory(c); 
                                 setNewCategoryName(c.name); 
                                 setShowAddCategory(true); 
                                 setIsDropdownOpen(false); 
                               }}
                               className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                             >
                               <IconEdit className="w-4 h-4" />
                             </button>
                             <button 
                               type="button"
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 handleDeleteCategory(c); 
                               }}
                               className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                             >
                               <IconTrash className="w-4 h-4" />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => {
                  setEditingFinanceCategory(null);
                  setNewCategoryName('');
                  setShowAddCategory(!showAddCategory);
                }} className="px-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 shrink-0">
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
              {showAddCategory && (
                <div className="mt-2 flex gap-2">
                  <input type="text" placeholder="Tên hạng mục..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={handleSaveCategory} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Lưu</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên Công Trình</label>
              <input 
                list="customer-list-chi"
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  const selected = customers.find((c: Customer) => c.name === e.target.value);
                  if (selected) setCustomerId(selected.id);
                  else if (e.target.value === '') setCustomerId('');
                }}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
                placeholder="-- Chọn công trình --"
              />
              <datalist id="customer-list-chi">
                {customers.map((c: Customer) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Đối Tác</label>
              <div className="flex gap-2 items-center">
                <input 
                  list="partner-list-chi"
                  value={partnerSearch}
                  onChange={e => {
                    setPartnerSearch(e.target.value);
                    const selected = partners.find((p: Partner) => p.name === e.target.value);
                    if (selected) setPartnerId(selected.id);
                    else if (e.target.value === '') setPartnerId('');
                  }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
                  placeholder="-- Không chọn --"
                />
                <label className="flex items-center gap-2 shrink-0 bg-green-50 text-green-700 px-4 py-2.5 rounded-xl border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                  <input type="checkbox" checked={isAutoPaid} onChange={(e) => setIsAutoPaid(e.target.checked)} className="w-5 h-5 accent-green-600 rounded" />
                  <span className="text-sm font-bold whitespace-nowrap">Đã thanh toán</span>
                </label>
              </div>
              <datalist id="partner-list-chi">
                {partners.map((p: Partner) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
              <input type="text" value={content} onChange={e => setContent(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
              <input type="text" value={executor} onChange={e => setExecutor(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" />
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
          <button type="submit" form="chi-form" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition-colors">
            {initialData ? 'Cập Nhật Chi' : 'Lưu Chi'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
