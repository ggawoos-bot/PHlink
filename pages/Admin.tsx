import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, MessageCircle, ClipboardList, FileText, Pencil, Trash2, Share2, X, Copy, QrCode, Eye, BarChart3, Building2, PieChart, Search } from 'lucide-react';
import { answerSurveyQnA, clearSurveyQnAAnswer, countSurveySubmissionsBySurveyId, deleteSurveyById, deleteSurveyQnAById, deleteSurveySubmissionById, listSurveyQnAs, listSurveySubmissions, listSurveySubmissionsPaged, listSurveys, updateSurveySubmissionById } from '../services/surveys';
import * as XLSX from 'xlsx';
import { Survey, SurveyField, SurveyQnAPost, SurveySubmission, TableRow, TableAnswer, TableAnswerStatus } from '../types';

const normalizeTableAnswer = (v: any): TableAnswer => {
  if (Array.isArray(v)) {
    return { status: 'INPUT', rows: v as TableRow[] };
  }
  if (v && typeof v === 'object') {
    const status = (v as any).status as TableAnswerStatus | undefined;
    const rows = (v as any).rows;
    if ((status === 'INPUT' || status === 'NONE' || status === 'UNKNOWN') && Array.isArray(rows)) {
      return { status: status === 'UNKNOWN' ? 'NONE' : status, rows: rows as TableRow[], note: (v as any).note };
    }
  }
  return { status: 'INPUT', rows: [] };
};
import { supabase } from '../services/supabaseClient';

import organizationsData from '../org/organizations.generated.json';
import TableEditor from '../components/TableEditor';

const REGION_ORDER = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

const ORG_TYPE_ORDER = [
  '시도청',
  '보건소',
  '보건지소',
  '보건진료소',
  '금연지원센터',
];

const orderIndex = (list: string[], v: string) => {
  const idx = list.indexOf(v);
  return idx === -1 ? 9999 : idx;
};

const compareKorean = (a: string, b: string) => a.localeCompare(b, 'ko');

const getSurveyPeriodLabel = (s: any) => {
  const start = s?.startAt ? String(s.startAt).replace('T', ' ') : '';
  const end = s?.endAt ? String(s.endAt).replace('T', ' ') : '';
  if (!start || !end) return '';
  return `${start} ~ ${end}`;
};

