import React, { useState, useEffect, useMemo } from 'react';
import MobileTabNavigation from './MobileTabNavigation';
import { 
  User, 
  InventoryItem, 
  InventoryTransaction, 
  InventoryTxType, 
  InventoryCheckLog,
  Partner,
  Customer
} from '../types';
import { 
  subscribeToInventoryItems,
  apiAddInventoryItem,
  apiUpdateInventoryItem,
  apiDeleteInventoryItem,
  subscribeToInventoryTransactions,
  apiAddInventoryTransaction,
  apiDeleteInventoryTransactionsByCompany,
  subscribeToInventoryCheckLogs,
  apiAddInventoryCheckLog,
  subscribeToPartners,
  subscribeToCustomers,
  apiUpdatePartner,
  apiAddPartnerTransaction,
  apiUpdateCustomer,
  apiAddCustomerTransaction,
  apiDeletePartnerTransaction,
  apiDeleteCustomerTransaction,
  apiDeleteInventoryTransaction
} from '../services/storageService';
import { 
  IconPlus, 
  IconTrash, 
  IconSearch, 
  IconX,
  IconEdit,
  IconCheck,
  IconDownload,
  IconAlert
} from './Icons';
import * as XLSX from 'xlsx';
import { SearchableSelect } from './SearchableSelect';

const InlineCurrencyInput = ({ value, onChange, placeholder, className, readOnly = false, min = 0 }: any) => {
  const displayValue = value ? new Intl.NumberFormat('vi-VN').format(Number(value)) : '';
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\./g, '');
    if (rawValue === '') { onChange(0); return; }
    const num = parseFloat(rawValue);
    if (!isNaN(num)) onChange(num);
  };
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      className={className}
      readOnly={readOnly}
    />
  );
};

interface InventoryTabProps {
  currentUser: User;
  isLocked?: boolean;
}

