import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, ArrowLeft, ClipboardList, Type, Hash, Calendar, List, CheckSquare, AlignLeft, X, Table, ChevronUp, ChevronDown } from 'lucide-react';
import { getTemplate, upsertTemplate } from '../services/templates';
import { SurveyTemplate, SurveyField, SurveyFieldType, TableColumn } from '../types';

const TemplateEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<SurveyField[]>([]);
  const [createdAt, setCreatedAt] = useState<number>(Date.now());

  useEffect(() => {
    if (!isEditMode || !id) return;
    let mounted = true;
    (async () => {
      try {
        const existing = await getTemplate(id);
        if (!mounted) return;
        if (!existing) {
          alert('템플릿 정보를 찾을 수 없습니다.');
          navigate('/admin/templates');
          return;
        }

        setName(existing.name);
        setDescription(existing.description);
        setFields(existing.fields);
        setCreatedAt(existing.createdAt);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        alert('템플릿 정보를 불러오지 못했습니다.');
        navigate('/admin/templates');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, isEditMode, navigate]);

  const handleAddField = () => {
    setFields([...fields, { 
      id: `FLD${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
      label: '', 
      type: 'text', 
      required: true,
      options: [] 
    }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleMoveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFields(newFields);
  };

  const handleMoveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setFields(newFields);
  };

  const handleFieldChange = (index: number, key: keyof SurveyField, value: any) => {
    const newFields = [...fields];
    (newFields[index] as any)[key] = value;
    
    if (key === 'type' && !['select', 'multiselect'].includes(value)) {
        newFields[index].options = [];
    }
    
    if (key === 'type' && value !== 'table') {
        newFields[index].columns = undefined;
        newFields[index].minRows = undefined;
        newFields[index].maxRows = undefined;
    }
    
    if (key === 'type' && value === 'table' && !newFields[index].columns) {
        newFields[index].columns = [
            { id: `COL${Date.now()}`, label: '항목', type: 'text', required: false, width: 150 }
        ];
        newFields[index].minRows = 1;
        newFields[index].maxRows = 100;
    }
    
    setFields(newFields);
  };

  const handleAddOption = (fieldIndex: number, option: string) => {
      if (!option.trim()) return;
      const newFields = [...fields];
      const currentOptions = newFields[fieldIndex].options || [];
      newFields[fieldIndex].options = [...currentOptions, option];
      setFields(newFields);
  };

  const handleRemoveOption = (fieldIndex: number, optionIndex: number) => {
      const newFields = [...fields];
      if (newFields[fieldIndex].options) {
          newFields[fieldIndex].options = newFields[fieldIndex].options!.filter((_, i) => i !== optionIndex);
      }
      setFields(newFields);
  };

  const handleAddTableColumn = (fieldIndex: number) => {
      const newFields = [...fields];
      const currentColumns = newFields[fieldIndex].columns || [];
      newFields[fieldIndex].columns = [
          ...currentColumns,
          { id: `COL${Date.now()}${Math.random()}`, label: '새 컬럼', type: 'text', required: false, width: 150 }
      ];
      setFields(newFields);
  };

  const handleRemoveTableColumn = (fieldIndex: number, colIndex: number) => {
      const newFields = [...fields];
      if (newFields[fieldIndex].columns) {
          newFields[fieldIndex].columns = newFields[fieldIndex].columns!.filter((_, i) => i !== colIndex);
      }
      setFields(newFields);
  };

  const handleTableColumnChange = (fieldIndex: number, colIndex: number, key: keyof TableColumn, value: any) => {
      const newFields = [...fields];
      if (newFields[fieldIndex].columns && newFields[fieldIndex].columns![colIndex]) {
          (newFields[fieldIndex].columns![colIndex] as any)[key] = value;
          
          if (key === 'type' && value !== 'select') {
              newFields[fieldIndex].columns![colIndex].options = undefined;
          }
          if (key === 'type' && value === 'select' && !newFields[fieldIndex].columns![colIndex].options) {
              newFields[fieldIndex].columns![colIndex].options = [];
          }
      }
      setFields(newFields);
  };

  const handleAddTableColumnOption = (fieldIndex: number, colIndex: number, option: string) => {
      if (!option.trim()) return;
      const newFields = [...fields];
      if (newFields[fieldIndex].columns && newFields[fieldIndex].columns![colIndex]) {
          const currentOptions = newFields[fieldIndex].columns![colIndex].options || [];
          newFields[fieldIndex].columns![colIndex].options = [...currentOptions, option];
      }
      setFields(newFields);
  };

  const handleRemoveTableColumnOption = (fieldIndex: number, colIndex: number, optionIndex: number) => {
      const newFields = [...fields];
      if (newFields[fieldIndex].columns && newFields[fieldIndex].columns![colIndex].options) {
          newFields[fieldIndex].columns![colIndex].options = newFields[fieldIndex].columns![colIndex].options!.filter((_, i) => i !== optionIndex);
      }
      setFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }

    if (fields.length === 0) {
      alert('최소 1개 이상의 항목을 추가해주세요.');
      return;
    }
    
    for (const field of fields) {
        if (!field.label.trim()) {
            alert('모든 항목의 질문 제목을 입력해주세요.');
            return;
        }
        if (['select', 'multiselect'].includes(field.type) && (!field.options || field.options.length === 0)) {
            alert(`'${field.label}' 항목의 선택 옵션을 최소 1개 이상 추가해주세요.`);
            return;
        }
        if (field.type === 'table' && (!field.columns || field.columns.length === 0)) {
            alert(`'${field.label}' 항목의 테이블 컬럼을 최소 1개 이상 추가해주세요.`);
            return;
        }
    }

    const template: SurveyTemplate = {
      id: isEditMode && id ? id : `TPL${Date.now()}`,
      name,
      description,
      fields,
      createdAt,
      updatedAt: Date.now()
    };

    try {
      await upsertTemplate(template);
      alert(isEditMode ? '템플릿이 수정되었습니다.' : '템플릿이 생성되었습니다.');
      navigate('/admin/templates');
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
    }
  };

  const getTypeIcon = (type: SurveyFieldType) => {
      switch(type) {
          case 'text': return <Type size={16} />;
          case 'textarea': return <AlignLeft size={16} />;
          case 'number': return <Hash size={16} />;
          case 'date': return <Calendar size={16} />;
          case 'select': return <List size={16} />;
          case 'multiselect': return <CheckSquare size={16} />;
          case 'table': return <Table size={16} />;
          default: return <Type size={16} />;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/admin/templates')}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900">{isEditMode ? '템플릿 수정' : '새 템플릿 생성'}</h1>
            </div>
            <button 
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all"
            >
              <Save size={18} />
              <span>저장</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
            <ClipboardList className="text-indigo-600" size={24} /> 템플릿 정보
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">템플릿 이름 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 보건소 인력 현황 조사 템플릿"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">설명</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="템플릿에 대한 설명을 입력하세요."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
           <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
             <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
               <ClipboardList className="text-indigo-600" size={24} /> 양식 항목
             </h2>
             <button 
                onClick={handleAddField}
                type="button"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
             >
               <Plus size={16} /> 항목 추가
             </button>
           </div>
           
           <div className="space-y-6">
             {fields.map((field, index) => (
               <div key={field.id} className="relative p-6 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-300 transition-all group shadow-sm">
                 <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button
                     type="button"
                     onClick={() => handleMoveFieldUp(index)}
                     disabled={index === 0}
                     className="p-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                     title="위로 이동"
                   >
                     <ChevronUp size={16} className="text-gray-600" />
                   </button>
                   <button
                     type="button"
                     onClick={() => handleMoveFieldDown(index)}
                     disabled={index === fields.length - 1}
                     className="p-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                     title="아래로 이동"
                   >
                     <ChevronDown size={16} className="text-gray-600" />
                   </button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-7 space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">질문 제목 (Label)</label>
                          <input 
                            type="text"
                            value={field.label}
                            onChange={e => handleFieldChange(index, 'label', e.target.value)}
                            placeholder="질문을 입력하세요"
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium bg-white"
                          />
                      </div>
                      <div>
                          <input 
                            type="text"
                            value={field.description || ''}
                            onChange={e => handleFieldChange(index, 'description', e.target.value)}
                            placeholder="작성 도움말 (선택사항)"
                            className="w-full p-2 border-b border-gray-200 bg-transparent focus:border-indigo-500 outline-none text-xs text-gray-500"
                          />
                      </div>
                    </div>

                    <div className="md:col-span-5 flex flex-col gap-3">
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">답변 형식</label>
                           <div className="relative">
                               <select 
                                 value={field.type}
                                 onChange={e => handleFieldChange(index, 'type', e.target.value)}
                                 className="w-full p-2.5 pl-9 bg-white border border-gray-300 rounded-lg appearance-none text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                               >
                                  <option value="text">단답형 텍스트</option>
                                  <option value="textarea">장문형 텍스트</option>
                                  <option value="number">숫자</option>
                                  <option value="date">날짜</option>
                                  <option value="select">단일 선택</option>
                                  <option value="multiselect">다중 선택</option>
                                  <option value="table">테이블</option>
                               </select>
                               <div className="absolute left-3 top-3 text-gray-500 pointer-events-none">
                                   {getTypeIcon(field.type)}
                               </div>
                           </div>
                       </div>
                       <div className="flex items-center gap-2 pt-1">
                          <input 
                            type="checkbox"
                            id={`req-${index}`}
                            checked={field.required}
                            onChange={e => handleFieldChange(index, 'required', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                          />
                          <label htmlFor={`req-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer select-none">필수 입력 항목</label>
                       </div>
                    </div>
                 </div>

                 {field.type === 'table' && (
                     <div className="mt-4 pt-4 border-t border-gray-200">
                         <div className="flex justify-between items-center mb-3">
                             <label className="block text-xs font-bold text-gray-500 uppercase">테이블 컬럼 관리</label>
                             <button 
                                type="button"
                                onClick={() => handleAddTableColumn(index)}
                                className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100 border border-indigo-200"
                             >
                                 <Plus size={12} /> 컬럼 추가
                             </button>
                         </div>
                         <div className="space-y-2 mb-3">
                             {field.columns?.map((col, colIdx) => (
                                 <div key={col.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                     <div className="flex gap-2 items-center mb-2">
                                         <input 
                                           type="text"
                                           value={col.label}
                                           onChange={(e) => handleTableColumnChange(index, colIdx, 'label', e.target.value)}
                                           placeholder="컬럼명"
                                           className="flex-1 p-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                         />
                                         <select
                                           value={col.type}
                                           onChange={(e) => handleTableColumnChange(index, colIdx, 'type', e.target.value)}
                                           className="p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                         >
                                             <option value="text">텍스트</option>
                                             <option value="number">숫자</option>
                                             <option value="date">날짜</option>
                                             <option value="select">선택</option>
                                         </select>
                                         <input 
                                           type="number"
                                           value={col.width || 150}
                                           onChange={(e) => handleTableColumnChange(index, colIdx, 'width', parseInt(e.target.value))}
                                           placeholder="너비"
                                           className="w-16 p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                         />
                                         <label className="flex items-center gap-1 text-xs">
                                             <input 
                                               type="checkbox"
                                               checked={col.required || false}
                                               onChange={(e) => handleTableColumnChange(index, colIdx, 'required', e.target.checked)}
                                               className="h-3 w-3 text-indigo-600 rounded"
                                             />
                                             필수
                                         </label>
                                         <button 
                                            onClick={() => handleRemoveTableColumn(index, colIdx)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                         >
                                             <X size={14} />
                                         </button>
                                     </div>
                                     
                                     {col.type === 'select' && (
                                         <div className="mt-2 pt-2 border-t border-gray-100">
                                             <label className="block text-xs font-medium text-gray-600 mb-1.5">선택 옵션</label>
                                             <div className="flex flex-wrap gap-1.5 mb-2">
                                                 {col.options?.map((opt, optIdx) => (
                                                     <div key={optIdx} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-xs">
                                                         <span>{opt}</span>
                                                         <button 
                                                            onClick={() => handleRemoveTableColumnOption(index, colIdx, optIdx)}
                                                            className="text-indigo-400 hover:text-red-500 transition-colors"
                                                         >
                                                             <X size={12} />
                                                         </button>
                                                     </div>
                                                 ))}
                                             </div>
                                             <div className="flex gap-1.5">
                                                 <input 
                                                   type="text"
                                                   placeholder="옵션 추가"
                                                   className="flex-1 p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                   onKeyDown={(e) => {
                                                       if (e.key === 'Enter') {
                                                           e.preventDefault();
                                                           handleAddTableColumnOption(index, colIdx, e.currentTarget.value);
                                                           e.currentTarget.value = '';
                                                       }
                                                   }}
                                                 />
                                                 <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                        handleAddTableColumnOption(index, colIdx, input.value);
                                                        input.value = '';
                                                    }}
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
                                                 >
                                                     추가
                                                 </button>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                 <label className="block text-xs text-gray-600 mb-1">최소 행 수</label>
                                 <input 
                                   type="number"
                                   value={field.minRows || 1}
                                   onChange={(e) => handleFieldChange(index, 'minRows', parseInt(e.target.value) || 1)}
                                   min="0"
                                   className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-600 mb-1">최대 행 수</label>
                                 <input 
                                   type="number"
                                   value={field.maxRows || 100}
                                   onChange={(e) => handleFieldChange(index, 'maxRows', parseInt(e.target.value) || 100)}
                                   min="1"
                                   className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                 />
                             </div>
                         </div>
                         <div className="mt-3">
                            <label className="block text-xs text-gray-600 mb-1">'해당 없음' 설명</label>
                            <input 
                              type="text"
                              value={field.tableNoneDescription || ''}
                              onChange={(e) => handleFieldChange(index, 'tableNoneDescription', e.target.value)}
                              placeholder="예: 해당 사업을 운영하지 않는 경우 체크"
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                )}

                {['select', 'multiselect'].includes(field.type) && (
                     <div className="mt-4 pt-4 border-t border-gray-200">
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">선택 옵션 관리</label>
                         <div className="flex flex-wrap gap-2 mb-2">
                             {field.options?.map((opt, optIdx) => (
                                 <div key={optIdx} className="flex items-center gap-1 bg-white border border-indigo-200 text-indigo-800 px-3 py-1 rounded-full text-sm shadow-sm">
                                     <span>{opt}</span>
                                     <button 
                                        onClick={() => handleRemoveOption(index, optIdx)}
                                        className="text-indigo-400 hover:text-red-500 transition-colors"
                                     >
                                         <X size={14} />
                                     </button>
                                 </div>
                             ))}
                         </div>
                         <div className="flex gap-2 max-w-md">
                             <input 
                               type="text"
                               placeholder="옵션 추가"
                               className="flex-grow p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                               onKeyDown={(e) => {
                                   if (e.key === 'Enter') {
                                       e.preventDefault();
                                       handleAddOption(index, e.currentTarget.value);
                                       e.currentTarget.value = '';
                                   }
                               }}
                             />
                             <button 
                                type="button"
                                onClick={(e) => {
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    handleAddOption(index, input.value);
                                    input.value = '';
                                }}
                                className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-bold hover:bg-gray-200"
                             >
                                 추가
                             </button>
                         </div>
                     </div>
                 )}

                 <button 
                   onClick={() => handleRemoveField(index)}
                   className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-red-500 border border-gray-200 rounded-full shadow-sm opacity-100 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                   title="항목 삭제"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             ))}
             
             <div 
                onClick={handleAddField}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
             >
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 group-hover:bg-indigo-200 text-gray-400 group-hover:text-indigo-700 mb-2 transition-colors">
                     <Plus size={24} />
                 </div>
                 <p className="font-bold text-gray-500 group-hover:text-indigo-700">새로운 항목 추가하기</p>
             </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default TemplateEdit;
