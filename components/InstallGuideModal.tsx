
import React from 'react';
import { IconIOSShare, IconPlus, IconX } from './Icons';

interface InstallGuideModalProps {
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up relative mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500"
        >
          <IconX className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-navy-800 rounded-2xl flex items-center justify-center shadow-lg">
             <img src="/icon.png" className="w-12 h-12 rounded-xl" alt="App Icon" />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900">Cài đặt BizTask lên iPhone</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Để sử dụng BizTask như một ứng dụng thực thụ, hãy làm theo các bước sau trong trình duyệt <span className="font-bold text-blue-600">Safari</span>:
          </p>

          <div className="w-full space-y-4 pt-2 text-left">
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                <IconIOSShare className="w-6 h-6" />
              </div>
              <div className="text-sm text-gray-700">
                1. Nhấn nút <span className="font-bold">Chia sẻ</span> ở thanh công cụ Safari.
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                <div className="w-6 h-6 border-2 border-gray-400 rounded-md flex items-center justify-center">
                   <IconPlus className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="text-sm text-gray-700">
                2. Cuộn xuống và chọn <span className="font-bold">Thêm vào MH chính</span> (Add to Home Screen).
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all mt-2"
          >
            Tôi đã hiểu
          </button>
        </div>
      </div>

      {/* Triangle pointer for Safari center button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-white"></div>
    </div>
  );
};

export default InstallGuideModal;
