import React, { useState, useEffect, useMemo } from 'react';
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
    return items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
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
    name: '',
    unit: '',
    unitPrice: 0,
    supplierId: '',
    note: ''
  });

  const handleAddItem = async () => {
    if (!itemForm.name || !itemForm.unit) {
      alert("Vui lòng nhập tên mặt hàng và đơn vị tính.");
      return;
    }
    
    const existing = items.find(i => i.name.toLowerCase() === itemForm.name.toLowerCase());
    if (existing) {
      alert("Mặt hàng này đã tồn tại trong kho.");
      return;
    }

    const newItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      companyId: currentUser.companyId,
      name: itemForm.name,
      unit: itemForm.unit,
      quantity: 0, // Starts at 0
      unitPrice: itemForm.unitPrice,
      supplierId: itemForm.supplierId,
      note: itemForm.note,
      updatedAt: new Date().toISOString()
    };

    await apiAddInventoryItem(newItem);
    setShowAddItemModal(false);
    setItemForm({ name: '', unit: '', unitPrice: 0, supplierId: '', note: '' });
    alert("Thêm mặt hàng thành công!");
  };

  // --- Import / Export Logic ---
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().split('T')[0],
    itemName: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    partnerId: '',
    customerId: '',
    note: '',
    performer: ''
  });

  const handleImport = async () => {
    if (!txForm.itemName || txForm.quantity <= 0 || txForm.unitPrice < 0 || !txForm.partnerId) {
      alert("Vui lòng điền đầy đủ thông tin (Tên hàng, Số lượng > 0, Đơn giá, Đối tác).");
      return;
    }

    const totalAmount = txForm.quantity * txForm.unitPrice;

    // Find or create item
    let item = items.find(i => i.id === txForm.itemName); // itemName now stores the ID
    if (!item) {
      alert("Vui lòng chọn mặt hàng từ danh sách.");
      return;
    }

    await apiUpdateInventoryItem({
      ...item,
      quantity: (item.quantity || 0) + txForm.quantity,
      unitPrice: txForm.unitPrice, // Update to latest price
      supplierId: txForm.partnerId,
      updatedAt: new Date().toISOString()
    });

    // Create transaction
    const txId = Math.random().toString(36).substr(2, 9);
    const linkedTxId = Math.random().toString(36).substr(2, 9);

    const tx: InventoryTransaction = {
      id: txId,
      companyId: currentUser.companyId,
      itemId: item.id,
      type: InventoryTxType.IMPORT,
      quantity: txForm.quantity,
      unitPrice: txForm.unitPrice,
      totalAmount,
      date: txForm.date,
      partnerId: txForm.partnerId,
      note: txForm.note,
      createdBy: txForm.performer || '',
      createdAt: new Date().toISOString(),
      linkedTxId: linkedTxId
    };
    await apiAddInventoryTransaction(tx);

    // Add to Partner Debt
    const partner = partners.find(p => p.id === txForm.partnerId);
    if (partner) {
      await apiAddPartnerTransaction({
        id: linkedTxId,
        companyId: currentUser.companyId,
        partnerId: partner.id,
        productId: item.id,
        quantity: txForm.quantity,
        date: txForm.date,
        purchaseAmount: totalAmount,
        paidAmount: 0,
        note: `Nhập kho: ${item.name} (SL: ${txForm.quantity})`,
        createdBy: txForm.performer || '',
        createdAt: new Date().toISOString()
      });
    }

    setShowImportModal(false);
    resetTxForm();
    alert("Nhập hàng thành công!");
  };

  const handleExport = async () => {
    if (!txForm.itemName || txForm.quantity <= 0 || !txForm.customerId) {
      alert("Vui lòng điền đầy đủ thông tin (Tên hàng, Số lượng > 0, Công trình).");
      return;
    }

    const item = items.find(i => i.id === txForm.itemName); // itemName now stores the ID
    if (!item) {
      alert("Vui lòng chọn mặt hàng từ danh sách.");
      return;
    }

    if ((item.quantity || 0) < txForm.quantity) {
      alert(`Số lượng xuất (${txForm.quantity}) vượt quá tồn kho (${item.quantity || 0}).`);
      return;
    }

    const totalAmount = txForm.quantity * (item.unitPrice || 0); // Use current average/last price

    // Update item
    await apiUpdateInventoryItem({
      ...item,
      quantity: (item.quantity || 0) - txForm.quantity,
      updatedAt: new Date().toISOString()
    });

    // Create transaction
    const txId = Math.random().toString(36).substr(2, 9);
    const linkedTxId = Math.random().toString(36).substr(2, 9);

    const tx: InventoryTransaction = {
      id: txId,
      companyId: currentUser.companyId,
      itemId: item.id,
      type: InventoryTxType.EXPORT,
      quantity: txForm.quantity,
      unitPrice: item.unitPrice || 0,
      totalAmount,
      date: txForm.date,
      customerId: txForm.customerId,
      note: txForm.note,
      createdBy: txForm.performer || '',
      createdAt: new Date().toISOString(),
      linkedTxId: linkedTxId
    };
    await apiAddInventoryTransaction(tx);

    // Add to Customer Expense
    const customer = customers.find(c => c.id === txForm.customerId);
    if (customer) {
      await apiAddCustomerTransaction({
        id: linkedTxId,
        companyId: currentUser.companyId,
        customerId: customer.id,
        date: txForm.date,
        purchaseAmount: totalAmount,
        paidAmount: 0,
        note: `Xuất kho: ${item.name} (SL: ${txForm.quantity})`,
        createdBy: txForm.performer || '',
        createdAt: new Date().toISOString(),
        paymentCategoryId: 'inventory_export' // Special ID or just leave it
      });
    }

    setShowExportModal(false);
    resetTxForm();
    alert("Xuất hàng thành công!");
  };

  const resetTxForm = () => {
    setTxForm({
      date: new Date().toISOString().split('T')[0],
      itemName: '',
      unit: '',
      quantity: 0,
      unitPrice: 0,
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
        await apiDeleteCustomerTransaction(tx.linkedTxId);
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
            placeholder="Tìm tên mặt hàng..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 w-64"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddItemModal(true)}
            disabled={isLocked}
            className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <IconPlus className="w-4 h-4" /> Thêm Mặt Hàng
          </button>
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
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-4 py-3">STT</th>
              <th className="px-4 py-3">Ngày cập nhật</th>
              <th className="px-4 py-3">Tên mặt hàng</th>
              <th className="px-4 py-3">Đơn vị</th>
              <th className="px-4 py-3 text-right">Số lượng</th>
              <th className="px-4 py-3 text-right">Đơn giá</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3">Nhà cung cấp</th>
              <th className="px-4 py-3">Ghi chú</th>
              <th className="px-4 py-3 text-center">Thao tác</th>
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
                <tr key={item.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedItemForCard(item)}>
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-900">{displayDate ? new Date(displayDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</td>
                  <td className="px-4 py-3 font-medium text-blue-600 hover:underline">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{displayQty}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(displayPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(displayQty * displayPrice)}</td>
                  <td className="px-4 py-3 text-gray-600">{supplier?.name || ''}</td>
                  <td className="px-4 py-3 text-gray-600">{item.note}</td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
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
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
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
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
            <tr>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Mặt hàng</th>
              <th className="px-4 py-3 text-right">Số lượng</th>
              <th className="px-4 py-3 text-right">Đơn giá</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3">Đối tác/Công trình</th>
              <th className="px-4 py-3">Người thực hiện</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recentTransactions.map((tx) => {
              const item = items.find(i => i.id === tx.itemId);
              const partner = partners.find(p => p.id === tx.partnerId);
              const customer = customers.find(c => c.id === tx.customerId);
              return (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{tx.date ? new Date(tx.date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tx.type === InventoryTxType.IMPORT ? 'bg-blue-100 text-blue-700' : 
                      tx.type === InventoryTxType.EXPORT ? 'bg-orange-100 text-orange-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {tx.type === InventoryTxType.IMPORT ? 'Nhập' : tx.type === InventoryTxType.EXPORT ? 'Xuất' : 'Kiểm kho'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{tx.quantity || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(tx.unitPrice || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(tx.totalAmount || ((tx.quantity || 0) * (tx.unitPrice || 0)))}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {tx.type === InventoryTxType.IMPORT ? partner?.name : customer?.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tx.createdBy}</td>
                  <td className="px-4 py-3 text-gray-600">{tx.note}</td>
                </tr>
              );
            })}
            {recentTransactions.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Kho</h2>
          <p className="text-sm text-gray-500 mt-1">Tổng hợp và quản lý xuất nhập tồn kho</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeSubTab === 'inventory' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Tồn Kho
          {activeSubTab === 'inventory' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${
            activeSubTab === 'history' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Lịch sử
          {activeSubTab === 'history' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeSubTab === 'inventory' ? renderInventoryTable() : renderHistoryTable()}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-blue-800">Nhập Hàng</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa</label>
                  <div className="flex gap-2">
                    <select 
                      value={txForm.itemName}
                      onChange={e => {
                        const val = e.target.value;
                        const existing = items.find(i => i.id === val);
                        setTxForm({
                          ...txForm, 
                          itemName: val,
                          unit: existing ? existing.unit : '',
                          unitPrice: existing ? existing.unitPrice : 0,
                          partnerId: existing && existing.supplierId ? existing.supplierId : txForm.partnerId
                        });
                      }}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Chọn mặt hàng --</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <button 
                      onClick={() => setShowAddItemModal(true)}
                      className="bg-gray-100 text-gray-600 px-3 rounded-xl hover:bg-gray-200 transition-colors flex-shrink-0"
                      title="Thêm mặt hàng mới"
                    >
                      <IconPlus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
                  <input 
                    type="text" 
                    value={txForm.unit}
                    onChange={e => setTxForm({...txForm, unit: e.target.value})}
                    placeholder="VD: Cái, Chiếc, Kg..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                  <input 
                    type="number" 
                    min="0"
                    value={txForm.quantity || ''}
                    onChange={e => setTxForm({...txForm, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
                  <input 
                    type="number" 
                    min="0"
                    value={txForm.unitPrice || ''}
                    onChange={e => setTxForm({...txForm, unitPrice: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tổng tiền</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-gray-700 font-bold">
                    {formatCurrency(txForm.quantity * txForm.unitPrice)}
                  </div>
                </div>
                <div className="sm:col-span-2">
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
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <input 
                    type="text" 
                    value={txForm.note}
                    onChange={e => setTxForm({...txForm, note: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
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
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-orange-800">Xuất Hàng</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa</label>
                  <select 
                    value={txForm.itemName}
                    onChange={e => {
                      const val = e.target.value;
                      const existing = items.find(i => i.id === val);
                      setTxForm({
                        ...txForm, 
                        itemName: val,
                        unit: existing ? existing.unit : '',
                        unitPrice: existing ? existing.unitPrice : 0
                      });
                    }}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  >
                    <option value="">-- Chọn mặt hàng --</option>
                    {items.filter(i => i.quantity > 0).map(i => <option key={i.id} value={i.id}>{i.name} (Tồn: {i.quantity})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                  <input 
                    type="number" 
                    min="0"
                    value={txForm.quantity || ''}
                    onChange={e => setTxForm({...txForm, quantity: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  {txForm.itemName && items.find(i => i.id === txForm.itemName) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tồn kho: {items.find(i => i.id === txForm.itemName)?.quantity}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tổng tiền (Tạm tính)</label>
                  <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-gray-700 font-bold">
                    {formatCurrency(txForm.quantity * txForm.unitPrice)}
                  </div>
                </div>
                <div className="sm:col-span-2">
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
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <input 
                    type="text" 
                    value={txForm.note}
                    onChange={e => setTxForm({...txForm, note: e.target.value})}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div className="sm:col-span-2">
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
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
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
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800">Thẻ Kho: {selectedItemForCard.name}</h3>
                  <p className="text-sm text-gray-500">Tồn kho hiện tại: <span className="font-bold text-gray-900">{displayQty} {selectedItemForCard.unit}</span></p>
                </div>
                <button onClick={() => setSelectedItemForCard(null)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Tổng tiền</th>
                    <th className="px-4 py-3">Đối tác/Công trình</th>
                    <th className="px-4 py-3">Người thực hiện</th>
                    <th className="px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.filter(tx => tx.itemId === selectedItemForCard.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
                    const partner = partners.find(p => p.id === tx.partnerId);
                    const customer = customers.find(c => c.id === tx.customerId);
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{tx.date ? new Date(tx.date).toLocaleDateString('vi-VN') : 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tx.type === InventoryTxType.IMPORT ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {tx.type === InventoryTxType.IMPORT ? 'Nhập' : 'Xuất'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{tx.quantity || 0}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(tx.unitPrice || 0)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(tx.totalAmount || ((tx.quantity || 0) * (tx.unitPrice || 0)))}</td>
                        <td className="px-4 py-3">{tx.type === InventoryTxType.IMPORT ? partner?.name : customer?.name}</td>
                        <td className="px-4 py-3">{tx.createdBy}</td>
                        <td className="px-4 py-3 text-center">
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
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-green-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-green-800">Thêm Mặt Hàng Mới</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá mặc định</label>
                <input 
                  type="number" 
                  min="0"
                  value={itemForm.unitPrice || ''}
                  onChange={e => setItemForm({...itemForm, unitPrice: parseFloat(e.target.value) || 0})}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
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
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
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
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Tên mặt hàng</th>
                    <th className="px-4 py-3 text-center">Tồn kho hệ thống</th>
                    <th className="px-4 py-3 text-center">Tồn kho thực tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {checkItems.map((ci, index) => {
                    const item = items.find(i => i.id === ci.id);
                    if (!item) return null;
                    return (
                      <tr key={ci.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity || 0} {item.unit}</td>
                        <td className="px-4 py-3 text-center">
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
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
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