const Admin: React.FC = () => {
  const navigate = useNavigate();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState<number>(0);
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);
  const [submissionsPage, setSubmissionsPage] = useState<number>(1);
  const [submissionsPageSize, setSubmissionsPageSize] = useState<number>(50);
  const [submissionsSearch, setSubmissionsSearch] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('');

  const [editingSubmission, setEditingSubmission] = useState<SurveySubmission | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, any>>({});
  const [editingSaving, setEditingSaving] = useState<boolean>(false);
  const [surveyQnAs, setSurveyQnAs] = useState<SurveyQnAPost[]>([]);
  const [surveyReplyText, setSurveyReplyText] = useState<Record<string, string>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SurveySubmission | null>(null);

  const loadSurveys = async (keepSelectedId?: string) => {
    try {
      const sv = await listSurveys();
      setSurveys(sv);
      const nextSelected = keepSelectedId && sv.some(s => s.id === keepSelectedId) ? keepSelectedId : (sv[0]?.id || '');
      setSelectedSurveyId(nextSelected);
    } catch (e) {
      console.error(e);
      setSurveys([]);
      setSelectedSurveyId('');
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const reloadSurveys = (keepSelectedId?: string) => {
    loadSurveys(keepSelectedId);
  };

  const currentSurvey = surveys.find(s => s.id === selectedSurveyId);
  const qnaEnabled = currentSurvey?.qnaEnabled ?? true;

  const orgRows = useMemo(() => {
    return (organizationsData ?? []).map((o: any) => ({
      id: String(o.id),
      region: String(o.region ?? ''),
      orgType: String(o.orgType ?? ''),
    }));
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orgRows) {
      if (o.region) set.add(o.region);
    }
    return Array.from(set).sort((a, b) => {
      const ia = orderIndex(REGION_ORDER, a);
      const ib = orderIndex(REGION_ORDER, b);
      if (ia !== ib) return ia - ib;
      return compareKorean(a, b);
    });
  }, [orgRows]);

  const orgTypes = useMemo(() => {
    const set = new Set<string>();
    for (const o of orgRows) {
      if (o.orgType) set.add(o.orgType);
    }
    return Array.from(set).sort((a, b) => {
      const ia = orderIndex(ORG_TYPE_ORDER, a);
      const ib = orderIndex(ORG_TYPE_ORDER, b);
      if (ia !== ib) return ia - ib;
      return compareKorean(a, b);
    });
  }, [orgRows]);

  const filteredAgencyIds = useMemo(() => {
    const region = selectedRegion.trim();
    const orgType = selectedOrgType.trim();
    if (!region && !orgType) return undefined;
    const ids: string[] = [];
    for (const o of orgRows) {
      if (region && o.region !== region) continue;
      if (orgType && o.orgType !== orgType) continue;
      ids.push(o.id);
    }
    return ids;
  }, [orgRows, selectedOrgType, selectedRegion]);

  useEffect(() => {
    if (selectedSurveyId) {
      loadSurveySubmissionsAndQnAs(selectedSurveyId, qnaEnabled);
    }
  }, [selectedSurveyId, qnaEnabled]);

  useEffect(() => {
    if (!selectedSurveyId) return;

    const t = window.setTimeout(() => {
      reloadSubmissions(1);
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
  }, [selectedSurveyId, submissionsSearch, submissionsPageSize, filteredAgencyIds]);

  const loadSurveySubmissionsAndQnAs = async (surveyId: string, qnaEnabled: boolean) => {
    try {
      setSubmissionsLoading(true);
      const [subsPaged, qnas] = await Promise.all([
        listSurveySubmissionsPaged({
          surveyId,
          page: 1,
          pageSize: submissionsPageSize,
          search: submissionsSearch,
          agencyIds: filteredAgencyIds,
          orderBy: 'submitted_at',
          orderDir: 'desc',
        }),
        qnaEnabled ? listSurveyQnAs(surveyId) : Promise.resolve([] as any),
      ]);
      setSubmissions(subsPaged.rows);
      setSubmissionsTotal(subsPaged.total);
      setSubmissionsPage(1);
      setSurveyQnAs(qnas);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
      setSubmissionsTotal(0);
      setSurveyQnAs([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const reloadSubmissions = async (pageOverride?: number) => {
    if (!selectedSurveyId) return;
    const page = pageOverride ?? submissionsPage;
    setSubmissionsLoading(true);
    try {
      const res = await listSurveySubmissionsPaged({
        surveyId: selectedSurveyId,
        page,
        pageSize: submissionsPageSize,
        search: submissionsSearch,
        agencyIds: filteredAgencyIds,
        orderBy: 'submitted_at',
        orderDir: 'desc',
      });
      setSubmissions(res.rows);
      setSubmissionsTotal(res.total);
      setSubmissionsPage(page);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
      setSubmissionsTotal(0);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleStartEditSubmission = (sub: SurveySubmission) => {
    setEditingSubmission(sub);
    setEditingAnswers({ ...(sub.data ?? {}) });
  };

  const handleSaveEditSubmission = async () => {
    if (!editingSubmission) return;
    setEditingSaving(true);
    try {
      await updateSurveySubmissionById({ id: editingSubmission.id, data: editingAnswers });
      alert('제출 데이터가 저장되었습니다.');
      setEditingSubmission(null);
      await reloadSubmissions();
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDeleteSubmission = (sub: SurveySubmission) => {
    const ok = window.confirm(`'${sub.agencyName}' 제출 데이터를 삭제할까요?`);
    if (!ok) return;
    (async () => {
      try {
        await deleteSurveySubmissionById(sub.id);
        alert('삭제되었습니다.');
        await reloadSubmissions(1);
      } catch (e) {
        console.error(e);
        alert('삭제에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
      }
    })();
  };

  const renderEditField = (field: SurveyField) => {
    const value = editingAnswers[field.id];
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            value={value || ''}
            onChange={(e) => setEditingAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'select':
        return (
          <select
            className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={value || ''}
            onChange={(e) => setEditingAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          >
            <option value="">선택해주세요</option>
            {field.options?.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'multiselect': {
        const currentList = (Array.isArray(value) ? value : []) as string[];
        return (
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {field.options?.map((opt, idx) => {
              const checked = currentList.includes(opt);
              return (
                <label key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? Array.from(new Set([...currentList, opt]))
                        : currentList.filter(v => v !== opt);
                      setEditingAnswers(prev => ({ ...prev, [field.id]: next }));
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      }
      case 'date':
        return (
          <input
            type="date"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={value || ''}
            onChange={(e) => setEditingAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={value || ''}
            onChange={(e) => setEditingAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
      case 'table': {
        const table = normalizeTableAnswer(value);
        const isNone = table.status !== 'INPUT';
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNone}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEditingAnswers(prev => ({ ...prev, [field.id]: { status: 'NONE', rows: [], note: table.note } }));
                    } else {
                      setEditingAnswers(prev => ({ ...prev, [field.id]: { status: 'INPUT', rows: table.rows, note: table.note } }));
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                해당 없음
              </label>
              {field.tableNoneDescription && (
                <span className="text-xs text-blue-600 font-medium">({field.tableNoneDescription})</span>
              )}
            </div>
            <TableEditor
              columns={field.columns || []}
              value={table.rows}
              onChange={(rows) => setEditingAnswers(prev => ({ ...prev, [field.id]: { ...table, status: 'INPUT', rows } }))}
              minRows={isNone ? 0 : (field.minRows || 1)}
              maxRows={field.maxRows || 100}
              disabled={isNone}
            />
          </div>
        );
      }
      default:
        return (
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={value || ''}
            onChange={(e) => setEditingAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
    }
  };

  const handleSurveyExport = () => {
    if (!currentSurvey) return;
    
    const workbook = XLSX.utils.book_new();

    (async () => {
      try {
        const allSubs = await listSurveySubmissions(currentSurvey.id);

        // Sheet 1: Summary data (non-table fields)
        const nonTableFields = currentSurvey.fields.filter(f => f.type !== 'table');
        const summaryHeaders = ['기관명', ...nonTableFields.map(f => f.label), '제출일시'];
        const summaryRows = allSubs.map(sub => {
          const fieldValues = nonTableFields.map(f => {
            const val = sub.data[f.id];
            if (Array.isArray(val)) return val.join(', ');
            return val || '';
          });
          return [
            sub.agencyName,
            ...fieldValues,
            new Date(sub.submittedAt).toLocaleString('ko-KR')
          ];
        });

        const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');

        // Sheet 2+: Table fields (one sheet per table field)
        const tableFields = currentSurvey.fields.filter(f => f.type === 'table');
        tableFields.forEach(field => {
          const tableRows: any[][] = [];

          // Headers: 시도, 기관유형, 기관명, ...table columns
          const tableHeaders = ['시도', '기관유형', '기관명', ...(field.columns?.map(col => col.label) || [])];
          tableRows.push(tableHeaders);

          // Data rows
          allSubs.forEach(sub => {
            const org = organizationsData.find((o: any) => o.orgName === sub.agencyName);
            const region = org?.region || '';
            const orgType = org?.orgType || '';

            const table = normalizeTableAnswer(sub.data[field.id]);
            if (table.status === 'INPUT' && table.rows.length > 0) {
              table.rows.forEach(row => {
                const rowData = [
                  region,
                  orgType,
                  sub.agencyName,
                  ...(field.columns?.map(col => row.data?.[col.id] || '') || [])
                ];
                tableRows.push(rowData);
              });
            }
          });

          const tableSheet = XLSX.utils.aoa_to_sheet(tableRows);
          // Sheet name limited to 31 characters
          const sheetName = field.label.substring(0, 31);
          XLSX.utils.book_append_sheet(workbook, tableSheet, sheetName);
        });

        // Download the workbook
        XLSX.writeFile(workbook, `취합자료_${currentSurvey.title}.xlsx`);
      } catch (e) {
        console.error(e);
        alert('엑셀 다운로드에 실패했습니다.');
      }
    })();
  };

  const handleSurveyEdit = () => {
    if (!selectedSurveyId) return;
    navigate(`/admin/survey/edit/${selectedSurveyId}`);
  };

  const handleSurveyDelete = () => {
    if (!selectedSurveyId || !currentSurvey) return;
    (async () => {
      try {
        const submissionCount = await countSurveySubmissionsBySurveyId(selectedSurveyId);
        if (submissionCount > 0) {
          alert(`제출된 자료가 ${submissionCount}건 있어 삭제할 수 없습니다.\n제출자료를 먼저 정리(삭제)한 후 다시 시도해주세요.`);
          return;
        }

        const ok = window.confirm(`'${currentSurvey.title}' 자료 취합 요청을 삭제할까요?`);
        if (!ok) return;

        await deleteSurveyById(selectedSurveyId);
        await loadSurveys();
        alert('자료 취합 요청이 삭제되었습니다.');
      } catch (e) {
        console.error(e);
        alert('삭제에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
      }
    })();
  };

  const handleSurveyAnswerClear = (qna: SurveyQnAPost) => {
    const ok = window.confirm('답변을 삭제(비우기)할까요?');
    if (!ok) return;
    (async () => {
      try {
        await clearSurveyQnAAnswer(qna.id);
        if (selectedSurveyId) {
          const next = await listSurveyQnAs(selectedSurveyId);
          setSurveyQnAs(next);
        }
        setSurveyReplyText({ ...surveyReplyText, [qna.id]: '' });
        alert('답변이 삭제되었습니다.');
      } catch (e) {
        console.error(e);
        alert('답변 삭제에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
      }
    })();
  };

  const handleSurveyQnADelete = (qna: SurveyQnAPost) => {
    const ok = window.confirm('문의글을 삭제할까요?');
    if (!ok) return;
    (async () => {
      try {
        await deleteSurveyQnAById(qna.id);
        if (selectedSurveyId) {
          const next = await listSurveyQnAs(selectedSurveyId);
          setSurveyQnAs(next);
        }
        const copy = { ...surveyReplyText };
        delete copy[qna.id];
        setSurveyReplyText(copy);
        alert('문의글이 삭제되었습니다.');
      } catch (e) {
        console.error(e);
        alert('문의글 삭제에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
      }
    })();
  };

  const handleSurveyReplySubmit = (qna: SurveyQnAPost) => {
    const answer = surveyReplyText[qna.id];
    if (!answer) return;
    (async () => {
      try {
        await answerSurveyQnA({ id: qna.id, answer });
        if (selectedSurveyId) {
          const next = await listSurveyQnAs(selectedSurveyId);
          setSurveyQnAs(next);
        }
        setSurveyReplyText({ ...surveyReplyText, [qna.id]: '' });
        alert('답변이 등록되었습니다.');
      } catch (e) {
        console.error(e);
        alert('답변 등록에 실패했습니다. 관리자 권한/로그인을 확인해주세요.');
      }
    })();
  };

  const downloadCsv = (headers: string[], rows: (string|number)[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  const getShareUrl = () => {
    if (!selectedSurveyId) return '';
    return `${window.location.origin}${window.location.pathname}#/surveys/submit/${selectedSurveyId}`;
  };

  const handleCopyUrl = () => {
    const url = getShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    alert('링크가 클립보드에 복사되었습니다.');
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-12">
      {/* Admin Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
            <button
              onClick={() => navigate('/admin/submission-statistics')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-md text-sm border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <PieChart size={16} /> 제출통계
            </button>
            <button
              onClick={() => navigate('/admin/statistics')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-md text-sm border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <BarChart3 size={16} /> 통계
            </button>
            <button
              onClick={() => navigate('/admin/organizations')}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <Building2 size={16} /> 기관관리
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              className="p-2 border border-gray-300 rounded-md text-sm max-w-xs"
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
            >
              {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              {surveys.length === 0 && <option>등록된 조사가 없습니다</option>}
            </select>
            <button 
              onClick={handleSurveyEdit}
              disabled={!selectedSurveyId}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-md text-sm border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="자료 취합 수정"
            >
              <Pencil size={16} /> 수정
            </button>
            <button 
              onClick={handleSurveyDelete}
              disabled={!selectedSurveyId}
              className="flex items-center gap-2 px-3 py-2 bg-white text-red-600 rounded-md text-sm border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="자료 취합 삭제"
            >
              <Trash2 size={16} /> 삭제
            </button>
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              disabled={!selectedSurveyId}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-md text-sm border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="공유하기"
            >
              <Share2 size={16} /> 공유
            </button>
            <button 
              onClick={() => navigate('/admin/survey/create')}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> 취합 요청 생성
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="space-y-6">
          {surveys.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">등록된 자료 취합 요청이 없습니다.</h3>
              <p className="mt-2 text-gray-500">새로운 조사를 생성하여 기관들로부터 데이터를 취합해보세요.</p>
              <button 
                onClick={() => navigate('/admin/survey/create')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                첫 조사 생성하기
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">{currentSurvey?.title}</h2>
                  <p className="text-sm text-gray-500">{currentSurvey?.description}</p>
                  {currentSurvey && (
                    <p className="text-xs text-gray-400 mt-2">제출기간: {getSurveyPeriodLabel(currentSurvey) || '미정'}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">{submissionsTotal}</div>
                  <div className="text-xs text-gray-500">제출 완료 기관</div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={18} /> 제출 현황 및 데이터
                  </h3>
                  <button 
                    onClick={handleSurveyExport}
                    className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded hover:bg-green-100 border border-green-200"
                  >
                    <Download size={14} /> 엑셀 다운로드
                  </button>
                </div>
                <div className="p-4 border-b border-gray-100 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">기관명 검색</label>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input
                          type="text"
                          className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                          value={submissionsSearch}
                          onChange={(e) => setSubmissionsSearch(e.target.value)}
                          placeholder="기관명을 입력하세요"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">시도</label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                      >
                        <option value="">전체</option>
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">기관 유형</label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        value={selectedOrgType}
                        onChange={(e) => setSelectedOrgType(e.target.value)}
                      >
                        <option value="">전체</option>
                        {orgTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">표시 개수</label>
                      <select
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        value={String(submissionsPageSize)}
                        onChange={(e) => setSubmissionsPageSize(Number(e.target.value))}
                      >
                        {[25, 50, 100, 200].map(n => <option key={n} value={String(n)}>{n}개</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-xs text-gray-500">총 {submissionsTotal}건</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        disabled={submissionsLoading || submissionsPage <= 1}
                        onClick={() => reloadSubmissions(submissionsPage - 1)}
                      >
                        이전
                      </button>
                      <div className="text-sm text-gray-600">{submissionsPage}</div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        disabled={submissionsLoading || (submissionsPage * submissionsPageSize) >= submissionsTotal}
                        onClick={() => reloadSubmissions(submissionsPage + 1)}
                      >
                        다음
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-gray-50 z-10">기관명</th>
                        {currentSurvey?.fields.map(field => (
                          <th key={field.id} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {field.label}
                          </th>
                        ))}
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">관리</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출일시</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {submissionsLoading ? (
                        <tr>
                          <td colSpan={(currentSurvey?.fields.length || 0) + 3} className="text-center py-8 text-gray-500">불러오는 중...</td>
                        </tr>
                      ) : submissions.length === 0 ? (
                        <tr>
                          <td colSpan={(currentSurvey?.fields.length || 0) + 3} className="text-center py-8 text-gray-500">제출된 내역이 없습니다.</td>
                        </tr>
                      ) : (
                        submissions.map((sub) => (
                          <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">{sub.agencyName}</td>
                            {currentSurvey?.fields.map(field => {
                              const value = sub.data[field.id];
                              let displayValue = '';
                              
                              if (field.type === 'table') {
                                const table = normalizeTableAnswer(value);
                                if (table.status !== 'INPUT') {
                                  displayValue = '해당없음';
                                } else {
                                  displayValue = `${table.rows.length}개 행`;
                                }
                              } else if (Array.isArray(value)) {
                                // Multiselect
                                displayValue = value.join(', ');
                              } else {
                                displayValue = value || '';
                              }
                              
                              return (
                                <td key={field.id} className="px-6 py-4 whitespace-nowrap text-gray-600">
                                  {field.type === 'table' ? (
                                    normalizeTableAnswer(value).status !== 'INPUT' ? (
                                      <span className="text-gray-500">해당없음</span>
                                    ) : normalizeTableAnswer(value).rows.length > 0 ? (
                                      <button
                                        onClick={() => setSelectedSubmission(sub)}
                                        className="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                                      >
                                        <Eye size={14} /> {displayValue}
                                      </button>
                                    ) : (
                                      displayValue
                                    )
                                  ) : (
                                    displayValue
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSubmission(sub)}
                                  className="px-2 py-1 text-xs font-bold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubmission(sub)}
                                  className="px-2 py-1 text-xs font-bold rounded border border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400 text-xs">
                              {new Date(sub.submittedAt).toLocaleString('ko-KR')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {qnaEnabled && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageCircle className="text-indigo-600" size={24} />
                    <h3 className="font-bold text-gray-900 text-lg">문의사항 관리</h3>
                  </div>
                  <div className="space-y-4">
                    {surveyQnAs.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">등록된 문의사항이 없습니다.</p>
                    ) : (
                      surveyQnAs.map((qna) => (
                        <div key={qna.id} className={`border rounded-lg p-4 ${qna.answer ? 'bg-gray-50 border-gray-200' : 'bg-white border-indigo-200 shadow-sm'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800">{qna.authorName}</span>
                              <span className="text-xs text-gray-500">{new Date(qna.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!qna.answer && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold">답변대기</span>}
                              {qna.answer && <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-bold">답변완료</span>}
                              <button
                                onClick={() => handleSurveyQnADelete(qna)}
                                className="px-2 py-1 text-xs font-bold rounded border border-red-200 text-red-600 hover:bg-red-50"
                                title="문의글 삭제"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-4 whitespace-pre-wrap">{qna.question}</p>

                          <div className="space-y-2">
                            {qna.answer && (
                              <div className="bg-white border border-gray-200 p-3 rounded text-sm">
                                <span className="font-bold text-gray-900">현재 답변: </span>
                                <span className="text-gray-600 whitespace-pre-wrap">{qna.answer}</span>
                              </div>
                            )}
                            <div className="flex gap-2 items-start">
                              <textarea
                                className="flex-grow p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                rows={2}
                                placeholder={qna.answer ? '답변을 수정하세요...' : '답변 내용을 입력하세요...'}
                                value={surveyReplyText[qna.id] ?? (qna.answer ?? '')}
                                onChange={(e) => setSurveyReplyText({ ...surveyReplyText, [qna.id]: e.target.value })}
                              />
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleSurveyReplySubmit(qna)}
                                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 whitespace-nowrap"
                                >
                                  {qna.answer ? '수정' : '등록'}
                                </button>
                                {qna.answer && (
                                  <button
                                    onClick={() => handleSurveyAnswerClear(qna)}
                                    className="px-4 py-2 bg-white text-gray-700 text-sm font-bold rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                                  >
                                    답변삭제
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && currentSurvey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden transform transition-all scale-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> {selectedSubmission.agencyName} - 제출 상세
              </h3>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="space-y-6">
                {currentSurvey.fields.map(field => {
                  const value = selectedSubmission.data[field.id];
                  
                  return (
                    <div key={field.id} className="border-b border-gray-100 pb-4 last:border-0">
                      <h4 className="font-bold text-gray-900 mb-2">{field.label}</h4>
                      
                      {field.type === 'table' ? (
                        (() => {
                          const table = normalizeTableAnswer(value);
                          if (table.status !== 'INPUT') {
                            return <p className="text-gray-500">해당없음</p>;
                          }
                          if (table.rows.length === 0) {
                            return <p className="text-gray-400">(입력된 행 없음)</p>;
                          }
                          return (
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">#</th>
                                    {field.columns?.map(col => (
                                      <th key={col.id} className="px-4 py-2 text-left text-xs font-bold text-gray-500">
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {table.rows.map((row: any, idx: number) => (
                                    <tr key={row.id || idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-gray-600">{idx + 1}</td>
                                      {field.columns?.map(col => (
                                        <td key={col.id} className="px-4 py-2 text-gray-600">
                                          {row.data?.[col.id] || ''}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()
                      ) : Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-2">
                          {value.map((v, idx) => (
                            <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                              {v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">{value || '-'}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Edit Modal */}
      {editingSubmission && currentSurvey && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-none max-h-[90vh] overflow-hidden transform transition-all scale-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Pencil size={20} className="text-indigo-600" /> {editingSubmission.agencyName} - 제출 데이터 수정
              </h3>
              <button
                onClick={() => setEditingSubmission(null)}
                className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={editingSaving}
              >
                닫기
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
              <div className="space-y-6">
                {currentSurvey.fields.map(field => (
                  <div key={field.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="text-sm font-bold text-gray-800 mb-1.5">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </div>
                    {field.description && (
                      <div className="text-xs text-gray-500 mb-2 whitespace-pre-wrap">{field.description}</div>
                    )}
                    {renderEditField(field)}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSubmission(null)}
                className="px-4 py-2 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50"
                disabled={editingSaving}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubmission}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                disabled={editingSaving}
              >
                {editingSaving ? '저장 중...' : '저장 및 제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Share2 size={20} className="text-indigo-600" /> 조사 공유하기
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">링크 복사</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl()}
                    className="flex-grow p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 outline-none focus:ring-2 focus:ring-indigo-100"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5 font-medium text-sm"
                  >
                    <Copy size={16} /> 복사
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center pt-2">
                <div className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <QrCode size={16} /> QR 코드 스캔
                </div>
                <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getShareUrl())}`}
                    alt="Survey QR Code"
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  카메라로 스캔하여<br />모바일에서 작성하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;