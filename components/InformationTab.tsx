import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { subscribeToUsers, apiUpdateUser } from '../services/storageService';
import * as XLSX from 'xlsx';

interface InformationTabProps {
  currentUser: User;
}

export const InformationTab: React.FC<InformationTabProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    const unsub = subscribeToUsers(currentUser.companyId, (updatedUsers) => {
      setUsers(updatedUsers);
    });
    return () => unsub();
  }, [currentUser.companyId]);

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm(user);
  };

  const handleSave = async (userId: string) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (userToUpdate) {
        await apiUpdateUser({ ...userToUpdate, ...editForm });
      }
      setEditingUserId(null);
    } catch (error) {
      console.error("Error updating user info:", error);
      alert("Lỗi khi cập nhật thông tin.");
    }
  };

  const handleCancel = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  const handleExportExcel = () => {
    const dataToExport = users.map((user, index) => ({
      'STT': index + 1,
      'Họ và Tên': user.name,
      'Bộ Phận': user.department || '',
      'Số Điện thoại': user.phone || '',
      'CCCD': user.cccd || '',
      'Ngày sinh': user.dob || '',
      'Quê Quán': user.hometown || '',
      'Số TK': user.bankAccount || '',
      'QR code': user.qrCode || '',
      'Ghi Chú': user.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongTinNhanSu');
    XLSX.writeFile(workbook, 'Bang_Thong_Tin_Nhan_Su.xlsx');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let updatedCount = 0;
        for (const row of data) {
          // Find user by name (assuming name is unique enough for import, or we could use phone/cccd)
          // For a robust system, we should match by ID or Username, but the prompt asks for these columns.
          // Let's try to match by name first.
          const user = users.find(u => u.name === row['Họ và Tên']);
          if (user) {
            const updates: Partial<User> = {
              department: row['Bộ Phận']?.toString() || user.department,
              phone: row['Số Điện thoại']?.toString() || user.phone,
              cccd: row['CCCD']?.toString() || user.cccd,
              dob: row['Ngày sinh']?.toString() || user.dob,
              hometown: row['Quê Quán']?.toString() || user.hometown,
              bankAccount: row['Số TK']?.toString() || user.bankAccount,
              qrCode: row['QR code']?.toString() || user.qrCode,
              notes: row['Ghi Chú']?.toString() || user.notes,
            };
            await apiUpdateUser({ ...user, ...updates });
            updatedCount++;
          }
        }
        alert(`Đã cập nhật thông tin cho ${updatedCount} nhân sự.`);
      } catch (error) {
        console.error("Error importing excel:", error);
        alert("Lỗi khi nhập dữ liệu từ Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">BẢNG THÔNG TIN NHÂN SỰ</h2>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Nhập Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleExportExcel}
            className="bg-green-50 text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-green-100 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-bold">STT</th>
                <th className="px-4 py-3 font-bold">Họ và Tên</th>
                <th className="px-4 py-3 font-bold">Bộ Phận</th>
                <th className="px-4 py-3 font-bold">Số Điện thoại</th>
                <th className="px-4 py-3 font-bold">CCCD</th>
                <th className="px-4 py-3 font-bold">Ngày sinh</th>
                <th className="px-4 py-3 font-bold">Quê Quán</th>
                <th className="px-4 py-3 font-bold">Số TK</th>
                <th className="px-4 py-3 font-bold">QR code</th>
                <th className="px-4 py-3 font-bold">Ghi Chú</th>
                <th className="px-4 py-3 font-bold text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {[...users].sort((a, b) => (a.department || '').localeCompare(b.department || '')).map((user, index) => {
                const isEditing = editingUserId === user.id;
                return (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{user.name}</td>
                    
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.department || ''} onChange={e => setEditForm({...editForm, department: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.department || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.phone || '-'}</span>
                      )}
                    </td>
                    
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.cccd || ''} onChange={e => setEditForm({...editForm, cccd: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.cccd || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.dob || ''} onChange={e => setEditForm({...editForm, dob: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.dob ? new Date(user.dob).toLocaleDateString('vi-VN') : '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.hometown || ''} onChange={e => setEditForm({...editForm, hometown: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.hometown || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.bankAccount || ''} onChange={e => setEditForm({...editForm, bankAccount: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.bankAccount || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="URL ảnh QR" value={editForm.qrCode || ''} onChange={e => setEditForm({...editForm, qrCode: e.target.value})} />
                      ) : (
                        user.qrCode ? <a href={user.qrCode} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Xem QR</a> : <span className="text-gray-400">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                      ) : (
                        <span className="text-gray-600">{user.notes || '-'}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleSave(user.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button onClick={handleCancel} className="text-red-600 hover:bg-red-50 p-1 rounded">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEdit(user)} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 italic">
                    Chưa có dữ liệu nhân sự.
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
