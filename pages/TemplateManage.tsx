import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft, FileText, Copy } from 'lucide-react';
import { listTemplates, deleteTemplateById } from '../services/templates';
import { SurveyTemplate } from '../types';

const TemplateManage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
      alert('템플릿 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDelete = async (template: SurveyTemplate) => {
    const ok = window.confirm(`'${template.name}' 템플릿을 삭제하시겠습니까?`);
    if (!ok) return;

    try {
      await deleteTemplateById(template.id);
      await loadTemplates();
      alert('템플릿이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('템플릿 삭제에 실패했습니다.');
    }
  };

  const handleEdit = (templateId: string) => {
    navigate(`/admin/template/edit/${templateId}`);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    navigate(`/admin/survey/create?templateId=${templateId}`);
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
              <h1 className="text-xl font-bold text-gray-900">템플릿 관리</h1>
            </div>
            <button 
              onClick={() => navigate('/admin/template/create')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all"
            >
              <Plus size={18} />
              <span>새 템플릿 생성</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">로딩 중...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">등록된 템플릿이 없습니다.</h3>
            <p className="mt-2 text-gray-500">자주 사용하는 양식을 템플릿으로 저장하여 재사용하세요.</p>
            <button 
              onClick={() => navigate('/admin/template/create')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              첫 템플릿 생성하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map(template => (
              <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <span>{template.fields.length}개 항목</span>
                  <span>•</span>
                  <span>수정: {new Date(template.updatedAt).toLocaleDateString('ko-KR')}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateFromTemplate(template.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  >
                    <Copy size={14} /> 이 템플릿으로 생성
                  </button>
                  <button
                    onClick={() => handleEdit(template.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="수정"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateManage;
