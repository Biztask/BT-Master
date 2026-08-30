import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { IconCamera, IconX, IconMapPin } from './Icons';
import { OfficeLocation } from '../types';

interface QRCheckInProps {
  onCheckIn: (location: OfficeLocation) => void;
  onCancel: () => void;
  officeLocations: OfficeLocation[];
  companyId: string;
}

// Haversine formula
const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
};

export const QRCheckIn: React.FC<QRCheckInProps> = ({ onCheckIn, onCancel, officeLocations, companyId }) => {
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<string>('Đang lấy vị trí GPS...');
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 1. Get GPS Location First
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          locationRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setGpsStatus('Đã nhận vị trí GPS');
        },
        (err) => {
          setError('Không thể lấy vị trí GPS. Vui lòng bật định vị trên thiết bị.');
          setGpsStatus('');
          setIsScanning(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError('Trình duyệt không hỗ trợ GPS.');
      setGpsStatus('');
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!isScanning || error || !document.getElementById('qr-reader')) return;
    
    // 2. Start QR Scanner
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (!locationRef.current) {
          setError('Chưa có vị trí GPS, vui lòng đợi...');
          return;
        }

        // Decode pattern: verify it belongs to this company
        if (!decodedText.startsWith(`BIZTASK_ATTENDANCE_${companyId}`)) {
          setError('Mã QR không hợp lệ hoặc không thuộc công ty này.');
          return;
        }
        
        // Check if QR matches any office
        const office = officeLocations.find(loc => decodedText === loc.qrCodeString);
        if (!office) {
          setError('Mã QR không khớp với địa điểm nào.');
          return;
        }

        // Check radius
        const distance = getDistanceFromLatLonInM(
          locationRef.current.lat, 
          locationRef.current.lng, 
          office.lat, 
          office.lng
        );

        if (distance > office.radius) {
          setError(`Bạn đang ở ngoài phạm vi văn phòng. Khoảng cách: ${Math.round(distance)}m (Cho phép: ${office.radius}m)`);
          return;
        }

        // Success
        scanner.stop().then(() => {
          setIsScanning(false);
          onCheckIn(office);
        }).catch(console.error);
      },
      (err) => {
        // quiet fail on scan mismatch
      }
    ).catch((err) => {
      setError('Lỗi khi truy cập camera: ' + err.message);
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [isScanning, error, companyId, officeLocations, onCheckIn]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <IconCamera className="w-5 h-5 text-brand-600" />
            Quét QR Chấm Công
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <IconX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
           {!error && (
             <div className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1">
               <IconMapPin className="w-4 h-4"/> {gpsStatus}
             </div>
           )}

           {error && (
             <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100 text-center w-full">
               {error}
             </div>
           )}

           {isScanning && !error && (
             <div id="qr-reader" className="w-full rounded-xl overflow-hidden" />
           )}
           
           <p className="text-sm text-gray-500 mt-4 text-center px-4">
             Đưa mã QR của văn phòng vào khung hình máy ảnh để hệ thống tự động ghi nhận chấm công.
           </p>
        </div>
      </div>
    </div>
  );
};