const InventoryTab: React.FC<InventoryTabProps> = ({ currentUser, isLocked }) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'history'>('inventory');
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [checkLogs, setCheckLogs] = useState<InventoryCheckLog[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedItemForCard, setSelectedItemForCard] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const unsubItems = subscribeToInventoryItems(currentUser.companyId, setItems);
    const unsubTx = subscribeToInventoryTransactions(currentUser.companyId, setTransactions);
    const unsubLogs = subscribeToInventoryCheckLogs(currentUser.companyId, setCheckLogs);
    const unsubPartners = subscribeToPartners(currentUser.companyId, setPartners);
    const unsubCustomers = subscribeToCustomers(currentUser.companyId, setCustomers);

    return () => {
      unsubItems();
      unsubTx();
      unsubLogs();
      unsubPartners();
      unsubCustomers();
    };
  }, [currentUser.companyId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const recentTransactions = useMemo(() => {
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    return transactions
      .filter(tx => new Date(tx.date) >= fortyFiveDaysAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // --- Add Item Logic ---
  const [itemForm, setItemForm] = useState({
    code: '',
    name: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    supplierId: '',
    note: ''
  });

  const handleAddItem = async () => {
    if (!itemForm.code || !itemForm.name || !itemForm.unit) {
      alert("Vui lòng nhập mã hàng, tên mặt hàng và đơn vị tính.");
      return;
    }
    
    const existing = items.find(i => i.code?.toLowerCase() === itemForm.code.toLowerCase());
    if (existing) {
      alert("Mã hàng hóa này đã tồn tại trong kho.");
      return;
    }

    const newItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      companyId: currentUser.companyId,
      code: itemForm.code,
      name: itemForm.name,
      unit: itemForm.unit,
      quantity: Number(itemForm.quantity) || 0,
      unitPrice: Number(itemForm.unitPrice) || 0,
      supplierId: itemForm.supplierId,
      note: itemForm.note,
      updatedAt: new Date().toISOString()
    };

    await apiAddInventoryItem(newItem);
    setShowAddItemModal(false);
    setItemForm({ code: '', name: '', unit: '', quantity: 0, unitPrice: 0, supplierId: '', note: '' });
    alert("Thêm mặt hàng thành công!");
  };

  // --- Import / Export Logic ---
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().split('T')[0],
    items: [{ itemId: '', quantity: 0, unitPrice: 0, unit: '', name: '' }],
    partnerId: '',
    customerId: '',
    note: '',
    performer: ''
  });

  const handleImport = async () => {
    try {
      if (txForm.items.length === 0 || !txForm.partnerId) {
        alert("Vui lòng điền đối tác và ít nhất một mặt hàng.");
        return;
      }

      let totalAmount = 0;
      const validItems = [];
      const quantityUpdates: Record<string, number> = {};

      for (const txItem of txForm.items) {
        const qty = Number(txItem.quantity);
        const price = Number(txItem.unitPrice);
        
        if (!txItem.itemId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
          alert("Vui lòng điền đầy đủ thông tin (Tên hàng, Số lượng > 0, Đơn giá >= 0) cho tất cả các dòng.");
          return;
        }
        const item = items.find(i => i.id === txItem.itemId);
        if (!item) {
          alert("Vui lòng chọn mặt hàng hợp lệ.");
          return;
        }
        
        const currentQty = quantityUpdates[item.id] !== undefined ? quantityUpdates[item.id] : Number(item.quantity || 0);
        quantityUpdates[item.id] = currentQty + qty;
        
        validItems.push({ txItem: { ...txItem, quantity: qty, unitPrice: price }, item, newQty: quantityUpdates[item.id] });
        totalAmount += qty * price;
      }

      const linkedTxId = Math.random().toString(36).substr(2, 9);
      let noteParts: string[] = [];

      // Process each item
      for (const { txItem, item, newQty } of validItems) {
        await apiUpdateInventoryItem({
          ...item,
          quantity: newQty,
          unitPrice: txItem.unitPrice, // Update to latest price
          supplierId: txForm.partnerId,
          updatedAt: new Date().toISOString()
        });

        const txId = Math.random().toString(36).substr(2, 9);
        const itemTotalAmount = txItem.quantity * txItem.unitPrice;
        
        const tx: InventoryTransaction = {
          id: txId,
          companyId: currentUser.companyId,
          itemId: item.id,
          type: InventoryTxType.IMPORT,
          quantity: Number(txItem.quantity),
          unitPrice: Number(txItem.unitPrice),
          totalAmount: itemTotalAmount,
          date: txForm.date,
          partnerId: txForm.partnerId,
          note: txForm.note,
          createdBy: txForm.performer || '',
          createdAt: new Date().toISOString(),
          linkedTxId: linkedTxId
        };
        await apiAddInventoryTransaction(tx);
        noteParts.push(`${item.name} (SL: ${txItem.quantity})`);
      }

      // Add to Partner Debt
      const partner = partners.find(p => p.id === txForm.partnerId);
      if (partner) {
        await apiAddPartnerTransaction({
          id: linkedTxId,
          companyId: currentUser.companyId,
          partnerId: partner.id,
          productId: 'inventory_import', // Using first item ID just for reference
          quantity: 1, // Doesn't matter much for aggregated partner tx
          date: txForm.date,
          purchaseAmount: totalAmount,
          paidAmount: 0,
          content: `Nhập kho: ${noteParts.join(', ')}`,
          note: txForm.note || '',
          executor: txForm.performer || '',
          createdBy: currentUser.name || '',
          createdAt: new Date().toISOString()
        });
      }

      setShowImportModal(false);
      resetTxForm();
      alert("Nhập hàng thành công!");
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi khi nhập hàng. Vui lòng thử lại!");
    }
  };

  const handleExport = async () => {
    try {
      if (txForm.items.length === 0 || !txForm.customerId) {
        alert("Vui lòng điền công trình và ít nhất một mặt hàng.");
        return;
      }

      let totalAmount = 0;
      const validItems = [];
      const quantityUpdates: Record<string, number> = {};

      for (const txItem of txForm.items) {
        const qty = Number(txItem.quantity);
        const price = Number(txItem.unitPrice);

        if (!txItem.itemId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
          alert("Vui lòng điền đầy đủ thông tin (Tên hàng, Số lượng > 0, Đơn giá >= 0) cho tất cả các dòng.");
          return;
        }
        const item = items.find(i => i.id === txItem.itemId);
        if (!item) {
          alert("Vui lòng chọn mặt hàng hợp lệ.");
          return;
        }
        
        const currentQty = quantityUpdates[item.id] !== undefined ? quantityUpdates[item.id] : Number(item.quantity || 0);
        if (currentQty < qty) {
          alert(`Số lượng xuất của ${item.name} (${qty}) vượt quá tồn kho hiện tại (${currentQty}).`);
          return;
        }
        quantityUpdates[item.id] = currentQty - qty;
        
        const itemTotalAmount = qty * price;
        validItems.push({ txItem: { ...txItem, quantity: qty, unitPrice: price }, item, newQty: quantityUpdates[item.id], itemTotalAmount });
        totalAmount += itemTotalAmount;
      }

      const linkedTxId = Math.random().toString(36).substr(2, 9);
      let noteParts: string[] = [];

      // Process each item
      for (const { txItem, item, newQty, itemTotalAmount } of validItems) {
        await apiUpdateInventoryItem({
          ...item,
          quantity: newQty,
          updatedAt: new Date().toISOString()
        });

        const txId = Math.random().toString(36).substr(2, 9);
        
        const tx: InventoryTransaction = {
          id: txId,
          companyId: currentUser.companyId,
          itemId: item.id,
          type: InventoryTxType.EXPORT,
          quantity: Number(txItem.quantity),
          unitPrice: Number(txItem.unitPrice),
          totalAmount: itemTotalAmount,
          date: txForm.date,
          customerId: txForm.customerId,
          note: txForm.note,
          createdBy: txForm.performer || '',
          createdAt: new Date().toISOString(),
          linkedTxId: linkedTxId
        };
        await apiAddInventoryTransaction(tx);
        noteParts.push(`${item.name} (SL: ${txItem.quantity})`);
      }

      // Add to Customer Expense
      const customer = customers.find(c => c.id === txForm.customerId);
      if (customer) {
        await apiAddPartnerTransaction({
          id: linkedTxId,
          companyId: currentUser.companyId,
          partnerId: '',
          productId: 'inventory_export',
          customerId: customer.id,
          content: `Xuất kho: ${noteParts.join(', ')}`,
          executor: txForm.performer || '',
          date: txForm.date,
          quantity: 1,
          purchaseAmount: totalAmount,
          paidAmount: 0,
          note: txForm.note || '',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name || ''
        });
      }

      setShowExportModal(false);
      resetTxForm();
      alert("Xuất hàng thành công!");
    } catch (error) {
      console.error(error);
      alert("Đã xảy ra lỗi khi xuất hàng. Vui lòng thử lại!");
    }
  };

  const resetTxForm = () => {
    setTxForm({
      date: new Date().toISOString().split('T')[0],
      items: [{ itemId: '', quantity: 0, unitPrice: 0, unit: '', name: '' }],
      partnerId: '',
      customerId: '',
      note: '',
      performer: ''
    });
  };

  // --- Inventory Check Logic ---
  const [checkItems, setCheckItems] = useState<{id: string, actualQuantity: number}[]>([]);

  const openCheckModal = () => {
    setCheckItems(items.map(i => ({ id: i.id, actualQuantity: i.quantity || 0 })));
    setShowCheckModal(true);
  };

  const handleInventoryCheck = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn kiểm kho? Toàn bộ lịch sử nhập/xuất trước đó sẽ bị xóa để tiết kiệm dung lượng.")) {
      return;
    }

    try {
      // Update items with actual quantities
      for (const ci of checkItems) {
        const item = items.find(i => i.id === ci.id);
        if (item && item.quantity !== ci.actualQuantity) {
          await apiUpdateInventoryItem({
            ...item,
            quantity: ci.actualQuantity,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Delete all old transactions
      await apiDeleteInventoryTransactionsByCompany(currentUser.companyId);

      // Log the check
      await apiAddInventoryCheckLog({
        id: Math.random().toString(36).substr(2, 9),
        companyId: currentUser.companyId,
        date: new Date().toISOString(),
        createdBy: currentUser.name,
        note: "Kiểm kho định kỳ"
      });

      setShowCheckModal(false);
      alert("Kiểm kho thành công!");
    } catch (error) {
      console.error("Error during inventory check:", error);
      alert("Có lỗi xảy ra khi kiểm kho.");
    }
  };

  const handleDeleteTransaction = async (tx: InventoryTransaction) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này? Hành động này sẽ hoàn tác số lượng tồn kho và xóa các giao dịch tài chính liên quan.")) {
      return;
    }

    const item = items.find(i => i.id === tx.itemId);
    if (item) {
      // Hoàn tác số lượng
      let newQuantity = item.quantity || 0;
      if (tx.type === InventoryTxType.IMPORT) {
        newQuantity -= tx.quantity;
      } else if (tx.type === InventoryTxType.EXPORT) {
        newQuantity += tx.quantity;
      }
      
      await apiUpdateInventoryItem({
        ...item,
        quantity: newQuantity,
        updatedAt: new Date().toISOString()
      });
    }

    // Xóa giao dịch tài chính liên quan (nếu có)
    if (tx.linkedTxId) {
      if (tx.type === InventoryTxType.IMPORT) {
        await apiDeletePartnerTransaction(tx.linkedTxId);
      } else if (tx.type === InventoryTxType.EXPORT) {
        await apiDeletePartnerTransaction(tx.linkedTxId);
      }
    }

    // Xóa giao dịch kho
    await apiDeleteInventoryTransaction(tx.id);
    alert("Đã xóa giao dịch thành công!");
  };

  // --- Render Helpers ---
  const renderInventoryTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 justify-between items-center bg-gray-50/50">
        <div className="relative">
          <IconSearch className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Tìm tên, mã hàng..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 w-64"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { resetTxForm(); setShowImportModal(true); }}
            disabled={isLocked}
            className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <IconPlus className="w-4 h-4" /> Nhập Hàng
          </button>
          <button 
            onClick={() => { resetTxForm(); setShowExportModal(true); }}
            disabled={isLocked}
            className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            <IconPlus className="w-4 h-4" /> Xuất Hàng
          </button>
          <button 
            onClick={openCheckModal}
            disabled={isLocked}
            className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <IconCheck className="w-4 h-4" /> Kiểm Kho
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left min-w-[800px]">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap sticky left-0 bg-gray-50 z-10 border-r border-gray-200">STT</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap sticky left-[40px] sm:left-[50px] bg-gray-50 z-10 border-r border-gray-200">Mã hàng hóa</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap sticky left-[120px] sm:left-[150px] bg-gray-50 z-10 border-r border-gray-200 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">Tên mặt hàng</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Đơn vị</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Số lượng</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Đơn giá</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Tổng tiền</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Nhà cung cấp</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Ghi chú</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-center whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((item, index) => {
              const supplier = partners.find(p => p.id === item.supplierId);
              const itemTxs = transactions
                .filter(tx => tx.itemId === item.id)
                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              let displayQty = item.quantity || 0;
              let displayPrice = item.unitPrice || 0;
              let displayDate = item.updatedAt || '';

              if (itemTxs.length > 0) {
                let txSumQty = 0;
                itemTxs.forEach(tx => {
                  if (tx.type === InventoryTxType.IMPORT) txSumQty += tx.quantity;
                  else if (tx.type === InventoryTxType.EXPORT) txSumQty -= tx.quantity;
                });
                
                // If cached baseline is 0 but we have transaction history, history is the source of truth
                if (displayQty === 0 && txSumQty !== 0) {
                  displayQty = txSumQty;
                }

                const lastTx = itemTxs[itemTxs.length - 1];
                if (displayPrice === 0 && lastTx.unitPrice) {
                  displayPrice = lastTx.unitPrice;
                }
                if (!displayDate && lastTx.date) {
                  displayDate = lastTx.date;
                }
              }

              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => setSelectedItemForCard(item)}>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-500 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">{index + 1}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-gray-600 whitespace-nowrap sticky left-[40px] sm:left-[50px] bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200">{item.code || '-'}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-blue-600 hover:underline sticky left-[120px] sm:left-[150px] bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">{item.name}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600">{item.unit}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-bold text-gray-900">{displayQty}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right text-gray-600 whitespace-nowrap">{formatCurrency(displayPrice)}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-green-600 whitespace-nowrap">{formatCurrency(displayQty * displayPrice)}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600">{supplier?.name || ''}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600 truncate max-w-xs">{item.note}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        if (window.confirm('Bạn có chắc chắn muốn xóa mặt hàng này? Các lịch sử giao dịch liên quan sẽ không bị xóa.')) {
                          apiDeleteInventoryItem(item.id);
                        }
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa mặt hàng"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-8 sm:px-4 text-center text-gray-500">
                  Chưa có mặt hàng nào trong kho.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHistoryTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Lịch sử Nhập/Xuất (45 ngày gần nhất)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left min-w-[800px]">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Ngày</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Loại</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Mặt hàng</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Số lượng</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Đơn giá</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Tổng tiền</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Đối tác/Công trình</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Người thực hiện</th>
              <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentTransactions.map((tx) => {
              const item = items.find(i => i.id === tx.itemId);
              const partner = partners.find(p => p.id === tx.partnerId);
              const customer = customers.find(c => c.id === tx.customerId);
              return (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-900 whitespace-nowrap">{tx.date ? new Date(tx.date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                      tx.type === InventoryTxType.IMPORT ? 'bg-blue-100 text-blue-700' : 
                      tx.type === InventoryTxType.EXPORT ? 'bg-orange-100 text-orange-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tx.type === InventoryTxType.IMPORT ? 'Nhập' : tx.type === InventoryTxType.EXPORT ? 'Xuất' : 'Kiểm kho'}
                    </span>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-gray-900">{item?.name || 'N/A'}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-bold text-gray-900">{tx.quantity || 0}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right text-gray-600 whitespace-nowrap">{formatCurrency(tx.unitPrice || 0)}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(tx.totalAmount || ((tx.quantity || 0) * (tx.unitPrice || 0)))}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600">
                    {tx.type === InventoryTxType.IMPORT ? partner?.name : customer?.name}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600 whitespace-nowrap">{tx.createdBy}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-600 truncate max-w-xs">{tx.note}</td>
                </tr>
              );
            })}
            {recentTransactions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-8 sm:px-4 text-center text-gray-500">
                  Không có lịch sử giao dịch nào trong 45 ngày qua.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-2 sm:p-4 w-full mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Kho</h2>
          <p className="text-sm text-gray-500 mt-1">Tổng hợp và quản lý xuất nhập tồn kho</p>
        </div>
      </div>

      <MobileTabNavigation
        tabs={[
          { id: 'inventory', label: 'Tồn Kho' },
          { id: 'history', label: 'Lịch sử' }
        ]}
        activeTab={activeSubTab}
        onTabChange={(id) => setActiveSubTab(id as any)}
      />

      {activeSubTab === 'inventory' ? renderInventoryTable() : renderHistoryTable()}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 pb-24 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-blue-800">Nhập Hàng</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tháng</label>
                  <input 
                    type="date" 
                    value={txForm.date}
                    onChange={e => setTxForm({...txForm, date: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đối tác (Nhà cung cấp)</label>
                  <input 
                    type="text" 
                    list="partners-list"
                    value={partners.find(p => p.id === txForm.partnerId)?.name || txForm.partnerId}
                    onChange={e => {
                      const val = e.target.value;
                      const partner = partners.find(p => p.name === val);
                      setTxForm({...txForm, partnerId: partner ? partner.id : val});
                    }}
                    placeholder="Chọn đối tác..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <datalist id="partners-list">
                    {partners.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Danh sách mặt hàng</label>
                  <button 
                    onClick={() => {
                      setTxForm({
                        ...txForm,
                        items: [...txForm.items, { itemId: '', quantity: 0, unitPrice: 0, unit: '', name: '' }]
                      });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <IconPlus className="w-4 h-4" /> Thêm dòng
                  </button>
                </div>
                
                <div className="space-y-3">
                  {txForm.items.map((txItem, index) => {
                    const uniqueNames = Array.from(new Set(items.map(i => i.name)));
                    return (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <div className="w-full sm:w-1/4">
                        <SearchableSelect 
                          options={uniqueNames.map(n => ({ value: n, label: n }))}
                          value={txItem.name}
                          placeholder="Tên mặt hàng"
                          onChange={val => {
                            const newItems = [...txForm.items];
                            newItems[index] = {
                              ...txItem,
                              name: val,
                              itemId: '', // reset code
                              unit: '',
                              unitPrice: 0
                            };
                            setTxForm({...txForm, items: newItems});
                          }}
                          className="w-full"
                        />
                      </div>
                      <div className="w-full sm:w-1/4 flex gap-2">
                        <SearchableSelect 
                          options={items.filter(i => i.name === txItem.name || (!txItem.name && i.name)).map(i => ({ value: i.id, label: i.code ? `[${i.code}]` : '[Không mã]' }))}
                          value={txItem.itemId}
                          placeholder="Mã hàng hóa"
                          onChange={val => {
                            const existing = items.find(i => i.id === val);
                            const newItems = [...txForm.items];
                            if (existing) {
                              newItems[index] = {
                                ...txItem, 
                                itemId: existing.id,
                                unit: existing.unit,
                                unitPrice: Number(existing.unitPrice) || 0,
                                name: existing.name
                              };
                              
                              let newPartnerId = txForm.partnerId;
                              if (index === 0 && !txForm.partnerId && existing.supplierId) {
                                newPartnerId = existing.supplierId;
                              }
                              
                              setTxForm({...txForm, items: newItems, partnerId: newPartnerId});
                            } else {
                              newItems[index] = {
                                ...txItem,
                                itemId: '',
                                unit: '',
                                unitPrice: 0
                              };
                              setTxForm({...txForm, items: newItems});
                            }
                          }}
                          className="flex-1"
                        />
                        {index === 0 && (
                          <button 
                            onClick={() => setShowAddItemModal(true)}
                            className="bg-gray-200 text-gray-600 px-2 rounded-lg hover:bg-gray-300 transition-colors shrink-0"
                            title="Thêm mặt hàng mới"
                          >
                            <IconPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="w-full sm:w-auto flex gap-2 flex-1">
                        <div className="w-16 shrink-0">
                          <input 
                            type="text" 
                            value={txItem.unit}
                            placeholder="Đơn vị"
                            className="w-full border border-gray-300 rounded-lg px-2 py-2 outline-none bg-gray-100 text-gray-500 text-sm"
                            readOnly
                          />
                        </div>
                        <div className="w-20 shrink-0">
                          <input 
                            type="number" 
                            min="0"
                            placeholder="SL"
                            value={txItem.quantity || ''}
                            onChange={e => {
                              const newItems = [...txForm.items];
                              newItems[index].quantity = parseFloat(e.target.value) || 0;
                              setTxForm({...txForm, items: newItems});
                            }}
                            className="w-full border border-gray-300 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <InlineCurrencyInput 
                            placeholder="Đơn giá"
                            value={txItem.unitPrice || ''}
                            onChange={(val: number) => {
                              const newItems = [...txForm.items];
                              newItems[index].unitPrice = val;
                              setTxForm({...txForm, items: newItems});
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-32 flex justify-between items-center sm:justify-end gap-2 shrink-0">
                        <span className="font-bold text-gray-700 sm:hidden">Thành tiền:</span>
                        <div className="font-bold text-blue-700">
                          {formatCurrency(Number(txItem.quantity || 0) * Number(txItem.unitPrice || 0))}
                        </div>
                        <button 
                          onClick={() => {
                            const newItems = txForm.items.filter((_, i) => i !== index);
                            setTxForm({...txForm, items: newItems});
                          }}
                          className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          disabled={txForm.items.length === 1}
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
                
                <div className="flex justify-end mt-4 text-lg font-bold text-gray-800">
                  Tổng tiền nhập: <span className="text-blue-700 ml-2">{formatCurrency(txForm.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0))}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <input 
                    type="text" 
                    value={txForm.note}
                    onChange={e => setTxForm({...txForm, note: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
                  <input 
                    type="text" 
                    value={txForm.performer}
                    onChange={e => setTxForm({...txForm, performer: e.target.value})}
                    placeholder="Để trống nếu không muốn ghi nhận..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 pb-10 sm:p-6 sm:pb-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleImport}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Lưu Nhập Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 pb-24 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-orange-800">Xuất Hàng</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tháng</label>
                  <input 
                    type="date" 
                    value={txForm.date}
                    onChange={e => setTxForm({...txForm, date: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Công trình</label>
                  <input 
                    type="text" 
                    list="customers-list"
                    value={customers.find(c => c.id === txForm.customerId)?.name || txForm.customerId}
                    onChange={e => {
                      const val = e.target.value;
                      const customer = customers.find(c => c.name === val);
                      setTxForm({...txForm, customerId: customer ? customer.id : val});
                    }}
                    placeholder="Chọn công trình..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <datalist id="customers-list">
                    {customers.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-700">Danh sách mặt hàng xuất</label>
                  <button 
                    onClick={() => {
                      setTxForm({
                        ...txForm,
                        items: [...txForm.items, { itemId: '', quantity: 0, unitPrice: 0, unit: '', name: '' }]
                      });
                    }}
                    className="text-sm text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                  >
                    <IconPlus className="w-4 h-4" /> Thêm dòng
                  </button>
                </div>
                
                <div className="space-y-3">
                  {txForm.items.map((txItem, index) => {
                    const selectedItem = items.find(i => i.id === txItem.itemId);
                    const uniqueNames = Array.from(new Set(items.map(i => i.name)));
                    return (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <div className="w-full sm:w-1/4">
                          <SearchableSelect 
                            options={uniqueNames.map(n => ({ value: n, label: n }))}
                            value={txItem.name}
                            placeholder="Tên mặt hàng"
                            onChange={val => {
                              const newItems = [...txForm.items];
                              newItems[index] = {
                                ...txItem, 
                                name: val,
                                itemId: '', // reset code
                                unit: '',
                                unitPrice: 0
                              };
                              setTxForm({...txForm, items: newItems});
                            }}
                            className="w-full"
                          />
                        </div>
                        <div className="w-full sm:w-1/4">
                          <SearchableSelect 
                            options={items.filter(i => i.name === txItem.name || (!txItem.name && i.name)).map(i => ({ value: i.id, label: i.code ? `${i.code} (Tồn: ${i.quantity || 0})` : `[Không mã] (Tồn: ${i.quantity || 0})` }))}
                            value={txItem.itemId}
                            placeholder="Mã hàng hóa"
                            onChange={val => {
                              const existing = items.find(i => i.id === val);
                              const newItems = [...txForm.items];
                              if (existing) {
                                newItems[index] = {
                                  ...txItem, 
                                  itemId: existing.id,
                                  unit: existing.unit,
                                  unitPrice: Number(existing.unitPrice) || 0,
                                  name: existing.name
                                };
                                setTxForm({...txForm, items: newItems});
                              } else {
                                newItems[index] = {
                                  ...txItem,
                                  itemId: '',
                                  unit: '',
                                  unitPrice: 0
                                };
                                setTxForm({...txForm, items: newItems});
                              }
                            }}
                            className="w-full"
                          />
                        </div>
                        
                        <div className="w-full sm:w-auto flex gap-2 flex-1">
                          <div className="w-16 shrink-0">
                            <input 
                              type="text" 
                              value={txItem.unit}
                              placeholder="Đơn vị"
                              className="w-full border border-gray-300 rounded-lg px-2 py-2 outline-none bg-gray-100 text-gray-500 text-sm"
                              readOnly
                            />
                          </div>
                          <div className="w-20 shrink-0 flex flex-col">
                            <input 
                              type="number" 
                              min="0"
                              placeholder="SL"
                              value={txItem.quantity || ''}
                              onChange={e => {
                                const newItems = [...txForm.items];
                                newItems[index].quantity = parseFloat(e.target.value) || 0;
                                setTxForm({...txForm, items: newItems});
                              }}
                              className="w-full border border-gray-300 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            />
                            {selectedItem && (
                              <span className="text-xs text-gray-500 mt-1 pl-1">Tồn: {selectedItem.quantity || 0}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <InlineCurrencyInput 
                              placeholder="Đơn giá"
                              value={txItem.unitPrice || ''}
                              onChange={(val: number) => {
                                const newItems = [...txForm.items];
                                newItems[index].unitPrice = val;
                                setTxForm({...txForm, items: newItems});
                              }}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="w-full sm:w-32 flex justify-between items-center sm:justify-end gap-2 shrink-0">
                          <span className="font-bold text-gray-700 sm:hidden">Tạm tính:</span>
                          <div className="font-bold text-orange-700">
                            {formatCurrency(Number(txItem.quantity || 0) * Number(txItem.unitPrice || 0))}
                          </div>
                          <button 
                            onClick={() => {
                              const newItems = txForm.items.filter((_, i) => i !== index);
                              setTxForm({...txForm, items: newItems});
                            }}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            disabled={txForm.items.length === 1}
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-end mt-4 text-lg font-bold text-gray-800">
                  Tổng tiền xuất: <span className="text-orange-700 ml-2">
                    {formatCurrency(txForm.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <input 
                    type="text" 
                    value={txForm.note}
                    onChange={e => setTxForm({...txForm, note: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
                  <input 
                    type="text" 
                    value={txForm.performer}
                    onChange={e => setTxForm({...txForm, performer: e.target.value})}
                    placeholder="Để trống nếu không muốn ghi nhận..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 pb-10 sm:p-6 sm:pb-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleExport}
                className="px-6 py-2.5 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
              >
                Lưu Xuất Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Card Modal */}
      {selectedItemForCard && (() => {
        const itemTxs = transactions
          .filter(tx => tx.itemId === selectedItemForCard.id)
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let displayQty = selectedItemForCard.quantity || 0;
        if (displayQty === 0 && itemTxs.length > 0) {
          let txSumQty = 0;
          itemTxs.forEach(tx => {
            if (tx.type === InventoryTxType.IMPORT) txSumQty += tx.quantity;
            else if (tx.type === InventoryTxType.EXPORT) txSumQty -= tx.quantity;
          });
          if (txSumQty !== 0) displayQty = txSumQty;
        }

        return (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 pb-24 sm:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[90vh]">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Thẻ Kho: {selectedItemForCard.name}</h3>
                  <p className="text-sm text-gray-500">Tồn kho hiện tại: <span className="font-bold text-gray-900">{displayQty} {selectedItemForCard.unit}</span></p>
                </div>
                <button onClick={() => setSelectedItemForCard(null)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            <div className="p-0 overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-xs sm:text-sm text-left min-w-[800px]">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Ngày</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Loại</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Số lượng</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Đơn giá</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">Tổng tiền</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Đối tác/Công trình</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Người thực hiện</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-center whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.filter(tx => tx.itemId === selectedItemForCard.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
                    const partner = partners.find(p => p.id === tx.partnerId);
                    const customer = customers.find(c => c.id === tx.customerId);
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{tx.date ? new Date(tx.date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                            tx.type === InventoryTxType.IMPORT ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {tx.type === InventoryTxType.IMPORT ? 'Nhập' : 'Xuất'}
                          </span>
                        </td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-bold">{tx.quantity || 0}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-right whitespace-nowrap">{formatCurrency(tx.unitPrice || 0)}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.totalAmount || ((tx.quantity || 0) * (tx.unitPrice || 0)))}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{tx.type === InventoryTxType.IMPORT ? partner?.name : customer?.name}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{tx.createdBy}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-center">
                          <button 
                            onClick={() => handleDeleteTransaction(tx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa giao dịch"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {transactions.filter(tx => tx.itemId === selectedItemForCard.id).length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-8 sm:px-4 text-center text-gray-500">
                        Chưa có lịch sử giao dịch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 pb-24 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-green-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-green-800">Thêm Mặt Hàng Mới</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã hàng hóa <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={itemForm.code}
                  onChange={e => setItemForm({...itemForm, code: e.target.value})}
                  placeholder="Nhập mã hàng hóa..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên mặt hàng <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={itemForm.name}
                  onChange={e => setItemForm({...itemForm, name: e.target.value})}
                  placeholder="Nhập tên mặt hàng..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị tính <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={itemForm.unit}
                  onChange={e => setItemForm({...itemForm, unit: e.target.value})}
                  placeholder="VD: Cái, Chiếc, Kg..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng ban đầu</label>
                  <input 
                    type="number" 
                    min="0"
                    value={itemForm.quantity || ''}
                    onChange={e => setItemForm({...itemForm, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá mặc định</label>
                  <InlineCurrencyInput 
                    value={itemForm.unitPrice || ''}
                    onChange={(val: number) => setItemForm({...itemForm, unitPrice: val})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp mặc định</label>
                <input 
                  type="text" 
                  list="add-item-partners-list"
                  value={partners.find(p => p.id === itemForm.supplierId)?.name || itemForm.supplierId}
                  onChange={e => {
                    const val = e.target.value;
                    const partner = partners.find(p => p.name === val);
                    setItemForm({...itemForm, supplierId: partner ? partner.id : val});
                  }}
                  placeholder="Chọn đối tác..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
                <datalist id="add-item-partners-list">
                  {partners.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <input 
                  type="text" 
                  value={itemForm.note}
                  onChange={e => setItemForm({...itemForm, note: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
            </div>
            <div className="p-4 pb-10 sm:p-6 sm:pb-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setShowAddItemModal(false)}
                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleAddItem}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors shadow-sm"
              >
                Lưu Mặt Hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check Modal */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 pb-24 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[75dvh] sm:max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-purple-50/50 shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-purple-800">Kiểm Kho</h3>
                <p className="text-sm text-purple-600/80 mt-1 flex items-center gap-1">
                  <IconAlert className="w-4 h-4" /> Lưu ý: Toàn bộ lịch sử nhập/xuất sẽ bị xóa sau khi kiểm kho.
                </p>
              </div>
              <button onClick={() => setShowCheckModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-xs sm:text-sm text-left min-w-[800px]">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">STT</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap">Tên mặt hàng</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-center whitespace-nowrap">Tồn kho hệ thống</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 text-center whitespace-nowrap">Tồn kho thực tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {checkItems.map((ci, index) => {
                    const item = items.find(i => i.id === ci.id);
                    if (!item) return null;
                    return (
                      <tr key={ci.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-gray-500">{index + 1}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 font-medium whitespace-nowrap">{item.name}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-center text-gray-600 whitespace-nowrap">{item.quantity || 0} {item.unit}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-center">
                          <input 
                            type="number" 
                            min="0"
                            value={ci.actualQuantity}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setCheckItems(checkItems.map(c => c.id === ci.id ? { ...c, actualQuantity: val } : c));
                            }}
                            className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-purple-500 text-center"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 pb-10 sm:p-6 sm:pb-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setShowCheckModal(false)}
                className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleInventoryCheck}
                className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
              >
                Xác nhận Kiểm Kho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryTab;
