import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Plus, Pencil, Trash2, X, RotateCcw } from 'lucide-react';
import organizationsData from '../org/organizations.generated.json';

type OrgRow = {
  id: string;
  orgName: string;
  region: string;
  regionCode?: string;
  regionLong?: string;
  orgCode?: string;
  orgType?: string;
};

const normalizeOrgRow = (row: any): OrgRow => {
  return {
    id: String(row?.id ?? ''),
    orgName: String(row?.orgName ?? ''),
    region: String(row?.region ?? ''),
    regionCode: row?.regionCode ? String(row.regionCode) : undefined,
    regionLong: row?.regionLong ? String(row.regionLong) : undefined,
    orgCode: row?.orgCode ? String(row.orgCode) : undefined,
    orgType: row?.orgType ? String(row.orgType) : undefined,
  };
};

const createEmptyOrg = (): OrgRow => ({
  id: '',
  orgName: '',
  region: '',
  regionCode: '',
  regionLong: '',
  orgCode: '',
  orgType: '',
});

const buildId = (orgType?: string, orgCode?: string) => {
  const t = (orgType ?? '').trim();
  const c = (orgCode ?? '').trim();
  if (!t || !c) return '';
  return `${t}:${c}`;
};

const suggestNextOrgCode = (items: OrgRow[], orgType?: string) => {
  const nextType = (orgType ?? '').trim();
  if (!nextType) return '';

  const codes = items
    .filter(i => (i.orgType ?? '').trim() === nextType)
    .map(i => (i.orgCode ?? '').trim())
    .filter(Boolean);

  const numericCodes = codes
    .map(c => (String(c).match(/^\d+$/) ? Number(c) : NaN))
    .filter(n => Number.isFinite(n)) as number[];

  const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
  const maxLen = codes.length > 0 ? Math.max(...codes.map(c => String(c).length)) : 4;
  return String(max + 1).padStart(maxLen, '0');
};

const normalizeNameKey = (name?: string) => {
  return (name ?? '').trim().replace(/\s+/g, '').toLowerCase();
};

