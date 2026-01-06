import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, Plus, Trash2, ArrowLeft, ClipboardList, Type, Hash, Calendar, List, CheckSquare, AlignLeft, X, Table, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { getSurvey, upsertSurvey } from '../services/surveys';
import { deleteTemplateById, getTemplate, listTemplates, upsertTemplate } from '../services/templates';
import { Survey, SurveyField, SurveyFieldType, TableColumn, SurveyTemplate } from '../types';
import { supabase } from '../services/supabaseClient';
import organizationsData from '../org/organizations.generated.json';

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
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);
  const templateIdFromUrl = searchParams.get('templateId');

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [targetOrgTypes, setTargetOrgTypes] = useState<string[]>([]);

  const allOrgTypes = Array.from(new Set((organizationsData ?? []).map((o: any) => o?.orgType).filter(Boolean))).sort();

  const toggleTargetOrgType = (orgType: string, checked: boolean) => {
    setTargetOrgTypes(prev => {
      const next = new Set(prev);
      if (checked) next.add(orgType);
      else next.delete(orgType);
      return Array.from(next);
    });
  };

  // Dynamic Fields
  const [fields, setFields] = useState<SurveyField[]>([
    { id: `FLD${Date.now()}`, label: '전화번호', type: 'text', required: true }
  ]);

  // Template
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateDescriptionInput, setTemplateDescriptionInput] = useState('');

  const reloadTemplates = async () => {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  // Load templates
  useEffect(() => {
    reloadTemplates();
  }, []);

  // Load template from URL parameter
  useEffect(() => {
    if (!templateIdFromUrl || isEditMode) return;
    (async () => {
      try {
        const template = await getTemplate(templateIdFromUrl);
        if (template) {
          setFields(template.fields);
        }
      } catch (e) {
        console.error('Failed to load template:', e);
      }
    })();
  }, [templateIdFromUrl, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !id) return;
    let mounted = true;
    
    const loadSurvey = async () => {
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
        setTargetOrgTypes(existing.targetOrgTypes ?? []);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        alert('자료 취합 요청 정보를 불러오지 못했습니다.');
        navigate('/admin');
      }
    };
    
    loadSurvey();
    
    // Realtime 구독: 다른 PC에서 수정 시 자동으로 최신 데이터 반영
    const channel = supabase
      .channel(`survey-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'phlink',
          table: 'surveys',
          filter: `id=eq.${id}`
        },
        () => {
          console.log('Survey updated by another user, reloading...');
          loadSurvey();
        }
      )
      .subscribe();
    
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
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
    // @ts-ignore
    newFields[index][key] = value;
    
    // Reset options if type changes to non-option type
    if (key === 'type' && !['select', 'multiselect'].includes(value)) {
        newFields[index].options = [];
    }
    
    // Reset columns if type changes to non-table type
    if (key === 'type' && value !== 'table') {
        newFields[index].columns = undefined;
        newFields[index].minRows = undefined;
        newFields[index].maxRows = undefined;
    }
    
    // Initialize columns for table type
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
          
          // Reset options if type changes to non-select type
          if (key === 'type' && value !== 'select') {
              newFields[fieldIndex].columns![colIndex].options = undefined;
          }
          // Initialize options array for select type
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

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const template = await getTemplate(templateId);
      if (template) {
        setFields(template.fields);
        setShowTemplateModal(false);
        alert(`'${template.name}' 템플릿이 적용되었습니다.`);
      }
    } catch (e) {
      console.error(e);
      alert('템플릿을 불러오지 못했습니다.');
    }
  };

  const handleSaveTemplateAsNew = async () => {
    const name = templateNameInput.trim();
    if (!name) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }

    setTemplateSaving(true);
    try {
      const ts = Date.now();
      const template: SurveyTemplate = {
        id: `TPL${ts}`,
        name,
        description: templateDescriptionInput ?? '',
        fields,
        createdAt: ts,
        updatedAt: ts,
      };
      await upsertTemplate(template);
      await reloadTemplates();
      setTemplateNameInput('');
      setTemplateDescriptionInput('');
      alert('템플릿이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('템플릿 저장에 실패했습니다.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleOverwriteTemplate = async (templateId: string) => {
    const target = templates.find(t => t.id === templateId);
    if (!target) return;
    const ok = window.confirm(`'${target.name}' 템플릿을 현재 빌더 내용으로 덮어쓸까요?`);
    if (!ok) return;

    setTemplateSaving(true);
    try {
      const next: SurveyTemplate = {
        ...target,
        description: target.description ?? '',
        fields,
        updatedAt: Date.now(),
      };
      await upsertTemplate(next);
      await reloadTemplates();
      alert('템플릿이 업데이트되었습니다.');
    } catch (e) {
      console.error(e);
      alert('템플릿 업데이트에 실패했습니다.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const target = templates.find(t => t.id === templateId);
    if (!target) return;
    const ok = window.confirm(`'${target.name}' 템플릿을 삭제할까요?`);
    if (!ok) return;

    setTemplateDeletingId(templateId);
    try {
      await deleteTemplateById(templateId);
      await reloadTemplates();
      alert('템플릿이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('템플릿 삭제에 실패했습니다.');
    } finally {
      setTemplateDeletingId(null);
    }
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
        if (field.type === 'table' && (!field.columns || field.columns.length === 0)) {
            alert(`'${field.label}' 항목의 테이블 컬럼을 최소 1개 이상 추가해주세요.`);
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
      targetOrgTypes,
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
                <label className="block text-sm font-bold text-gray-700 mb-1">대상 기관 유형 <span className="text-red-500">*</span></label>
                <div className="bg-white border border-gray-300 rounded-lg p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={targetOrgTypes.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) setTargetOrgTypes([]);
                      }}
                      className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    />
                    전체
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-100">
                    {allOrgTypes.map((t: string) => {
                      const checked = targetOrgTypes.includes(t);
                      return (
                        <label key={t} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (targetOrgTypes.length === 0 && e.target.checked) {
                                setTargetOrgTypes([t]);
                                return;
                              }
                              toggleTargetOrgType(t, e.target.checked);
                            }}
                            className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                          />
                          {t}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-end">
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 w-full">
                  전체를 선택하면 모든 기관 유형이 제출 대상입니다.
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
             <div className="flex gap-2">
               <button 
                  onClick={() => setShowTemplateModal(true)}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold hover:bg-green-100 border border-green-200 transition-colors"
                >
                  <FileText size={16} /> 템플릿 관리
                </button>
               {!isEditMode && (
                 <button 
                    onClick={() => setShowTemplateModal(true)}
                    type="button"
                    disabled={templates.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <FileText size={16} /> 템플릿 불러오기
                 </button>
               )}
               <button 
                  onClick={handleAddField}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
               >
                 <Plus size={16} /> 항목 추가
               </button>
             </div>
           </div>
           
           <div className="space-y-6">
             {fields.map((field, index) => (
               <div key={field.id} className="relative p-6 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-300 transition-all group shadow-sm">
                 {/* Order Control Buttons */}
                 <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-100 md:opacity-70 md:group-hover:opacity-100 transition-opacity">
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
                                  <option value="table">테이블 (Table)</option>
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

                 {/* Table Column Editor */}
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
                                     
                                     {/* Select Options Editor */}
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
                                                   placeholder="옵션 추가 (예: '있음', '없음')"
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
                                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold hover:bg-gray-200"
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
                     </div>
                 )}

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

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden transform transition-all scale-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" /> 템플릿 관리 (취합양식 빌더)
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="border border-gray-200 rounded-xl p-4 bg-white mb-6">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="font-bold text-gray-900">현재 빌더를 새 템플릿으로 저장</div>
                  <div className="text-xs text-gray-500">현재 항목 수: {fields.length}개</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">템플릿 이름</label>
                    <input
                      type="text"
                      value={templateNameInput}
                      onChange={e => setTemplateNameInput(e.target.value)}
                      placeholder="예: 직원 인력 현황(기본형)"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">설명 (선택)</label>
                    <input
                      type="text"
                      value={templateDescriptionInput}
                      onChange={e => setTemplateDescriptionInput(e.target.value)}
                      placeholder="예: 공통 질문/테이블 포함"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveTemplateAsNew}
                    disabled={templateSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} /> 저장
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-900">저장된 템플릿</div>
                <button
                  type="button"
                  onClick={reloadTemplates}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-bold hover:bg-gray-200"
                >
                  새로고침
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>등록된 템플릿이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {templates.map(template => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 mb-1 truncate">{template.name}</h4>
                          <p className="text-sm text-gray-500 mb-2 break-words">{template.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{template.fields.length}개 항목</span>
                            <span>•</span>
                            <span>수정: {new Date(template.updatedAt).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadTemplate(template.id)}
                            className="px-3 py-2 bg-purple-50 text-purple-700 rounded text-sm font-bold hover:bg-purple-100 border border-purple-200"
                          >
                            적용
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOverwriteTemplate(template.id)}
                            disabled={templateSaving}
                            className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded text-sm font-bold hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            덮어쓰기
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={templateDeletingId === template.id}
                            className="px-3 py-2 bg-white text-red-600 rounded text-sm font-bold hover:bg-red-50 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyCreate;