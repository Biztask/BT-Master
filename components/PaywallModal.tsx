
import React from 'react';
import { BillingConfig, Company } from '../types';
import { IconDownload, IconX, IconAlertTriangle } from './Icons';
import { exportAllDataToExcel } from '../services/exportService';

interface PaywallModalProps {
  company: Company;
  config: BillingConfig;
  isOpen: boolean;
  onClose: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ company, config, isOpen, onClose }) => {
  if (!isOpen || !config || !config.bankInfo) return null;

  const qrUrl = `https://img.vietqr.io/image/${config.bankInfo.bankName}-${config.bankInfo.accountNumber}-compact.png?amount=${config.monthlyFee}&addInfo=THANHTOAN BIZTASK ${company.id}&accountName=${encodeURIComponent(config.bankInfo.accountName)}`;

  const handleExport = async () => {
    try {
      await exportAllDataToExcel(company.id, company.name);
    } catch (error) {
      console.error("Export error:", error);
      alert("Có lỗi khi xuất dữ liệu. Vui lòng thử lại.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <IconAlertTriangle className="w-10 h-10 text-amber-600" />
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 px-4">
            Dịch vụ cần được gia hạn
          </h2>
          
          <p className="text-gray-600 mb-8 leading-relaxed max-w-md">
            Cảm ơn anh/chị đã sử dụng phần mềm trong thời gian qua. Do chi phí vận hành tăng cao, ứng dụng cần được đóng góp phí duy trì để tiếp tục phục vụ tốt nhất.
          </p>

          <div className="bg-blue-50 rounded-2xl p-6 mb-8 w-full border border-blue-100">
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <div className="flex-shrink-0 bg-white p-2 rounded-xl shadow-sm">
                <img 
                  src={qrUrl} 
                  alt="Mã QR Thanh Toán" 
                  className="w-48 h-48 object-contain"
                />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold text-blue-800 mb-2 uppercase tracking-wider">Thông tin chuyển khoản</p>
                <div className="space-y-1.5 text-sm">
                  <p className="text-gray-700"><span className="font-medium text-gray-500">Ngân hàng:</span> {config.bankInfo.bankName}</p>
                  <p className="text-gray-700"><span className="font-medium text-gray-500">Số tài khoản:</span> {config.bankInfo.accountNumber}</p>
                  <p className="text-gray-700 uppercase"><span className="font-medium text-gray-500">Chủ TK:</span> {config.bankInfo.accountName}</p>
                  <p className="text-blue-700 font-bold text-lg mt-2">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(config.monthlyFee)}
                  </p>
                  <p className="text-gray-500 text-xs mt-2 italic bg-white/50 p-2 rounded-lg border border-blue-50">
                    Nội dung: <span className="font-bold text-blue-600">THANHTOAN BIZTASK {company.id}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
             <p className="text-sm text-gray-500 italic mb-4">
               Nếu không muốn tiếp tục sử dụng, anh/chị có thể tải toàn bộ dữ liệu lịch sử về máy để lưu trữ.
             </p>
             
             <div className="flex flex-col sm:flex-row gap-3">
               <button 
                 onClick={handleExport}
                 className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl transition-all active:scale-95"
               >
                 <IconDownload className="w-5 h-5" /> Tải Toàn Bộ Dữ Liệu (Excel)
               </button>
               
               <button 
                 onClick={onClose}
                 className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 active:scale-95"
               >
                 Tiếp Tục Xem (Hạn Chế)
               </button>
             </div>
             
             <p className="text-xs text-center text-gray-400 mt-6 uppercase tracking-widest font-medium">
               BizTask • Giải pháp quản lý kho chuyên nghiệp
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaywallModal;