const AdminOrganizations: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<OrgRow[]>(() => (organizationsData ?? []).map(normalizeOrgRow));
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrgRow | null>(null);

  const regionMetaByRegion = useMemo(() => {
    const meta = new Map<string, { regionCode: string; regionLong: string }>();
    for (const it of items) {
      const region = it.region?.trim();
      const regionCode = (it.regionCode ?? '').trim();
      const regionLong = (it.regionLong ?? '').trim();
      if (!region || !regionCode || !regionLong) continue;
      if (!meta.has(region)) {
        meta.set(region, { regionCode, regionLong });
      }
    }
    return meta;
  }, [items]);

  const regions = useMemo(() => {
    return Array.from(new Set(items.map(i => i.region).filter(Boolean))).sort();
  }, [items]);

  const orgTypes = useMemo(() => {
    return Array.from(new Set(items.map(i => i.orgType).filter(Boolean) as string[])).sort();
  }, [items]);

  const computedDraftId = useMemo(() => {
    if (!draft) return '';
    return buildId(draft.orgType, draft.orgCode);
  }, [draft]);

  const draftDuplicateInfo = useMemo(() => {
    if (!draft) return { duplicateId: false, duplicateCodeInType: false };
    if (!computedDraftId) return { duplicateId: false, duplicateCodeInType: false };

    const duplicateId = items.some(i => i.id === computedDraftId && i.id !== editingId);
    const duplicateCodeInType = items.some(i =>
      i.id !== editingId &&
      (i.orgType ?? '').trim() === (draft.orgType ?? '').trim() &&
      (i.orgCode ?? '').trim() === (draft.orgCode ?? '').trim()
    );

    return { duplicateId, duplicateCodeInType };
  }, [computedDraftId, draft, editingId, items]);

  const draftDuplicateOrgName = useMemo(() => {
    if (!draft) return false;
    const key = normalizeNameKey(draft.orgName);
    if (!key) return false;
    return items.some(i => i.id !== editingId && normalizeNameKey(i.orgName) === key);
  }, [draft, editingId, items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      const matchesRegion = !selectedRegion || i.region === selectedRegion;
      const matchesType = !selectedOrgType || i.orgType === selectedOrgType;
      const matchesSearch = !q || i.orgName.toLowerCase().includes(q);
      return matchesRegion && matchesType && matchesSearch;
    });
  }, [items, selectedRegion, selectedOrgType, search]);

  const beginCreate = () => {
    setEditingId(null);
    setDraft(createEmptyOrg());
  };

  const beginEdit = (row: OrgRow) => {
    setEditingId(row.id);
    setDraft({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.orgName.trim()) {
      alert('기관명을 입력해주세요.');
      return;
    }

    if (draftDuplicateOrgName) {
      alert('이미 존재하는 기관명입니다. 기관명이 중복되지 않도록 확인해주세요.');
      return;
    }

    if (!draft.region.trim()) {
      alert('시도(region)를 선택해주세요.');
      return;
    }

    if (!draft.orgType?.trim()) {
      alert('기관 유형(orgType)을 입력해주세요.');
      return;
    }

    if (!draft.orgCode?.trim()) {
      alert('기관 코드(orgCode)을 입력해주세요.');
      return;
    }

    const computedId = buildId(draft.orgType, draft.orgCode);
    if (!computedId) {
      alert('id를 생성할 수 없습니다. orgType/orgCode를 확인해주세요.');
      return;
    }

    const duplicateId = items.some(i => i.id === computedId && i.id !== editingId);
    if (duplicateId) {
      alert('이미 존재하는 기관(id)입니다. orgType/orgCode가 중복되지 않도록 확인해주세요.');
      return;
    }

    const duplicateCodeInType = items.some(i =>
      i.id !== editingId &&
      (i.orgType ?? '').trim() === (draft.orgType ?? '').trim() &&
      (i.orgCode ?? '').trim() === (draft.orgCode ?? '').trim()
    );
    if (duplicateCodeInType) {
      alert('동일한 기관 유형(orgType) 내에 이미 사용 중인 기관 코드(orgCode)입니다.');
      return;
    }

    setItems(prev => {
      const normalized = normalizeOrgRow({
        ...draft,
        id: computedId,
      });

      const exists = prev.some(p => p.id === normalized.id);
      if (exists) {
        return prev.map(p => (p.id === normalized.id ? normalized : p));
      }
      return [normalized, ...prev];
    });

    setEditingId(null);
    setDraft(null);
  };

  const deleteOrg = (id: string) => {
    const row = items.find(i => i.id === id);
    const ok = window.confirm(`'${row?.orgName || id}' 기관을 삭제할까요?`);
    if (!ok) return;
    setItems(prev => prev.filter(p => p.id !== id));
    if (editingId === id) cancelEdit();
  };

  const downloadJson = () => {
    const sorted = [...items].sort((a, b) => a.orgName.localeCompare(b.orgName, 'ko'));
    const content = JSON.stringify(sorted, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'organizations.generated.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const openUpload = () => {
    fileInputRef.current?.click();
  };

  const onUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert('업로드한 파일이 올바른 JSON 배열 형식이 아닙니다.');
        return;
      }
      const next = parsed.map(normalizeOrgRow);
      const invalid = next.find(r => !r.id || !r.orgName);
      if (invalid) {
        alert('업로드한 데이터에 id 또는 orgName 이 비어있는 항목이 있습니다.');
        return;
      }
      const ok = window.confirm('현재 편집 중인 내용을 덮어쓰고 업로드한 데이터로 교체할까요?');
      if (!ok) return;

      setItems(next);
      cancelEdit();
      alert('업로드가 완료되었습니다.');
    } catch (err: any) {
      alert(err?.message || '업로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-12">
      <div className="bg-white border-b border-gray-200 p-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="px-3 py-2 bg-white text-gray-700 rounded-md text-sm border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} /> 관리자
            </button>
            <h1 className="text-xl font-bold text-gray-900">기관 관리 (JSON)</h1>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onUploadFile} />
            <button
              onClick={downloadJson}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
            >
              <Download size={16} /> JSON 다운로드
            </button>
            <button
              onClick={beginCreate}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} /> 기관 추가
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-xl p-4 text-sm">
          이 화면에서 수정한 내용은 자동 저장되지 않습니다. 변경 후 반드시 <span className="font-bold">JSON 다운로드</span>로 파일을 저장한 뒤, 프로젝트의 <span className="font-bold">org/organizations.generated.json</span>에 반영해야 합니다.
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">시도 구분</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">전체</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">기관 유형</label>
              <select
                value={selectedOrgType}
                onChange={(e) => setSelectedOrgType(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">전체</option>
                {orgTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">기관명 검색</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="기관명"
              />
            </div>
          </div>

          <div className="text-sm text-gray-500">검색 결과: <span className="font-bold text-gray-900">{filtered.length}</span>건</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">기관명</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">시도</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">유형</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map(row => (
                    <tr key={row.id} className={editingId === row.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.orgName}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.region}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.orgType}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(row)}
                            className="px-2 py-1 text-xs font-bold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                          >
                            <Pencil size={14} /> 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteOrg(row.id)}
                            className="px-2 py-1 text-xs font-bold rounded border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-400">검색 결과가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{draft ? (editingId ? '기관 수정' : '기관 추가') : '편집'}</h2>
              {draft && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {!draft ? (
              <div className="text-sm text-gray-400">왼쪽 목록에서 수정할 기관을 선택하거나, 상단의 '기관 추가'를 눌러주세요.</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">id</label>
                  <input
                    value={computedDraftId}
                    readOnly
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="text-xs text-gray-400 mt-1">id는 <span className="font-bold">orgType:orgCode</span> 규칙으로 자동 생성됩니다.</div>
                  {(draftDuplicateInfo.duplicateId || draftDuplicateInfo.duplicateCodeInType) && (
                    <div className="text-xs text-red-600 mt-1 font-bold">
                      이미 존재하는 기관 코드/ID 입니다. orgType 또는 orgCode를 변경해주세요.
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">기관명(orgName)</label>
                  <input
                    value={draft.orgName}
                    onChange={(e) => setDraft({ ...draft, orgName: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {draftDuplicateOrgName && (
                    <div className="text-xs text-red-600 mt-1 font-bold">이미 존재하는 기관명입니다. 다른 기관명을 입력해주세요.</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">시도(region)</label>
                  <select
                    value={draft.region}
                    onChange={(e) => {
                      const nextRegion = e.target.value;
                      const meta = regionMetaByRegion.get(nextRegion);
                      setDraft({
                        ...draft,
                        region: nextRegion,
                        regionCode: meta?.regionCode ?? '',
                        regionLong: meta?.regionLong ?? '',
                      });
                    }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">선택</option>
                    {regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">기관 유형(orgType)</label>
                  <input
                    value={draft.orgType ?? ''}
                    list="orgTypeOptions"
                    onChange={(e) => {
                      const nextType = e.target.value;
                      if (editingId) {
                        setDraft({ ...draft, orgType: nextType });
                        return;
                      }

                      const suggested = suggestNextOrgCode(items, nextType);

                      setDraft({
                        ...draft,
                        orgType: nextType,
                        orgCode: draft.orgCode?.trim() ? draft.orgCode : suggested,
                        id: '',
                      });
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={Boolean(editingId)}
                  />
                  <datalist id="orgTypeOptions">
                    {orgTypes.map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {editingId && <div className="text-xs text-gray-400 mt-1">기존 항목 수정 시 orgType은 변경하지 않습니다.</div>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">기관 코드(orgCode)</label>
                  <div className="flex gap-2">
                    <input
                      value={draft.orgCode ?? ''}
                      onChange={(e) => {
                        const nextCode = e.target.value;
                        setDraft({
                          ...draft,
                          orgCode: nextCode,
                          id: '',
                        });
                      }}
                      className="flex-1 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={Boolean(editingId)}
                    />
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          const suggested = suggestNextOrgCode(items, draft.orgType);
                          if (!suggested) return;
                          setDraft({
                            ...draft,
                            orgCode: suggested,
                            id: '',
                          });
                        }}
                        className="px-3 py-2 bg-white text-gray-700 rounded-lg font-bold border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                        title="기관 코드 재추천"
                      >
                        <RotateCcw size={16} /> 재추천
                      </button>
                    )}
                  </div>
                  {editingId ? (
                    <div className="text-xs text-gray-400 mt-1">기존 항목 수정 시 orgCode는 변경하지 않습니다.</div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-1">orgType 선택 시 자동으로 다음 번호를 추천합니다. 필요하면 수정하세요.</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">지역 코드(regionCode)</label>
                  <input
                    value={draft.regionCode ?? ''}
                    readOnly
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">지역(상세, regionLong)</label>
                  <input
                    value={draft.regionLong ?? ''}
                    readOnly
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={Boolean(draftDuplicateInfo.duplicateId || draftDuplicateInfo.duplicateCodeInType || draftDuplicateOrgName)}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    저장(목록 반영)
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-white text-gray-700 rounded-lg font-bold border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrganizations;
