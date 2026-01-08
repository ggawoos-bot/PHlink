import React, { useEffect, useMemo, useState } from 'react';
import { Building, FileText, Pencil, Save, Search, X } from 'lucide-react';
import organizationsData from '../org/organizations.generated.json';
import TableEditor from '../components/TableEditor';
import { listSurveys, listMySurveySubmissions, updateMySurveySubmission } from '../services/surveys';
import { Survey, SurveyField, SurveySubmission, TableRow } from '../types';

type AgencyRow = {
  id: string;
  name: string;
  region: string;
  orgType: string;
};

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

const SubmissionLookup: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const currentSurvey = useMemo(() => surveys.find(s => s.id === selectedSurveyId), [surveys, selectedSurveyId]);

  const agencies: AgencyRow[] = useMemo(() => {
    return (organizationsData ?? []).map((o: any) => ({
      id: String(o.id),
      name: String(o.orgName ?? ''),
      region: String(o.region ?? ''),
      orgType: String(o.orgType ?? ''),
    }));
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const a of agencies) if (a.region) set.add(a.region);
    return Array.from(set).sort((a, b) => {
      const ia = orderIndex(REGION_ORDER, a);
      const ib = orderIndex(REGION_ORDER, b);
      if (ia !== ib) return ia - ib;
      return compareKorean(a, b);
    });
  }, [agencies]);

  const orgTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of agencies) if (a.orgType) set.add(a.orgType);
    return Array.from(set).sort((a, b) => {
      const ia = orderIndex(ORG_TYPE_ORDER, a);
      const ib = orderIndex(ORG_TYPE_ORDER, b);
      if (ia !== ib) return ia - ib;
      return compareKorean(a, b);
    });
  }, [agencies]);

  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('');
  const [searchAgency, setSearchAgency] = useState<string>('');
  const [selectedAgency, setSelectedAgency] = useState<AgencyRow | null>(null);

  const filteredAgencies = useMemo(() => {
    const q = searchAgency.trim().toLowerCase();
    return agencies
      .filter(a => (!selectedRegion || a.region === selectedRegion))
      .filter(a => (!selectedOrgType || a.orgType === selectedOrgType))
      .filter(a => (!q || a.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const ra = orderIndex(REGION_ORDER, a.region);
        const rb = orderIndex(REGION_ORDER, b.region);
        if (ra !== rb) return ra - rb;

        const ta = orderIndex(ORG_TYPE_ORDER, a.orgType);
        const tb = orderIndex(ORG_TYPE_ORDER, b.orgType);
        if (ta !== tb) return ta - tb;

        return compareKorean(a.name, b.name);
      })
      .slice(0, 200);
  }, [agencies, searchAgency, selectedOrgType, selectedRegion]);

  const [systemUserId, setSystemUserId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SurveySubmission[]>([]);

  const [editingSubmission, setEditingSubmission] = useState<SurveySubmission | null>(null);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sv = await listSurveys();
        if (!mounted) return;
        setSurveys(sv);
        setSelectedSurveyId('');
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setSurveys([]);
        setSelectedSurveyId('');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const resetResults = () => {
    setResults([]);
    setEditingSubmission(null);
    setEditingAnswers({});
  };

  const handleLookup = async () => {
    if (!selectedSurveyId) {
      alert('자료제출 건을 선택해 주세요');
      return;
    }
    if (!selectedAgency) {
      alert('기관을 선택해주세요.');
      return;
    }
    const uid = systemUserId.trim();
    if (!uid) {
      alert('시스템 사용자아이디를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const rows = await listMySurveySubmissions({
        surveyId: selectedSurveyId,
        agencyId: selectedAgency.id,
        systemUserId: uid,
      });
      setResults(rows);
      setEditingSubmission(null);
      setEditingAnswers({});
    } catch (e) {
      console.error(e);
      alert('조회에 실패했습니다. 입력값을 확인해주세요.');
      resetResults();
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (sub: SurveySubmission) => {
    setEditingSubmission(sub);
    setEditingAnswers({ ...(sub.data ?? {}) });
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
      case 'table':
        return (
          <TableEditor
            columns={field.columns || []}
            value={((value ?? []) as TableRow[]) || []}
            onChange={(rows) => setEditingAnswers(prev => ({ ...prev, [field.id]: rows }))}
            minRows={field.minRows || 1}
            maxRows={field.maxRows || 100}
          />
        );
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

  const handleSave = async () => {
    if (!editingSubmission || !currentSurvey || !selectedSurveyId || !selectedAgency) return;
    const uid = systemUserId.trim();
    if (!uid) return;

    const nextData = {
      ...editingAnswers,
      __system_user_id: uid,
    };

    setSaving(true);
    try {
      const updated = await updateMySurveySubmission({
        id: editingSubmission.id,
        surveyId: selectedSurveyId,
        agencyId: selectedAgency.id,
        systemUserId: uid,
        data: nextData,
      });

      setEditingSubmission(updated);
      setResults(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      alert('저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. 입력값을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="text-indigo-600" size={22} />
          <h1 className="text-lg font-bold text-gray-900">제출자료 조회/수정</h1>
        </div>

        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <p className="font-bold">제출한 자료에 대해 조회/수정할 수 있는 메뉴입니다.</p>
          <p className="mt-3 font-bold">정확하게 입력하시기 바랍니다.</p>
          <p className="mt-3">
            조회/수정 원하는 "자료제출 건"과 기관을 선택하고 자료제출시 입력하였던 "시스템 사용자아이디"를 입력하고 "조회" 버튼을 클릭하여 조회합니다.
            매칭되는 제출건이 있는 경우 아래 목록에 조회결과가 나타납니다.
          </p>
          <p className="mt-3">제출기간내에 수정 제출할 수 있습니다. 기간 마감 후에는 수정이 되지 않습니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">자료제출 건 선택</label>
            <select
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              value={selectedSurveyId}
              onChange={(e) => {
                setSelectedSurveyId(e.target.value);
                resetResults();
              }}
            >
              <option value="">선택</option>
              {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              {surveys.length === 0 && <option value="">등록된 조사가 없습니다</option>}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">시도</label>
            <select
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedAgency(null);
                resetResults();
              }}
            >
              <option value="">전체</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">기관 유형</label>
            <select
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              value={selectedOrgType}
              onChange={(e) => {
                setSelectedOrgType(e.target.value);
                setSelectedAgency(null);
                resetResults();
              }}
            >
              <option value="">전체</option>
              {orgTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">기관 검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchAgency}
                onChange={(e) => {
                  setSearchAgency(e.target.value);
                  setSelectedAgency(null);
                  resetResults();
                }}
                placeholder="기관명을 입력하세요"
                className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">기관 선택</label>
            {!selectedAgency ? (
              <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filteredAgencies.length > 0 ? (
                  filteredAgencies.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgency(a);
                        resetResults();
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm"
                    >
                      {a.name}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <span className="font-bold text-indigo-900">{selectedAgency.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAgency(null);
                    resetResults();
                  }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  변경
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">시스템 사용자아이디</label>
            <input
              type="text"
              value={systemUserId}
              onChange={(e) => {
                setSystemUserId(e.target.value);
                resetResults();
              }}
              placeholder="제출 시 입력한 값"
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={loading}
              className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Building size={18} className="text-indigo-600" />
            <h2 className="font-bold text-gray-900">조회 결과</h2>
          </div>

          {results.length === 0 ? (
            <div className="text-sm text-gray-500 border border-gray-200 rounded-lg p-4 bg-gray-50">조회 결과가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">기관명</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">제출일시</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">{r.agencyName}</td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{new Date(r.submittedAt).toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={14} /> 수정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingSubmission && currentSurvey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-none max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Save size={20} className="text-indigo-600" /> 제출 데이터 수정
              </h3>
              <button
                onClick={() => setEditingSubmission(null)}
                className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
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
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장 및 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionLookup;
