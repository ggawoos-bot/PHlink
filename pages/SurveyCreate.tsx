import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, ArrowLeft, ClipboardList, Type, Hash, Calendar, List, CheckSquare, AlignLeft, X } from 'lucide-react';
import { getSurvey, upsertSurvey } from '../services/surveys';
import { Survey, SurveyField, SurveyFieldType } from '../types';

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalDateTimeInputValue = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const SurveyCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');

  // Dynamic Fields
  const [fields, setFields] = useState<SurveyField[]>([
    { id: `FLD${Date.now()}`, label: '전화번호', type: 'text', required: true }
  ]);

  useEffect(() => {
    if (!isEditMode || !id) return;
    let mounted = true;
    (async () => {
      try {
        const existing = await getSurvey(id);
        if (!mounted) return;
        if (!existing) {
          alert('자료 취합 요청 정보를 찾을 수 없습니다.');
          navigate('/admin');
          return;
        }

        setTitle(existing.title);
        setDescription(existing.description);
        setHost(existing.host);
        setStartAt(existing.startAt || (existing.createdAt ? toLocalDateTimeInputValue(new Date(existing.createdAt)) : ''));
        setEndAt(existing.endAt || (existing.deadline ? `${existing.deadline}T23:59` : ''));
        setFields(existing.fields);
        setCreatedAt(existing.createdAt);
        setStatus(existing.status);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        alert('자료 취합 요청 정보를 불러오지 못했습니다.');
        navigate('/admin');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, isEditMode, navigate]);

  useEffect(() => {
    if (isEditMode) return;
    if (!startAt && createdAt) {
      setStartAt(toLocalDateTimeInputValue(new Date(createdAt)));
    }
    if (!endAt) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 0, 0);
      setEndAt(toLocalDateTimeInputValue(d));
    }
  }, [createdAt, endAt, isEditMode, startAt]);

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

  const handleFieldChange = (index: number, key: keyof SurveyField, value: any) => {
    const newFields = [...fields];
    // @ts-ignore
    newFields[index][key] = value;
    
    // Reset options if type changes to non-option type
    if (key === 'type' && !['select', 'multiselect'].includes(value)) {
        newFields[index].options = [];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !host || !startAt || !endAt || fields.length === 0) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
      alert('제출기간이 올바르지 않습니다. 시작일시가 종료일시보다 늦을 수 없습니다.');
      return;
    }
    
    // Validation
    for (const field of fields) {
        if (!field.label.trim()) {
            alert('모든 항목의 질문 제목을 입력해주세요.');
            return;
        }
        if (['select', 'multiselect'].includes(field.type) && (!field.options || field.options.length === 0)) {
            alert(`'${field.label}' 항목의 선택 옵션을 최소 1개 이상 추가해주세요.`);
            return;
        }
    }

    const newSurvey: Survey = {
      id: isEditMode && id ? id : `SRV${Date.now()}`,
      title,
      description,
      host,
      deadline: endAt.split('T')[0],
      startAt,
      endAt,
      fields,
      status,
      createdAt
    };

    try {
      await upsertSurvey(newSurvey);
      alert(isEditMode ? '자료 취합 요청이 수정되었습니다.' : '자료 취합 요청이 등록되었습니다.');
      navigate('/admin');
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
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-bold text-gray-900">{isEditMode ? '자료 취합 수정' : '새 자료 취합 생성'}</h1>
            </div>
            <button 
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all"
            >
              <Save size={18} />
              <span>저장 및 배포</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Basic Info */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
            <ClipboardList className="text-indigo-600" size={24} /> 기본 정보 설정
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">제목 (조사명) <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 2024년 1분기 보건소 인력 현황 조사"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">요청 기관/부서 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="예: 건강증진과"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                />
              </div>
              <div className="flex items-end">
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 w-full">
                  제출기간 외에는 자료 제출이 불가능하며, 목록에서 "예정"/"제출 마감"으로 표시됩니다.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">제출기간 시작 <span className="text-red-500">*</span></label>
                <input 
                  type="datetime-local" 
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">제출기간 종료 <span className="text-red-500">*</span></label>
                <input 
                  type="datetime-local" 
                  value={endAt}
                  onChange={e => setEndAt(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">설명 및 요청사항</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="조사 목적이나 작성 시 유의사항을 입력하세요."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow"
              />
            </div>
          </div>
        </section>

        {/* Dynamic Fields Builder */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
           <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
             <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
               <ClipboardList className="text-indigo-600" size={24} /> 취합 양식 빌더
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
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Label & Description */}
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

                    {/* Type & Required */}
                    <div className="md:col-span-5 flex flex-col gap-3">
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase mb-1">답변 형식</label>
                           <div className="relative">
                               <select 
                                 value={field.type}
                                 onChange={e => handleFieldChange(index, 'type', e.target.value)}
                                 className="w-full p-2.5 pl-9 bg-white border border-gray-300 rounded-lg appearance-none text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                               >
                                  <option value="text">단답형 텍스트 (Short Text)</option>
                                  <option value="textarea">장문형 텍스트 (Long Text)</option>
                                  <option value="number">숫자 (Number)</option>
                                  <option value="date">날짜 (Date)</option>
                                  <option value="select">단일 선택 (Dropdown/Radio)</option>
                                  <option value="multiselect">다중 선택 (Checkbox)</option>
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

                 {/* Option Editor for Select/Multiselect */}
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
                               placeholder="옵션 추가 (예: '있음', '없음')"
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

                 {/* Remove Button */}
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
                 <p className="text-sm text-gray-400">클릭하여 질문을 생성하세요.</p>
             </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default SurveyCreate;