import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IconMapPin, IconPlus, IconTrash, IconEdit, IconCheck, IconX } from './Icons';
import { OfficeLocation } from '../types';
import { subscribeToOfficeLocations, apiAddOfficeLocation, apiUpdateOfficeLocation, apiDeleteOfficeLocation } from '../services/storageService';

export const OfficeManagement: React.FC<{ companyId: string }> = ({ companyId }) => {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newRadius, setNewRadius] = useState('50');

  useEffect(() => {
    const unsub = subscribeToOfficeLocations(companyId, setLocations);
    return () => unsub();
  }, [companyId]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewLat(position.coords.latitude.toString());
          setNewLng(position.coords.longitude.toString());
        },
        (error) => {
          alert('Không thể lấy vị trí hiện tại: ' + error.message);
        }
      );
    } else {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newLat || !newLng || !newRadius) return;
    
    // Auto generate QR code string
    const qrCodeString = `BIZTASK_ATTENDANCE_${companyId}_OFFICE_${Date.now()}`;
    
    await apiAddOfficeLocation({
      companyId,
      name: newName,
      lat: parseFloat(newLat),
      lng: parseFloat(newLng),
      radius: parseInt(newRadius, 10),
      qrCodeString
    });
    
    setIsAdding(false);
    setNewName(''); setNewLat(''); setNewLng(''); setNewRadius('50');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa địa điểm này?')) {
      await apiDeleteOfficeLocation(id);
    }
  };

  const printQR = (location: OfficeLocation) => {
    const svgElement = document.getElementById(`qr-${location.id}`);
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    // Add white background
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgElement);
    svgStr = svgStr.replace('<svg ', '<svg style="background: white;" ');
    
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 80;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        ctx.fillStyle = "black";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(location.name, canvas.width / 2, canvas.height - 20);
      }
      const dataUrl = canvas.toDataURL("image/png");
      const windowContent = "<!DOCTYPE html><html><head><title>In QR Code</title></head><body><img src='" + dataUrl + "'></body><script>window.onload = function() { window.print(); window.close(); }</script></html>";
      const printWin = window.open('', '', 'width=600,height=600');
      printWin?.document.open();
      printWin?.document.write(windowContent);
      printWin?.document.close();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 mt-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <IconMapPin className="text-brand-500 w-5 h-5" />
          Địa điểm & QR Chấm công (Văn phòng)
        </h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="text-brand-600 text-xs font-bold flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100"
        >
          {isAdding ? <><IconX className="w-4 h-4"/> Hủy</> : <><IconPlus className="w-4 h-4"/> Thêm mới</>}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Tên văn phòng/Địa điểm"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full p-2 text-sm border rounded-lg"
              required
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                placeholder="Vĩ độ (Lat)"
                value={newLat}
                onChange={e => setNewLat(e.target.value)}
                className="w-full p-2 text-sm border rounded-lg"
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Kinh độ (Lng)"
                value={newLng}
                onChange={e => setNewLng(e.target.value)}
                className="w-full p-2 text-sm border rounded-lg"
                required
              />
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Bán kính cho phép (mét)"
                value={newRadius}
                onChange={e => setNewRadius(e.target.value)}
                className="w-full p-2 text-sm border rounded-lg"
                required
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">mét</span>
            </div>
          </div>
          <div className="flex gap-2">
             <button type="button" onClick={handleGetCurrentLocation} className="px-3 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg">
               Lấy Tọa Độ Hiện Tại
             </button>
             <button type="submit" className="px-3 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg flex-1">
               Lưu Địa Điểm
             </button>
          </div>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="text-center p-6 text-gray-500 text-sm italic">
          Chưa có địa điểm chấm công nào. Hãy thêm văn phòng để tạo mã QR.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="border border-gray-200 rounded-lg p-4 relative group flex flex-col items-center">
              <button 
                onClick={() => handleDelete(loc.id)}
                className="absolute top-2 right-2 text-red-500 bg-red-50 p-1.5 rounded border border-red-100 hover:bg-red-100"
              >
                <IconTrash className="w-4 h-4" />
              </button>
              
              <div className="mb-3 text-center w-full pr-8">
                <h4 className="font-bold text-gray-800 break-words">{loc.name}</h4>
                <p className="text-xs text-gray-500 mt-1">Bán kính: {loc.radius}m</p>
                <p className="text-[10px] text-gray-400 mt-1">Lat: {loc.lat}, Lng: {loc.lng}</p>
              </div>
              
              <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm mb-3">
                <QRCodeSVG id={`qr-${loc.id}`} value={loc.qrCodeString} size={150} level="H" />
              </div>
              
              <button 
                onClick={() => printQR(loc)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-lg"
              >
                In mã QR
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
