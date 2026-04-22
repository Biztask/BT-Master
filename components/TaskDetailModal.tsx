
import React, { useState } from 'react';
import { Task, User, TaskStatus, TaskPriority } from '../types';
import { IconX, IconClock, IconUser, IconImage, IconCheck, IconAlert } from './Icons';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  users: User[];
  onEdit?: (task: Task) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, users, onEdit }) => {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  
  const creator = users.find(u => u.id === task.creatorId);
  const assignee = users.find(u => u.id === task.assigneeId);

  const formatDateTime = (dateString: string) => {
    return new Intl.DateTimeFormat('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const priorityColors = {
    [TaskPriority.LOW]: 'bg-gray-100 text-gray-600',
    [TaskPriority.MEDIUM]: 'bg-blue-50 text-blue-600',
    [TaskPriority.HIGH]: 'bg-orange-50 text-orange-600',
    [TaskPriority.URGENT]: 'bg-red-50 text-red-600',
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${priorityColors[task.priority]}`}>
                 {task.priority}
               </span>
               <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' : task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                 {task.status === TaskStatus.TODO ? 'Chờ xử lý' : task.status === TaskStatus.IN_PROGRESS ? 'Đang làm' : 'Đã xong'}
               </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <IconX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Metadata */}
          <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600 bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
             <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                   <IconUser className="w-4 h-4 text-gray-400" />
                   <span>Người giao: <span className="font-bold text-gray-800">{creator?.name || 'N/A'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                   <IconUser className="w-4 h-4 text-gray-400" />
                   <span>Người nhận: <span className="font-bold text-gray-800">{assignee?.name || 'N/A'}</span></span>
                </div>
             </div>
             <div className="w-px bg-gray-200 hidden sm:block"></div>
             <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                   <IconClock className="w-4 h-4 text-gray-400" />
                   <span>Ngày tạo: <span className="font-medium">{formatDateTime(task.createdAt)}</span></span>
                </div>
                <div className="flex items-center gap-2">
                   <IconAlert className="w-4 h-4 text-red-400" />
                   <span>Hạn chót: <span className="font-bold text-red-600">{formatDateTime(task.dueDate)}</span></span>
                </div>
             </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase mb-2">Mô tả công việc</h3>
            <div className="bg-gray-50 p-4 rounded-xl text-gray-700 whitespace-pre-line leading-relaxed text-sm border border-gray-100">
              {task.description}
            </div>
          </div>

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div>
               <h3 className="text-sm font-bold text-gray-900 uppercase mb-2 flex items-center gap-2">
                  <IconImage className="w-4 h-4" /> Tài liệu / Ảnh đính kèm
               </h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {task.attachments.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer" onClick={() => setLightboxImg(url)}>
                       <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* Completion Proof */}
          {task.status === TaskStatus.COMPLETED && (
             <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <h3 className="text-sm font-bold text-green-800 uppercase mb-3 flex items-center gap-2">
                   <IconCheck className="w-4 h-4" /> Kết quả công việc
                </h3>
                <div className="flex items-start gap-4">
                   <div className="flex-1">
                      <p className="text-sm text-green-700">
                         Hoàn thành lúc: <span className="font-bold">{task.completedAt ? formatDateTime(task.completedAt) : 'N/A'}</span>
                      </p>
                      {!task.completionImage && <p className="text-xs text-gray-500 mt-1">Không có hình ảnh minh chứng.</p>}
                   </div>
                   {task.completionImage && (
                      <div className="w-24 h-24 rounded-lg overflow-hidden border border-green-200 cursor-pointer shadow-sm" onClick={() => setLightboxImg(task.completionImage!)}>
                         <img src={task.completionImage} className="w-full h-full object-cover" />
                      </div>
                   )}
                </div>
             </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
           {onEdit && (
              <button onClick={() => { onClose(); onEdit(task); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm transition-colors">
                Chỉnh sửa
              </button>
           )}
           <button onClick={onClose} className="px-6 py-2 bg-navy-800 hover:bg-navy-900 text-white font-bold rounded-lg text-sm transition-colors shadow-lg shadow-navy-200">
             Đóng
           </button>
        </div>

      </div>

      {/* Internal Lightbox */}
      {lightboxImg && (
         <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}>
            <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><IconX className="w-8 h-8" /></button>
            <img src={lightboxImg} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
         </div>
      )}
    </div>
  );
};

export default TaskDetailModal;
