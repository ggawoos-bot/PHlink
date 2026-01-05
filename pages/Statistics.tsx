import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';
import { listSurveys, listSurveySubmissions } from '../services/surveys';
import { Survey, SurveySubmission, TableRow } from '../types';
import organizationsData from '../org/organizations.generated.json';

interface StatisticsData {
  byRegion: Record<string, number>;
  byOrgType: Record<string, number>;
  tableStats: Record<string, any>;
}

const Statistics: React.FC = () => {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [statistics, setStatistics] = useState<StatisticsData>({
    byRegion: {},
    byOrgType: {},
    tableStats: {}
  });

  useEffect(() => {
    loadSurveys();
  }, []);

  useEffect(() => {
    if (selectedSurveyId) {
      loadSubmissions(selectedSurveyId);
    }
  }, [selectedSurveyId]);

  const loadSurveys = async () => {
    try {
      const sv = await listSurveys();
      setSurveys(sv);
      if (sv.length > 0) {
        setSelectedSurveyId(sv[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadSubmissions = async (surveyId: string) => {
    try {
      const subs = await listSurveySubmissions(surveyId);
      setSubmissions(subs);
      calculateStatistics(subs);
    } catch (e) {
      console.error(e);
    }
  };

  const calculateStatistics = (subs: SurveySubmission[]) => {
    const byRegion: Record<string, number> = {};
    const byOrgType: Record<string, number> = {};
    const tableStats: Record<string, any> = {};

    // Map agency names to organization data
    subs.forEach(sub => {
      const org = organizationsData.find(o => o.orgName === sub.agencyName);
      
      if (org) {
        // Count by region
        byRegion[org.region] = (byRegion[org.region] || 0) + 1;
        
        // Count by org type
        byOrgType[org.orgType] = (byOrgType[org.orgType] || 0) + 1;
      }

      // Process table fields for statistics
      const survey = surveys.find(s => s.id === selectedSurveyId);
      if (survey) {
        survey.fields.forEach(field => {
          if (field.type === 'table' && Array.isArray(sub.data[field.id])) {
            if (!tableStats[field.id]) {
              tableStats[field.id] = {
                fieldLabel: field.label,
                columns: field.columns || [],
                aggregatedData: {}
              };
            }

            const rows = sub.data[field.id] as TableRow[];
            rows.forEach(row => {
              field.columns?.forEach(col => {
                const value = row.data?.[col.id];
                if (value) {
                  if (!tableStats[field.id].aggregatedData[col.id]) {
                    tableStats[field.id].aggregatedData[col.id] = {};
                  }
                  
                  // Count occurrences for select type columns
                  if (col.type === 'select') {
                    tableStats[field.id].aggregatedData[col.id][value] = 
                      (tableStats[field.id].aggregatedData[col.id][value] || 0) + 1;
                  }
                  // Sum for number type columns
                  else if (col.type === 'number') {
                    if (!tableStats[field.id].aggregatedData[col.id].sum) {
                      tableStats[field.id].aggregatedData[col.id].sum = 0;
                      tableStats[field.id].aggregatedData[col.id].count = 0;
                    }
                    tableStats[field.id].aggregatedData[col.id].sum += parseFloat(value) || 0;
                    tableStats[field.id].aggregatedData[col.id].count += 1;
                  }
                }
              });
            });
          }
        });
      }
    });

    setStatistics({ byRegion, byOrgType, tableStats });
  };

  const currentSurvey = surveys.find(s => s.id === selectedSurveyId);

  const downloadStatsCsv = () => {
    if (!currentSurvey) return;
    
    const rows: string[][] = [];
    
    // Region statistics
    rows.push(['=== 시도별 제출 현황 ===']);
    rows.push(['시도', '제출 기관 수']);
    Object.entries(statistics.byRegion).forEach(([region, count]) => {
      rows.push([region, count.toString()]);
    });
    rows.push([]);
    
    // Org type statistics
    rows.push(['=== 기관 유형별 제출 현황 ===']);
    rows.push(['기관 유형', '제출 기관 수']);
    Object.entries(statistics.byOrgType).forEach(([type, count]) => {
      rows.push([type, count.toString()]);
    });
    rows.push([]);

    // Table statistics
    Object.values(statistics.tableStats).forEach((tableStat: any) => {
      rows.push([`=== ${tableStat.fieldLabel} 통계 ===`]);
      
      tableStat.columns.forEach((col: any) => {
        const colData = tableStat.aggregatedData[col.id];
        if (colData) {
          rows.push([`[${col.label}]`]);
          
          if (col.type === 'select') {
            Object.entries(colData).forEach(([value, count]) => {
              rows.push([value, count.toString()]);
            });
          } else if (col.type === 'number' && colData.sum !== undefined) {
            rows.push(['합계', colData.sum.toString()]);
            rows.push(['평균', (colData.sum / colData.count).toFixed(2)]);
            rows.push(['개수', colData.count.toString()]);
          }
          rows.push([]);
        }
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `통계_${currentSurvey.title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={24} className="text-purple-600" /> 통계 분석
            </h1>
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
              onClick={downloadStatsCsv}
              disabled={!selectedSurveyId || submissions.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} /> 통계 다운로드
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!currentSurvey || submissions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">통계 데이터가 없습니다</h3>
            <p className="mt-2 text-gray-500">제출된 데이터가 있어야 통계를 확인할 수 있습니다.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">총 제출 기관</div>
                <div className="text-3xl font-bold text-indigo-600">{submissions.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">시도 수</div>
                <div className="text-3xl font-bold text-purple-600">{Object.keys(statistics.byRegion).length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">기관 유형 수</div>
                <div className="text-3xl font-bold text-green-600">{Object.keys(statistics.byOrgType).length}</div>
              </div>
            </div>

            {/* Region Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">시도별 제출 현황</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">시도</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">제출 기관 수</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">비율</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(statistics.byRegion)
                      .sort(([, a], [, b]) => b - a)
                      .map(([region, count]) => (
                        <tr key={region} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{region}</td>
                          <td className="px-6 py-4 text-right text-gray-600">{count}</td>
                          <td className="px-6 py-4 text-right text-gray-600">
                            {((count / submissions.length) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Org Type Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">기관 유형별 제출 현황</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">기관 유형</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">제출 기관 수</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">비율</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(statistics.byOrgType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <tr key={type} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{type}</td>
                          <td className="px-6 py-4 text-right text-gray-600">{count}</td>
                          <td className="px-6 py-4 text-right text-gray-600">
                            {((count / submissions.length) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Field Statistics */}
            {Object.values(statistics.tableStats).map((tableStat: any) => (
              <div key={tableStat.fieldLabel} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-4">{tableStat.fieldLabel} - 통계</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tableStat.columns.map((col: any) => {
                    const colData = tableStat.aggregatedData[col.id];
                    if (!colData) return null;

                    return (
                      <div key={col.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-sm text-gray-700 mb-3">{col.label}</h4>
                        
                        {col.type === 'select' ? (
                          <div className="space-y-2">
                            {Object.entries(colData)
                              .sort(([, a]: any, [, b]: any) => b - a)
                              .map(([value, count]: any) => (
                                <div key={value} className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600">{value}</span>
                                  <span className="font-bold text-indigo-600">{count}</span>
                                </div>
                              ))}
                          </div>
                        ) : col.type === 'number' && colData.sum !== undefined ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">합계</span>
                              <span className="font-bold text-green-600">{colData.sum.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">평균</span>
                              <span className="font-bold text-blue-600">
                                {(colData.sum / colData.count).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">개수</span>
                              <span className="font-bold text-purple-600">{colData.count}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">통계 없음</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Statistics;
