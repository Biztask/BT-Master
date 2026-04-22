import React, { useState, useRef, useEffect } from 'react';
import { RowTag } from '../types';
import { IconPlus, IconX, IconEdit, IconTrash } from './Icons';
import { apiAddRowTag, apiUpdateRowTag, apiDeleteRowTag } from '../services/storageService';

interface RowTagSelectorProps {
  companyId: string;
  type: 'CUSTOMER' | 'PARTNER' | 'CUSTOMER_PROGRESS' | 'CUSTOMER_NOTE';
  tags: RowTag[];
  selectedTagId?: string;
  onSelect: (tagId: string | undefined) => void;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#64748b', // slate
];

export default function RowTagSelector({ companyId, type, tags, selectedTagId, onSelect }: RowTagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTag, setEditingTag] = useState<RowTag | null>(null);
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredTags = tags.filter(t => t.type === type);
  const selectedTag = tags.find(t => t.id === selectedTagId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setEditingTag(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = async () => {
    if (!newText.trim()) return;
    const newTag: RowTag = {
      id: Math.random().toString(36).substr(2, 9),
      companyId,
      type,
      text: newText.trim(),
      color: newColor,
    };
    await apiAddRowTag(newTag);
    setNewText('');
    setIsAdding(false);
    onSelect(newTag.id);
    setIsOpen(false);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !newText.trim()) return;
    await apiUpdateRowTag({
      ...editingTag,
      text: newText.trim(),
      color: newColor
    });
    setEditingTag(null);
    setNewText('');
  };

  const handleDeleteTag = async (tagId: string) => {
    await apiDeleteRowTag(tagId);
    if (selectedTagId === tagId) {
      onSelect(undefined);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className="flex items-center justify-between px-2 py-1 border rounded cursor-pointer min-w-[100px] text-xs"
        style={{ 
          backgroundColor: selectedTag && selectedTag.color !== 'transparent' ? `${selectedTag.color}20` : 'transparent',
          borderColor: selectedTag && selectedTag.color !== 'transparent' ? selectedTag.color : '#e5e7eb',
          color: selectedTag && selectedTag.color !== 'transparent' ? selectedTag.color : '#6b7280'
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span className="truncate">{selectedTag ? selectedTag.text : 'Chọn...'}</span>
      </div>

      {isOpen && (
        <div className="absolute z-50 right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2">
          {!isAdding && !editingTag ? (
            <>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                <div 
                  className="px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(undefined);
                    setIsOpen(false);
                  }}
                >
                  Bỏ chọn
                </div>
                {filteredTags.map(tag => (
                  <div 
                    key={tag.id}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(tag.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-3 h-3 rounded-full shrink-0 relative flex items-center justify-center overflow-hidden border border-gray-200" style={{ backgroundColor: tag.color === 'transparent' ? 'white' : tag.color }}>
                        {tag.color === 'transparent' && <div className="absolute w-full h-[1px] bg-red-500 transform -rotate-45"></div>}
                      </div>
                      <span className="truncate">{tag.text}</span>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button 
                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTag(tag);
                          setNewText(tag.text);
                          setNewColor(tag.color);
                        }}
                      >
                        <IconEdit className="w-3 h-3" />
                      </button>
                      <button 
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTag(tag.id);
                        }}
                      >
                        <IconTrash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-200"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewText('');
                  setNewColor(COLORS[0]);
                  setIsAdding(true);
                }}
              >
                <IconPlus className="w-3 h-3" /> Thêm mới
              </button>
            </>
          ) : (
            <div className="space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{editingTag ? 'Sửa nhãn' : 'Thêm nhãn mới'}</span>
                <button onClick={() => { setIsAdding(false); setEditingTag(null); }} className="text-gray-400 hover:text-gray-600">
                  <IconX className="w-4 h-4" />
                </button>
              </div>
              <input 
                type="text" 
                placeholder="Nhập nội dung..."
                value={newText}
                onChange={e => setNewText(e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5">
                <div 
                  className={`w-5 h-5 rounded-full cursor-pointer border-2 flex items-center justify-center overflow-hidden relative ${newColor === 'transparent' ? 'border-gray-800' : 'border-gray-200'} bg-white`}
                  onClick={() => setNewColor('transparent')}
                  title="Không màu"
                >
                  <div className="absolute w-full h-[2px] bg-red-500 transform -rotate-45"></div>
                </div>
                {COLORS.map(c => (
                  <div 
                    key={c}
                    className={`w-5 h-5 rounded-full cursor-pointer border-2 ${newColor === c ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  ></div>
                ))}
              </div>
              <button 
                onClick={editingTag ? handleUpdateTag : handleAddTag}
                disabled={!newText.trim()}
                className="w-full bg-blue-600 text-white py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Lưu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
