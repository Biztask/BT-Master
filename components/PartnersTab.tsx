import React, { useState, useEffect } from 'react';
import { User, Partner, Product, PartnerTransaction, FinanceCategory, RowTag } from '../types';
import { 
  subscribeToPartners, 
  subscribeToProducts, 
  subscribeToPartnerTransactions,
  subscribeToFinanceCategories,
  subscribeToRowTags,
  apiAddPartner,
  apiAddProduct,
  apiAddPartnerTransaction,
  apiDeletePartnerTransaction,
  apiUpdatePartner,
  apiDeletePartner,
  apiUpdateProduct,
  apiDeleteProduct
} from '../services/storageService';
import { IconPlus, IconX, IconUser, IconBriefcase, IconSearch, IconDownload, IconEdit, IconTrash } from './Icons';
import RowTagSelector from './RowTagSelector';
import * as XLSX from 'xlsx';

interface PartnersTabProps {
  currentUser: User;
}

export default function PartnersTab({ currentUser }: PartnersTabProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [rowTags, setRowTags] = useState<RowTag[]>([]);
  
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Detail view filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Summary view filters
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');

  const [editingTransaction, setEditingTransaction] = useState<PartnerTransaction | null>(null);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'debts' | 'partners' | 'products'>('debts');
  const [partnerSearch, setPartnerSearch] = useState('');

  useEffect(() => {
    const unsubPartners = subscribeToPartners(currentUser.companyId, setPartners);
    const unsubProducts = subscribeToProducts(currentUser.companyId, setProducts);
    const unsubTransactions = subscribeToPartnerTransactions(currentUser.companyId, setTransactions);
    const unsubFinanceCategories = subscribeToFinanceCategories(currentUser.companyId, setFinanceCategories);
    const unsubRowTags = subscribeToRowTags(currentUser.companyId, 'PARTNER', setRowTags);

    return () => {
      unsubPartners();
      unsubProducts();
      unsubTransactions();
      unsubFinanceCategories();
      unsubRowTags();
    };
  }, [currentUser.companyId]);

  // Calculate summary
  const partnerSummaries = partners.map(partner => {
    let allTx = transactions.filter(t => t.partnerId === partner.id);
    
    // Calculate debt before start date (Dư nợ đầu kỳ)
    let periodInitialDebt = partner.initialDebt;
    if (summaryStartDate) {
      const beforeTx = allTx.filter(t => t.date < summaryStartDate);
      const beforePurchase = beforeTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
      const beforePaid = beforeTx.reduce((sum, t) => sum + t.paidAmount, 0);
      periodInitialDebt = partner.initialDebt + beforePurchase - beforePaid;
    }

    // Filter transactions in the period
    let periodTx = allTx;
    if (summaryStartDate) {
      periodTx = periodTx.filter(t => t.date >= summaryStartDate);
    }
    if (summaryEndDate) {
      periodTx = periodTx.filter(t => t.date <= summaryEndDate);
    }

    const totalPurchase = periodTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
    const totalPaid = periodTx.reduce((sum, t) => sum + t.paidAmount, 0);
    const remainingDebt = periodInitialDebt + totalPurchase - totalPaid;

    return {
      ...partner,
      periodInitialDebt,
      totalPurchase,
      totalPaid,
      remainingDebt
    };
  }).filter(p => p.name.toLowerCase().includes(partnerSearch.toLowerCase()))
    .sort((a, b) => b.remainingDebt - a.remainingDebt);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount);
  };

  const exportSummaryToExcel = () => {
    const data = partnerSummaries.map((p, index) => ({
      'STT': index + 1,
      'Tên đối tác': p.name,
      'Điện thoại': p.phone,
      'Địa chỉ': p.address,
      'Dư nợ đầu': p.periodInitialDebt,
      'Tiền Mua': p.totalPurchase,
      'Đã trả': p.totalPaid,
      'Còn Nợ': p.remainingDebt
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CongNoDoiTac");
    XLSX.writeFile(wb, `CongNoDoiTac_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummaryTable = () => {
    const totalSummaryInitialDebt = partnerSummaries.reduce((sum, p) => sum + p.periodInitialDebt, 0);
    const totalSummaryPurchase = partnerSummaries.reduce((sum, p) => sum + p.totalPurchase, 0);
    const totalSummaryPaid = partnerSummaries.reduce((sum, p) => sum + p.totalPaid, 0);
    const totalSummaryDebt = partnerSummaries.reduce((sum, p) => sum + p.remainingDebt, 0);

    return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Tìm tên đối tác..."
              value={partnerSearch}
              onChange={e => setPartnerSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 w-48 md:w-64"
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
          {(summaryStartDate || summaryEndDate) && (
            <button 
              onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Xóa lọc
            </button>
          )}
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
              <th className="px-2 md:px-4 py-3 sticky left-8 md:left-12 bg-gray-50 z-30">Tên đối tác</th>
              <th className="px-2 md:px-4 py-3">Điện thoại</th>
              <th className="px-2 md:px-4 py-3">Địa chỉ</th>
              <th className="px-2 md:px-4 py-3 text-right">Dư nợ đầu</th>
              <th className="px-2 md:px-4 py-3 text-right">Tiền Mua</th>
              <th className="px-2 md:px-4 py-3 text-right">Đã trả</th>
              <th className="px-2 md:px-4 py-3 text-right">Còn Nợ</th>
              <th className="px-2 md:px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-blue-50/80 font-bold text-blue-900 border-b-2 border-blue-200">
              <td colSpan={4} className="px-2 md:px-4 py-3 text-center sticky left-0 z-10 bg-blue-50/80">Tổng cộng</td>
              <td className="px-2 md:px-4 py-3 text-right">{formatCurrency(totalSummaryInitialDebt)}</td>
              <td className="px-2 md:px-4 py-3 text-right text-orange-700">{formatCurrency(totalSummaryPurchase)}</td>
              <td className="px-2 md:px-4 py-3 text-right text-green-700">{formatCurrency(totalSummaryPaid)}</td>
              <td className="px-2 md:px-4 py-3 text-right text-red-700">{formatCurrency(totalSummaryDebt)}</td>
              <td className="px-2 md:px-4 py-3"></td>
            </tr>
            {partnerSummaries.map((p, index) => {
              const rowTag = rowTags.find(t => t.id === p.rowTagId);
              const rowColor = rowTag?.color && rowTag.color !== 'transparent' ? rowTag.color : undefined;
              return (
              <tr 
                key={p.id} 
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                style={{ backgroundColor: rowColor ? `${rowColor}15` : undefined }}
                onClick={() => setSelectedPartnerId(p.id)}
              >
                <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 z-10" style={{ backgroundColor: rowColor ? `${rowColor}15` : 'white' }}>{index + 1}</td>
                <td className="px-2 md:px-4 py-3 font-medium text-gray-900 sticky left-8 md:left-12 z-10" style={{ backgroundColor: rowColor ? `${rowColor}15` : 'white' }}>{p.name}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600">{p.phone}</td>
                <td className="px-2 md:px-4 py-3 text-gray-600">{p.address}</td>
                <td className="px-2 md:px-4 py-3 text-right text-gray-600">{formatCurrency(p.periodInitialDebt)}</td>
                <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(p.totalPurchase)}</td>
                <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(p.totalPaid)}</td>
                <td className="px-2 md:px-4 py-3 text-right font-bold text-red-600">{formatCurrency(p.remainingDebt)}</td>
                <td className="px-2 md:px-4 py-3" onClick={e => e.stopPropagation()}>
                  <RowTagSelector 
                    companyId={currentUser.companyId}
                    type="PARTNER"
                    tags={rowTags}
                    selectedTagId={p.rowTagId}
                    onSelect={async (tagId) => {
                      const originalPartner = partners.find(partner => partner.id === p.id);
                      if (originalPartner) {
                        await apiUpdatePartner({ ...originalPartner, rowTagId: tagId });
                      }
                    }}
                  />
                </td>
              </tr>
            )})}
            {partnerSummaries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Chưa có đối tác nào. Bấm dấu + để thêm giao dịch/đối tác.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
    );
  };

  const renderDetailView = () => {
    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) return null;

    let allTx = transactions.filter(t => t.partnerId === partner.id);
    
    let periodInitialDebt = partner.initialDebt;
    if (startDate) {
      const beforeTx = allTx.filter(t => t.date < startDate);
      const beforePurchase = beforeTx.reduce((sum, t) => sum + t.purchaseAmount, 0);
      const beforePaid = beforeTx.reduce((sum, t) => sum + t.paidAmount, 0);
      periodInitialDebt = partner.initialDebt + beforePurchase - beforePaid;
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
        const product = products.find(p => p.id === t.productId) || financeCategories.find(c => c.id === t.productId);
        return {
          'STT': index + 1,
          'Ngày': new Date(t.date).toLocaleDateString('vi-VN'),
          'Tên đối tác': partner.name,
          'Tên hàng hóa': product?.name || 'N/A',
          'ĐVT': 'unit' in (product || {}) ? (product as Product).unit : '-',
          'Số Lượng': t.quantity,
          'Thành Tiền Mua': t.purchaseAmount,
          'Đã Trả': t.paidAmount,
          'Nội dung': t.content || '-',
          'Ghi chú': t.note || ''
        };
      });
      
      data.unshift({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên đối tác': '' as any,
        'Tên hàng hóa': '' as any,
        'ĐVT': 'Dư nợ đầu:' as any,
        'Số Lượng': '' as any,
        'Thành Tiền Mua': periodInitialDebt,
        'Đã Trả': '' as any,
        'Nội dung': '' as any,
        'Ghi chú': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên đối tác': '' as any,
        'Tên hàng hóa': '' as any,
        'ĐVT': 'Tổng cộng:' as any,
        'Số Lượng': '' as any,
        'Thành Tiền Mua': totalPurchase,
        'Đã Trả': totalPaid,
        'Nội dung': '' as any,
        'Ghi chú': '' as any
      });

      data.push({
        'STT': '' as any,
        'Ngày': '' as any,
        'Tên đối tác': '' as any,
        'Tên hàng hóa': '' as any,
        'ĐVT': 'Nợ cuối:' as any,
        'Số Lượng': '' as any,
        'Thành Tiền Mua': finalDebt,
        'Đã Trả': '' as any,
        'Nội dung': '' as any,
        'Ghi chú': '' as any
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ChiTietCongNo");
      XLSX.writeFile(wb, `ChiTietCongNo_${partner.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{partner.name}</h2>
            <p className="text-sm text-gray-500">{partner.phone} • {partner.address}</p>
          </div>
          <button 
            onClick={() => setSelectedPartnerId(null)}
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
                <th className="px-2 md:px-4 py-3">Tên đối tác</th>
                <th className="px-2 md:px-4 py-3">Tên hàng hóa</th>
                <th className="px-2 md:px-4 py-3">ĐVT</th>
                <th className="px-2 md:px-4 py-3 text-right">Số Lượng</th>
                <th className="px-2 md:px-4 py-3 text-right">Thành Tiền Mua</th>
                <th className="px-2 md:px-4 py-3 text-right">Đã Trả</th>
                <th className="px-2 md:px-4 py-3">Nội dung</th>
                <th className="px-2 md:px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-gray-50 font-medium">
                <td colSpan={6} className="px-2 md:px-4 py-3 text-right text-gray-700 sticky left-0 z-10">Tổng cộng:</td>
                <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(totalPurchase)}</td>
                <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(totalPaid)}</td>
                <td></td>
                <td></td>
              </tr>
              <tr className="bg-blue-50/50">
                <td colSpan={6} className="px-2 md:px-4 py-3 font-medium text-gray-700 text-right sticky left-0 z-10">Dư nợ đầu:</td>
                <td colSpan={2} className="px-2 md:px-4 py-3 font-bold text-gray-900 text-right">{formatCurrency(periodInitialDebt)}</td>
                <td></td>
                <td></td>
              </tr>
              {filteredTx.map((t, index) => {
                const product = products.find(p => p.id === t.productId) || financeCategories.find(c => c.id === t.productId);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-2 md:px-4 py-3 text-gray-500 sticky left-0 bg-white z-10">{index + 1}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900 sticky left-8 md:left-12 bg-white z-10">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900">{partner.name}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-900">{product?.name || 'N/A'}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-600">{'unit' in (product || {}) ? (product as Product).unit : '-'}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-gray-900">{t.quantity}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-orange-600">{formatCurrency(t.purchaseAmount)}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-green-600">{formatCurrency(t.paidAmount)}</td>
                    <td className="px-2 md:px-4 py-3 text-gray-600">{t.content || '-'}</td>
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
                                  await apiDeletePartnerTransaction(t.id);
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

  const renderPartnersDirectory = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAddPartnerModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <IconPlus className="w-4 h-4" /> Thêm đối tác
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Tên đối tác</th>
                <th className="px-4 py-3">Điện thoại</th>
                <th className="px-4 py-3">Địa chỉ</th>
                <th className="px-4 py-3 text-right">Dư nợ đầu</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {partners.map((p, index) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{p.address}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.initialDebt)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingPartner(p)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa đối tác"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Bạn có chắc chắn muốn xóa đối tác này? Các giao dịch liên quan có thể bị ảnh hưởng.')) {
                            try {
                              await apiDeletePartner(p.id);
                            } catch (error) {
                              console.error('Error deleting partner:', error);
                              alert('Có lỗi xảy ra khi xóa đối tác.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa đối tác"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Chưa có đối tác nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProductsDirectory = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAddProductModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <IconPlus className="w-4 h-4" /> Thêm hàng hóa
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3">STT</th>
                <th className="px-4 py-3">Tên hàng hóa</th>
                <th className="px-4 py-3">Đơn vị tính</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p, index) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setEditingProduct(p)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Sửa hàng hóa"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Bạn có chắc chắn muốn xóa hàng hóa này? Các giao dịch liên quan có thể bị ảnh hưởng.')) {
                            try {
                              await apiDeleteProduct(p.id);
                            } catch (error) {
                              console.error('Error deleting product:', error);
                              alert('Có lỗi xảy ra khi xóa hàng hóa.');
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Xóa hàng hóa"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Chưa có hàng hóa nào.
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
          <h1 className="text-2xl font-bold text-gray-900 uppercase">QUẢN LÝ CÔNG NỢ ĐỐI TÁC</h1>
          <p className="text-gray-500 text-sm mt-1">Theo dõi mua hàng và thanh toán nhà cung cấp</p>
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
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'partners' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveSubTab('partners')}
        >
          Danh mục đối tác
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeSubTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          onClick={() => setActiveSubTab('products')}
        >
          Danh mục hàng hóa
        </button>
      </div>

      {activeSubTab === 'debts' && (
        selectedPartnerId ? renderDetailView() : renderSummaryTable()
      )}
      {activeSubTab === 'partners' && renderPartnersDirectory()}
      {activeSubTab === 'products' && renderProductsDirectory()}

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
          partners={partners}
          products={products}
          onAddPartner={() => setShowAddPartnerModal(true)}
          onAddProduct={() => setShowAddProductModal(true)}
          initialData={editingTransaction}
        />
      )}

      {(showAddPartnerModal || editingPartner) && (
        <AddPartnerModal 
          onClose={() => {
            setShowAddPartnerModal(false);
            setEditingPartner(null);
          }}
          currentUser={currentUser}
          initialData={editingPartner}
        />
      )}

      {(showAddProductModal || editingProduct) && (
        <AddProductModal 
          onClose={() => {
            setShowAddProductModal(false);
            setEditingProduct(null);
          }}
          currentUser={currentUser}
          initialData={editingProduct}
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

import { apiUpdatePartnerTransaction } from '../services/storageService';

function AddTransactionModal({ onClose, currentUser, partners, products, onAddPartner, onAddProduct, initialData }: any) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [partnerId, setPartnerId] = useState(initialData?.partnerId || '');
  const [productId, setProductId] = useState(initialData?.productId || '');
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() || '');
  const [purchaseAmount, setPurchaseAmount] = useState(initialData?.purchaseAmount?.toString() || '');
  const [paidAmount, setPaidAmount] = useState(initialData?.paidAmount?.toString() || '');
  const [note, setNote] = useState(initialData?.note || '');

  const selectedProduct = products.find((p: Product) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || !productId) {
      alert("Vui lòng chọn đối tác và hàng hóa");
      return;
    }

    const tx: PartnerTransaction = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      partnerId,
      productId,
      customerId: initialData?.customerId || '',
      content: initialData?.content || '',
      executor: initialData?.executor || '',
      date,
      quantity: Number(quantity) || 0,
      purchaseAmount: Number(purchaseAmount) || 0,
      paidAmount: Number(paidAmount) || 0,
      note,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      createdBy: initialData?.createdBy || currentUser.id
    };

    if (initialData) {
      await apiUpdatePartnerTransaction(tx);
    } else {
      await apiAddPartnerTransaction(tx);
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
          <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Đối tác</label>
              <div className="flex gap-2">
                <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                  <option value="">-- Chọn đối tác --</option>
                  {partners.map((p: Partner) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={onAddPartner} className="px-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100">
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hàng hóa</label>
              <div className="flex gap-2">
                <select value={productId} onChange={e => setProductId(e.target.value)} className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                  <option value="">-- Chọn hàng hóa --</option>
                  {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={onAddProduct} className="px-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100">
                  <IconPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {selectedProduct && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ĐVT</label>
                <input type="text" value={selectedProduct.unit} disabled className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-gray-500" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
              </div>
              <CurrencyInput 
                label="Thành tiền mua" 
                value={purchaseAmount} 
                onChange={setPurchaseAmount} 
                required={false} 
              />
            </div>

            <CurrencyInput 
              label="Đã trả" 
              value={paidAmount} 
              onChange={setPaidAmount} 
              required={false} 
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"></textarea>
            </div>
          </form>
        </div>
        <div className="p-4 border-t border-gray-100 shrink-0 bg-white">
          <button type="submit" form="tx-form" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
            {initialData ? 'Cập Nhật Giao Dịch' : 'Lưu Giao Dịch'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPartnerModal({ onClose, currentUser, initialData }: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [initialDebt, setInitialDebt] = useState(initialData?.initialDebt?.toString() || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const partner: Partner = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      name,
      phone,
      address,
      initialDebt: Number(initialDebt) || 0,
      createdAt: initialData?.createdAt || new Date().toISOString()
    };
    if (initialData) {
      await apiUpdatePartner(partner);
    } else {
      await apiAddPartner(partner);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Đối Tác' : 'Thêm Đối Tác'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đối tác</label>
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
          <CurrencyInput 
            label="Dư nợ đầu" 
            value={initialDebt} 
            onChange={setInitialDebt} 
            required={false} 
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4">
            {initialData ? 'Cập Nhật Đối Tác' : 'Lưu Đối Tác'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddProductModal({ onClose, currentUser, initialData }: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [unit, setUnit] = useState(initialData?.unit || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product: Product = {
      id: initialData?.id || Date.now().toString(),
      companyId: currentUser.companyId,
      name,
      unit,
      createdAt: initialData?.createdAt || new Date().toISOString()
    };
    if (initialData) {
      await apiUpdateProduct(product);
    } else {
      await apiAddProduct(product);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{initialData ? 'Sửa Hàng Hóa' : 'Thêm Hàng Hóa'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính (ĐVT)</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4">
            {initialData ? 'Cập Nhật Hàng Hóa' : 'Lưu Hàng Hóa'}
          </button>
        </form>
      </div>
    </div>
  );
}
