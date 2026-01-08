import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { listSurveys, listSurveySubmissions } from '../services/surveys';
import { Survey, SurveySubmission } from '../types';
import organizationsData from '../org/organizations.generated.json';

type OrgRow = {
  id: string;
  orgName: string;
  region: string;
  orgType: string;
};

type GroupStat = {
  key: string;
  total: number;
  submitted: number;
  notSubmitted: number;
  submittedRate: number;
};

type RegionOrgTypeStat = {
  region: string;
  orgType: string;
  total: number;
  submitted: number;
  notSubmitted: number;
  submittedRate: number;
};

type DrawerStatus = 'SUBMITTED' | 'NOT_SUBMITTED';

const calcRate = (submitted: number, total: number) => {
  if (total <= 0) return 0;
  return Math.round((submitted / total) * 1000) / 10; // 1 decimal
};

const SubmissionStatistics: React.FC = () => {
  const navigate = useNavigate();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerStatus, setDrawerStatus] = useState<DrawerStatus>('SUBMITTED');
  const [drawerRegion, setDrawerRegion] = useState<string>('');
  const [drawerOrgType, setDrawerOrgType] = useState<string>('');
  const [drawerSearch, setDrawerSearch] = useState<string>('');

  useEffect(() => {
    loadSurveys();
  }, []);

  useEffect(() => {
    if (!selectedSurveyId) return;
    loadSubmissions(selectedSurveyId);
  }, [selectedSurveyId]);

  const loadSurveys = async () => {
    try {
      const sv = await listSurveys();
      setSurveys(sv);
      if (sv.length > 0) setSelectedSurveyId(sv[0].id);
    } catch (e) {
      console.error(e);
      setSurveys([]);
      setSelectedSurveyId('');
    }
  };

  const loadSubmissions = async (surveyId: string) => {
    try {
      setLoading(true);
      const subs = await listSurveySubmissions(surveyId);
      setSubmissions(subs);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const orgRows: OrgRow[] = useMemo(() => {
    return (organizationsData ?? []).map((o: any) => ({
      id: String(o.id),
      orgName: String(o.orgName ?? ''),
      region: String(o.region ?? ''),
      orgType: String(o.orgType ?? ''),
    }));
  }, []);

  const currentSurvey = useMemo(() => surveys.find(s => s.id === selectedSurveyId), [surveys, selectedSurveyId]);

  const targetOrgRows = useMemo(() => {
    const targets = currentSurvey?.targetOrgTypes;
    if (!targets || targets.length === 0) return orgRows;
    const targetSet = new Set(targets);
    return orgRows.filter(o => targetSet.has(o.orgType));
  }, [currentSurvey?.targetOrgTypes, orgRows]);

  const submittedAgencyIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const sub of submissions) {
      if (sub.agencyId) set.add(String(sub.agencyId));
    }
    return set;
  }, [submissions]);

  const openDrawer = (args: { status: DrawerStatus; region?: string; orgType?: string }) => {
    setDrawerStatus(args.status);
    setDrawerRegion((args.region ?? '').trim());
    setDrawerOrgType((args.orgType ?? '').trim());
    setDrawerSearch('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const drawerTitle = useMemo(() => {
    const statusLabel = drawerStatus === 'SUBMITTED' ? '제출' : '미제출';
    const parts: string[] = [];
    if (drawerRegion) parts.push(drawerRegion);
    if (drawerOrgType) parts.push(drawerOrgType);
    const cond = parts.length > 0 ? ` (${parts.join(' / ')})` : '';
    return `${statusLabel} 기관 목록${cond}`;
  }, [drawerOrgType, drawerRegion, drawerStatus]);

  const drawerOrgList = useMemo(() => {
    const region = drawerRegion.trim();
    const orgType = drawerOrgType.trim();
    const search = drawerSearch.trim().toLowerCase();

    const base = targetOrgRows.filter(o => {
      if (region && o.region !== region) return false;
      if (orgType && o.orgType !== orgType) return false;
      const isSubmitted = submittedAgencyIdSet.has(o.id);
      if (drawerStatus === 'SUBMITTED' && !isSubmitted) return false;
      if (drawerStatus === 'NOT_SUBMITTED' && isSubmitted) return false;
      if (search) {
        const hay = `${o.orgName} ${o.region} ${o.orgType}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return base.sort((a, b) => {
      const r = a.region.localeCompare(b.region, 'ko-KR');
      if (r !== 0) return r;
      const t = a.orgType.localeCompare(b.orgType, 'ko-KR');
      if (t !== 0) return t;
      return a.orgName.localeCompare(b.orgName, 'ko-KR');
    });
  }, [drawerOrgType, drawerRegion, drawerSearch, drawerStatus, submittedAgencyIdSet, targetOrgRows]);

  const overall = useMemo(() => {
    const total = targetOrgRows.length;
    const submitted = targetOrgRows.filter(o => submittedAgencyIdSet.has(o.id)).length;
    const notSubmitted = total - submitted;
    return { total, submitted, notSubmitted, submittedRate: calcRate(submitted, total) };
  }, [submittedAgencyIdSet, targetOrgRows]);

  const byRegion: GroupStat[] = useMemo(() => {
    const map = new Map<string, { total: number; submitted: number }>();
    for (const o of targetOrgRows) {
      const k = o.region || '미분류';
      const cur = map.get(k) ?? { total: 0, submitted: 0 };
      cur.total += 1;
      if (submittedAgencyIdSet.has(o.id)) cur.submitted += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        total: v.total,
        submitted: v.submitted,
        notSubmitted: v.total - v.submitted,
        submittedRate: calcRate(v.submitted, v.total),
      }))
      .sort((a, b) => {
        if (a.key === '전국') return -1;
        if (b.key === '전국') return 1;
        return a.key.localeCompare(b.key, 'ko-KR');
      });
  }, [submittedAgencyIdSet, targetOrgRows]);
  const byRegionOrgType: RegionOrgTypeStat[] = useMemo(() => {
    const map = new Map<string, { region: string; orgType: string; total: number; submitted: number }>();

    for (const o of targetOrgRows) {
      const region = o.region || '미분류';
      const orgType = o.orgType || '미분류';
      const k = `${region}||${orgType}`;
      const cur = map.get(k) ?? { region, orgType, total: 0, submitted: 0 };
      cur.total += 1;
      if (submittedAgencyIdSet.has(o.id)) cur.submitted += 1;
      map.set(k, cur);
    }

    return Array.from(map.values())
      .map(v => ({
        region: v.region,
        orgType: v.orgType,
        total: v.total,
        submitted: v.submitted,
        notSubmitted: v.total - v.submitted,
        submittedRate: calcRate(v.submitted, v.total),
      }))
      .sort((a, b) => {
        const regionCmp = a.region.localeCompare(b.region, 'ko-KR');
        if (regionCmp !== 0) return regionCmp;
        return a.orgType.localeCompare(b.orgType, 'ko-KR');
      });
  }, [submittedAgencyIdSet, targetOrgRows]);

  const byOrgTypeByRegion = useMemo(() => {
    const map = new Map<string, RegionOrgTypeStat[]>();
    for (const row of byRegionOrgType) {
      const list = map.get(row.region) ?? [];
      list.push(row);
      map.set(row.region, list);
    }
    for (const [region, list] of map.entries()) {
      list.sort((a, b) => a.orgType.localeCompare(b.orgType, 'ko-KR'));
      map.set(region, list);
    }
    return map;
  }, [byRegionOrgType]);

  const toggleRegion = (region: string) => {
    setExpandedRegions(prev => ({ ...prev, [region]: !prev[region] }));
  };

  const byOrgType: GroupStat[] = useMemo(() => {
    const map = new Map<string, { total: number; submitted: number }>();
    for (const o of targetOrgRows) {
      const k = o.orgType || '미분류';
      const cur = map.get(k) ?? { total: 0, submitted: 0 };
      cur.total += 1;
      if (submittedAgencyIdSet.has(o.id)) cur.submitted += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        total: v.total,
        submitted: v.submitted,
        notSubmitted: v.total - v.submitted,
        submittedRate: calcRate(v.submitted, v.total),
      }))
      .sort((a, b) => a.key.localeCompare(b.key, 'ko-KR'));
  }, [submittedAgencyIdSet, targetOrgRows]);

  return (
    <div className="bg-gray-100 min-h-screen pb-12 text-base">
      <div className="bg-white border-b border-gray-200 p-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">제출통계</h1>
          <select
            className="ml-auto p-2.5 border border-gray-300 rounded-md text-base"
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
          >
            {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            {surveys.length === 0 && <option value="">등록된 조사가 없습니다</option>}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-xl">기관유형별 제출 현황</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-base">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">기관유형</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">대상</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">미제출</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출률</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {byOrgType.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">데이터가 없습니다.</td>
                      </tr>
                    ) : (
                      byOrgType.map((r) => (
                        <tr key={r.key} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{r.key}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{r.total}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              className="font-bold text-indigo-700 hover:text-indigo-900 underline"
                              onClick={() => openDrawer({ status: 'SUBMITTED', orgType: r.key })}
                            >
                              {r.submitted}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              className="font-bold text-rose-700 hover:text-rose-900 underline"
                              onClick={() => openDrawer({ status: 'NOT_SUBMITTED', orgType: r.key })}
                            >
                              {r.notSubmitted}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 font-semibold">{r.submittedRate}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-900 text-xl">시도별 제출 현황</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-base">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">시도</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">대상</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">미제출</th>
                      <th className="px-6 py-3 text-right text-sm font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출률</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {byRegion.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">데이터가 없습니다.</td>
                      </tr>
                    ) : (
                      byRegion.flatMap((r) => {
                        const region = r.key;
                        const isExpanded = Boolean(expandedRegions[region]);
                        const details = byOrgTypeByRegion.get(region) ?? [];
                        return [
                          (
                            <tr key={`region:${region}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 mr-2 text-gray-500 hover:text-gray-700"
                                  onClick={() => toggleRegion(region)}
                                  aria-label={isExpanded ? '접기' : '펼치기'}
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {region}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{r.total}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  className="font-bold text-indigo-700 hover:text-indigo-900 underline"
                                  onClick={() => openDrawer({ status: 'SUBMITTED', region })}
                                >
                                  {r.submitted}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  className="font-bold text-rose-700 hover:text-rose-900 underline"
                                  onClick={() => openDrawer({ status: 'NOT_SUBMITTED', region })}
                                >
                                  {r.notSubmitted}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 font-semibold">{r.submittedRate}%</td>
                            </tr>
                          ),
                          ...(isExpanded
                            ? details.map(d => (
                              <tr key={`detail:${d.region}||${d.orgType}`} className="bg-gray-50/30 hover:bg-gray-50">
                                <td className="px-6 py-3 whitespace-nowrap text-gray-800">
                                  <span className="ml-8">{d.orgType}</span>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-right text-gray-700">{d.total}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                  <button
                                    type="button"
                                    className="font-bold text-indigo-700 hover:text-indigo-900 underline"
                                    onClick={() => openDrawer({ status: 'SUBMITTED', region: d.region, orgType: d.orgType })}
                                  >
                                    {d.submitted}
                                  </button>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                  <button
                                    type="button"
                                    className="font-bold text-rose-700 hover:text-rose-900 underline"
                                    onClick={() => openDrawer({ status: 'NOT_SUBMITTED', region: d.region, orgType: d.orgType })}
                                  >
                                    {d.notSubmitted}
                                  </button>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-right text-gray-700 font-semibold">{d.submittedRate}%</td>
                              </tr>
                            ))
                            : []),
                        ];
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {drawerOpen && (
              <>
                <div
                  className="fixed inset-0 bg-black/30 z-40"
                  onClick={closeDrawer}
                />
                <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] bg-white z-50 shadow-2xl border-l border-gray-200 flex flex-col">
                  <div className="p-5 border-b border-gray-200 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-lg font-bold text-gray-900">{drawerTitle}</div>
                      <div className="text-sm text-gray-500 mt-1">총 {drawerOrgList.length}개</div>
                    </div>
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="px-3 py-2 text-sm font-bold rounded border border-gray-300 hover:bg-gray-50"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="p-5 border-b border-gray-100">
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder="기관명/시도/기관유형 검색"
                      className="w-full p-3 border border-gray-300 rounded-lg text-base outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1 overflow-auto">
                    {drawerOrgList.length === 0 ? (
                      <div className="p-6 text-gray-500">표시할 기관이 없습니다.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {drawerOrgList.map((o) => (
                          <div key={o.id} className="p-5">
                            <div className="text-lg font-bold text-gray-900">{o.orgName || o.id}</div>
                            <div className="text-sm text-gray-600 mt-1">{o.region}{o.orgType ? ` / ${o.orgType}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SubmissionStatistics;
