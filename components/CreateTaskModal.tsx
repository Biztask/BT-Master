
import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole, TaskPriority, Task } from '../types';
import { analyzeTaskAudio } from '../services/geminiService';
import { uploadTaskImage } from '../services/storageService';
import { IconMic, IconX, IconImage, IconAlert } from './Icons';

interface CreateTaskModalProps {
  currentUser: User;
  assignableUsers: User[]; 
  onClose: () => void;
  onCreate: (taskData: any) => Promise<void>;
  onEdit?: (taskData: any) => Promise<void>;
  initialData?: Task;
  isLocked?: boolean;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ currentUser, assignableUsers, onClose, onCreate, onEdit, initialData, isLocked }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Image State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Robust check for Director/Manager privileges
  // Handles both Enum comparison and String comparison (just in case)
  const isDirector = currentUser.role === UserRole.DIRECTOR || (currentUser.role as string) === 'DIRECTOR';
  const isManager = currentUser.role === UserRole.MANAGER || (currentUser.role as string) === 'MANAGER';
  const canAssign = isDirector || isManager;

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      // Format date for input datetime-local: YYYY-MM-DDTHH:mm
      try {
        const d = new Date(initialData.dueDate);
        // Adjust to local ISO string manually to handle timezone correctly for inputs
        if (!isNaN(d.getTime())) {
            const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setDueDate(localIso);
        } else {
            setDueDate('');
        }
      } catch (e) {
        setDueDate('');
      }
      
      // Ensure assignee ID is set correctly from existing task
      setAssigneeId(initialData.assigneeId);
      
      setPriority(initialData.priority);
      if (initialData.attachments) {
        setExistingImages(initialData.attachments);
      }
    }
  }, [initialData]);

  // Voice Command Logic
  const handleVoiceCommand = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setIsAnalyzing(true);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // iOS Safari does NOT support audio/webm. We must check supported types.
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4'; // iOS fallback
        } else {
            console.warn("No suitable audio mime type found, letting browser decide.");
            mimeType = ''; // Let browser use default
        }

        const options = mimeType ? { mimeType } : undefined;
        const mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Use the correct mime type for the blob
          const finalMimeType = mimeType || 'audio/mp4';
          const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            // Handle both data:audio/webm;base64,... and data:audio/mp4;base64,...
            const base64Data = base64String.split(',')[1];
            
            const transcription = await analyzeTaskAudio(base64Data, finalMimeType);
            
            if (transcription) {
              if (!title) {
                setTitle(transcription);
              } else {
                setDescription(prev => (prev ? prev + '\n' + transcription : transcription));
              }
            }
            setIsAnalyzing(false);
            stream.getTracks().forEach(track => track.stop());
          };
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Không thể truy cập Microphone. Trên iOS, vui lòng kiểm tra Cài đặt > Safari > Microphone.");
        setIsRecording(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray: File[] = Array.from(e.target.files);
      // REMOVED 5MB Check to allow larger files to be compressed
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages(prev => prev.filter(img => img !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      alert("Tài khoản đã hết hạn. Vui lòng thanh toán để tiếp tục giao việc.");
      return;
    }
    if (!title || !dueDate) {
       alert("Vui lòng nhập tiêu đề và hạn chót!");
       return;
    }
    
    setIsUploading(true);

    try {
      const tempTaskId = initialData?.id || Math.random().toString(36).substr(2, 9);
      
      // Upload images
      const uploadPromises = selectedFiles.map(file => uploadTaskImage(file, tempTaskId));
      const results = await Promise.all(uploadPromises);
      
      // Filter successful uploads
      const validNewUrls = results.filter(url => url !== null) as string[];
      
      // Error handling for uploads
      if (selectedFiles.length > 0 && validNewUrls.length === 0) {
         const continueSave = window.confirm("Không thể tải ảnh lên (Lỗi kết nối hoặc quyền truy cập). Bạn có muốn tiếp tục lưu công việc mà không có ảnh mới?");
         if (!continueSave) {
           setIsUploading(false);
           return;
         }
      } else if (selectedFiles.length > validNewUrls.length) {
         alert(`Cảnh báo: Chỉ tải lên được ${validNewUrls.length}/${selectedFiles.length} ảnh.`);
      }

      const allAttachments = [...existingImages, ...validNewUrls];

      const data = {
        id: tempTaskId, 
        title,
        description,
        dueDate: new Date(dueDate).toISOString(),
        assigneeId: canAssign ? assigneeId : currentUser.id,
        priority,
        attachments: allAttachments
      };

      if (initialData && onEdit) {
        await onEdit({ ...initialData, ...data });
      } else {
        await onCreate(data);
      }
      onClose(); // Close strictly after success
    } catch (error) {
      console.error("Error saving task:", error);
      alert("Có lỗi xảy ra khi lưu công việc. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up sm:animate-none max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-navy-800">
            {initialData ? 'Sửa Công Việc' : 'Giao Việc Mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"><IconX className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Title Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nhiệm vụ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Báo cáo thu chi tháng 12..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none transition-all font-medium"
              required={!isRecording}
              disabled={isUploading}
            />
          </div>

          {/* Description Input with Voice */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Mô tả chi tiết</label>
            <div className="relative">
               <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none resize-none transition-all text-sm"
                placeholder="Chi tiết công việc..."
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={handleVoiceCommand}
                disabled={isAnalyzing || isUploading}
                className={`absolute bottom-3 right-3 p-2 rounded-full shadow-sm transition-all ${
                  isRecording ? 'bg-red-500 text-white animate-pulse' : 
                  isAnalyzing ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title="Nhập bằng giọng nói (AI)"
              >
                <IconMic className="w-4 h-4" />
              </button>
            </div>
            {isAnalyzing && <p className="text-xs text-yellow-600 mt-1 font-medium italic">Đang phân tích giọng nói...</p>}
          </div>

          {/* Image Upload Area */}
          <div>
             <label className="block text-sm font-bold text-gray-700 mb-2">Hình ảnh đính kèm</label>
             
             {/* Preview Grid */}
             <div className="grid grid-cols-4 gap-2 mb-3">
                {existingImages.map((url, idx) => (
                   <div key={`exist-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={url} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeExistingImage(url)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconX className="w-3 h-3"/>
                      </button>
                   </div>
                ))}
                {selectedFiles.map((file, idx) => (
                   <div key={`new-${idx}`} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-green-500/10 pointer-events-none"></div> {/* Indicator for new files */}
                      <button type="button" onClick={() => removeSelectedFile(idx)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5">
                        <IconX className="w-3 h-3"/>
                      </button>
                   </div>
                ))}
                
                {/* Add Button */}
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-navy-500 hover:text-navy-500 hover:bg-gray-50 transition-all"
                  disabled={isUploading}
                >
                   <IconImage className="w-6 h-6 mb-1"/>
                </button>
             </div>
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                multiple 
                accept="image/*" 
             />
          </div>

          {/* Row: Due Date & Priority */}
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hạn chót <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none text-sm font-medium"
                  required
                  disabled={isUploading}
                />
             </div>
             <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Độ ưu tiên</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none text-sm bg-white"
                  disabled={isUploading}
                >
                  <option value={TaskPriority.LOW}>Thấp</option>
                  <option value={TaskPriority.MEDIUM}>Trung bình</option>
                  <option value={TaskPriority.HIGH}>Cao</option>
                  <option value={TaskPriority.URGENT}>Khẩn cấp</option>
                </select>
             </div>
          </div>

          {/* Assignee (Director/Manager Only) */}
          {canAssign && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Giao cho nhân viên</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-800 outline-none text-sm bg-white"
                disabled={isUploading}
              >
                {assignableUsers && assignableUsers.length > 0 ? (
                  assignableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.username})
                    </option>
                  ))
                ) : (
                   <option value={currentUser.id}>Không tìm thấy nhân viên (Mặc định: {currentUser.name})</option>
                )}
              </select>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isUploading || isLocked}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 mt-4 ${
               isUploading || isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-navy-800 hover:bg-navy-900 active:scale-[0.98]'
            }`}
          >
            {isUploading ? (
               <>
                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 <span>Đang tải ảnh lên...</span>
               </>
            ) : isLocked ? (
              'Vui lòng gia hạn để thực hiện'
            ) : (
               initialData ? 'Lưu thay đổi' : 'Giao việc ngay'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
