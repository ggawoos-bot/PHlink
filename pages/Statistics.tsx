import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { listSurveys, listSurveySubmissions } from '../services/surveys';
import { Survey, SurveySubmission, TableRow } from '../types';
import organizationsData from '../org/organizations.generated.json';

interface TableData {
  [key: string]: any;
}

const Statistics: React.FC = () => {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [tableData, setTableData] = useState<TableData[]>([]);

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
      extractTableData(subs, surveyId);
    } catch (e) {
      console.error(e);
    }
  };

  const extractTableData = (subs: SurveySubmission[], surveyId: string) => {
    const allTableData: TableData[] = [];
    const survey = surveys.find(s => s.id === surveyId);
    
    if (!survey) return;

    subs.forEach(sub => {
      const org = organizationsData.find(o => o.orgName === sub.agencyName);
      
      survey.fields.forEach(field => {
        if (field.type === 'table' && Array.isArray(sub.data[field.id])) {
          const rows = sub.data[field.id] as TableRow[];
          rows.forEach(row => {
            const rowData: TableData = {
              region: org?.region || '',
              orgType: org?.orgType || '',
              orgName: sub.agencyName,
              ...row.data
            };
            allTableData.push(rowData);
          });
        }
      });
    });

    setTableData(allTableData);
  };

  const copyTableToClipboard = (tableId: string) => {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let text = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowText = Array.from(cells).map(cell => cell.textContent?.trim() || '').join('\t');
      text += rowText + '\n';
    });
    
    navigator.clipboard.writeText(text);
    alert('표가 클립보드에 복사되었습니다.');
  };

  const regions = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  // 표 1: 보건소 급여상담 업무담당자 배치 현황
  const calculateTable1 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionOrgs = submissions.filter(sub => {
        const org = organizationsData.find(o => o.orgName === sub.agencyName);
        return org?.region === region;
      });
      
      const healthCenters = regionOrgs.length;
      const workers = tableData.filter(row => row.region === region).length;
      const avgWorkers = healthCenters > 0 ? (workers / healthCenters).toFixed(1) : '0.0';
      
      data.push({ region, healthCenters, workers, avgWorkers });
    });
    
    const totalCenters = data.reduce((sum, r) => sum + r.healthCenters, 0);
    const totalWorkers = data.reduce((sum, r) => sum + r.workers, 0);
    const totalAvg = totalCenters > 0 ? (totalWorkers / totalCenters).toFixed(1) : '0.0';
    data.push({ region: '전국', healthCenters: totalCenters, workers: totalWorkers, avgWorkers: totalAvg });
    
    return data;
  };

  // 표 2: 보건소 급여상담 업무담당자 연령 및 경력 현황
  const calculateTable2 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region);
      const count = regionData.length;
      
      if (count > 0) {
        const avgAge = regionData.reduce((sum, row) => sum + (parseFloat(row['연령']) || 0), 0) / count;
        const avgCareer = regionData.reduce((sum, row) => sum + (parseFloat(row['경력']) || 0), 0) / count;
        const avgExperience = regionData.reduce((sum, row) => sum + (parseFloat(row['경력년수']) || 0), 0) / count;
        const avgStdCareer = regionData.reduce((sum, row) => sum + (parseFloat(row['표준경력']) || 0), 0) / count;
        
        data.push({ 
          region, 
          avgAge: avgAge.toFixed(1), 
          avgCareer: avgCareer.toFixed(1),
          avgExperience: avgExperience.toFixed(1),
          avgStdCareer: avgStdCareer.toFixed(1)
        });
      }
    });
    
    const totalCount = tableData.length;
    if (totalCount > 0) {
      const totalAvgAge = tableData.reduce((sum, row) => sum + (parseFloat(row['연령']) || 0), 0) / totalCount;
      const totalAvgCareer = tableData.reduce((sum, row) => sum + (parseFloat(row['경력']) || 0), 0) / totalCount;
      const totalAvgExp = tableData.reduce((sum, row) => sum + (parseFloat(row['경력년수']) || 0), 0) / totalCount;
      const totalAvgStd = tableData.reduce((sum, row) => sum + (parseFloat(row['표준경력']) || 0), 0) / totalCount;
      
      data.push({ 
        region: '전국', 
        avgAge: totalAvgAge.toFixed(1),
        avgCareer: totalAvgCareer.toFixed(1),
        avgExperience: totalAvgExp.toFixed(1),
        avgStdCareer: totalAvgStd.toFixed(1)
      });
    }
    
    return data;
  };

  // 표 3: 보건소 급여상담 업무담당자 성별 현황
  const calculateTable3 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region);
      const male = regionData.filter(row => row['성별'] === '남성').length;
      const female = regionData.filter(row => row['성별'] === '여성').length;
      const total = regionData.length;
      
      data.push({ 
        region, 
        male: `${male}(${total > 0 ? ((male/total)*100).toFixed(1) : '0.0'})`,
        female: `${female}(${total > 0 ? ((female/total)*100).toFixed(1) : '0.0'})`,
        total: `${total}(100.0)`
      });
    });
    
    const totalMale = tableData.filter(row => row['성별'] === '남성').length;
    const totalFemale = tableData.filter(row => row['성별'] === '여성').length;
    const totalAll = tableData.length;
    
    data.push({ 
      region: '전국', 
      male: `${totalMale}(${totalAll > 0 ? ((totalMale/totalAll)*100).toFixed(1) : '0.0'})`,
      female: `${totalFemale}(${totalAll > 0 ? ((totalFemale/totalAll)*100).toFixed(1) : '0.0'})`,
      total: `${totalAll}(100.0)`
    });
    
    return data;
  };

  // 표 4: 보건소 급여상담 업무담당자 직렬 현황
  const calculateTable4 = () => {
    const data: any[] = [];
    const jobTypes = ['간호', '보건', '의료기술', '행정', '기타'];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region);
      const total = regionData.length;
      const row: any = { region };
      
      jobTypes.forEach(job => {
        const count = regionData.filter(r => r['직렬'] === job).length;
        row[job] = `${count}(${total > 0 ? ((count/total)*100).toFixed(1) : '0.0'})`;
      });
      
      row.total = `${total}(100.0)`;
      data.push(row);
    });
    
    const totalAll = tableData.length;
    const totalRow: any = { region: '전국' };
    jobTypes.forEach(job => {
      const count = tableData.filter(r => r['직렬'] === job).length;
      totalRow[job] = `${count}(${totalAll > 0 ? ((count/totalAll)*100).toFixed(1) : '0.0'})`;
    });
    totalRow.total = `${totalAll}(100.0)`;
    data.push(totalRow);
    
    return data;
  };

  // 표 5: 보건소 급여상담 업무담당자 겸직 현황
  const calculateTable5 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region);
      const total = regionData.length;
      
      const dedicated = regionData.filter(r => r['겸직여부'] === '전담').length;
      const concurrent = regionData.filter(r => r['겸직여부'] === '겸직').length;
      const dedicatedNot = regionData.filter(r => r['겸직여부'] === '전담아님').length;
      const concurrentNot = regionData.filter(r => r['겸직여부'] === '겸직아님').length;
      
      data.push({ 
        region,
        dedicated: `${dedicated}(${total > 0 ? ((dedicated/total)*100).toFixed(1) : '0.0'})`,
        dedicatedNot: `${dedicatedNot}(${total > 0 ? ((dedicatedNot/total)*100).toFixed(1) : '0.0'})`,
        concurrent: `${concurrent}(${total > 0 ? ((concurrent/total)*100).toFixed(1) : '0.0'})`,
        concurrentNot: `${concurrentNot}(${total > 0 ? ((concurrentNot/total)*100).toFixed(1) : '0.0'})`,
        total: `${total}(100.0)`
      });
    });
    
    const totalAll = tableData.length;
    const totalDedicated = tableData.filter(r => r['겸직여부'] === '전담').length;
    const totalConcurrent = tableData.filter(r => r['겸직여부'] === '겸직').length;
    const totalDedicatedNot = tableData.filter(r => r['겸직여부'] === '전담아님').length;
    const totalConcurrentNot = tableData.filter(r => r['겸직여부'] === '겸직아님').length;
    
    data.push({ 
      region: '전국',
      dedicated: `${totalDedicated}(${totalAll > 0 ? ((totalDedicated/totalAll)*100).toFixed(1) : '0.0'})`,
      dedicatedNot: `${totalDedicatedNot}(${totalAll > 0 ? ((totalDedicatedNot/totalAll)*100).toFixed(1) : '0.0'})`,
      concurrent: `${totalConcurrent}(${totalAll > 0 ? ((totalConcurrent/totalAll)*100).toFixed(1) : '0.0'})`,
      concurrentNot: `${totalConcurrentNot}(${totalAll > 0 ? ((totalConcurrentNot/totalAll)*100).toFixed(1) : '0.0'})`,
      total: `${totalAll}(100.0)`
    });
    
    return data;
  };

  // 표 6: 보건소 급여상담사 배치 현황
  const calculateTable6 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionOrgs = submissions.filter(sub => {
        const org = organizationsData.find(o => o.orgName === sub.agencyName);
        return org?.region === region;
      });
      
      const healthCenters = regionOrgs.length;
      const counselors = tableData.filter(row => row.region === region && row['직종'] === '상담사').length;
      const avgCounselors = healthCenters > 0 ? (counselors / healthCenters).toFixed(1) : '0.0';
      
      data.push({ region, healthCenters, counselors, avgCounselors });
    });
    
    const totalCenters = data.reduce((sum, r) => sum + r.healthCenters, 0);
    const totalCounselors = data.reduce((sum, r) => sum + r.counselors, 0);
    const totalAvg = totalCenters > 0 ? (totalCounselors / totalCenters).toFixed(1) : '0.0';
    data.push({ region: '전국', healthCenters: totalCenters, counselors: totalCounselors, avgCounselors: totalAvg });
    
    return data;
  };

  // 표 7: 보건소 급여상담사 연령 현황
  const calculateTable7 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region && row['직종'] === '상담사');
      const count = regionData.length;
      
      if (count > 0) {
        const minAge = Math.min(...regionData.map(r => parseFloat(r['연령']) || 0));
        const maxAge = Math.max(...regionData.map(r => parseFloat(r['연령']) || 0));
        const avgAge = regionData.reduce((sum, row) => sum + (parseFloat(row['연령']) || 0), 0) / count;
        const stdDev = Math.sqrt(regionData.reduce((sum, row) => sum + Math.pow((parseFloat(row['연령']) || 0) - avgAge, 2), 0) / count);
        
        data.push({ 
          region, 
          minAge: minAge.toFixed(0),
          maxAge: maxAge.toFixed(0),
          avgAge: avgAge.toFixed(1),
          stdDev: stdDev.toFixed(1)
        });
      }
    });
    
    const allCounselors = tableData.filter(row => row['직종'] === '상담사');
    if (allCounselors.length > 0) {
      const minAge = Math.min(...allCounselors.map(r => parseFloat(r['연령']) || 0));
      const maxAge = Math.max(...allCounselors.map(r => parseFloat(r['연령']) || 0));
      const avgAge = allCounselors.reduce((sum, row) => sum + (parseFloat(row['연령']) || 0), 0) / allCounselors.length;
      const stdDev = Math.sqrt(allCounselors.reduce((sum, row) => sum + Math.pow((parseFloat(row['연령']) || 0) - avgAge, 2), 0) / allCounselors.length);
      
      data.push({ 
        region: '전국', 
        minAge: minAge.toFixed(0),
        maxAge: maxAge.toFixed(0),
        avgAge: avgAge.toFixed(1),
        stdDev: stdDev.toFixed(1)
      });
    }
    
    return data;
  };

  // 표 8: 보건소 급여상담사 급여상담 경력 현황
  const calculateTable8 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region && row['직종'] === '상담사');
      const count = regionData.length;
      
      if (count > 0) {
        const minCareer = Math.min(...regionData.map(r => parseFloat(r['경력']) || 0));
        const maxCareer = Math.max(...regionData.map(r => parseFloat(r['경력']) || 0));
        const avgCareer = regionData.reduce((sum, row) => sum + (parseFloat(row['경력']) || 0), 0) / count;
        const stdDev = Math.sqrt(regionData.reduce((sum, row) => sum + Math.pow((parseFloat(row['경력']) || 0) - avgCareer, 2), 0) / count);
        
        data.push({ 
          region, 
          minCareer: minCareer.toFixed(0),
          maxCareer: maxCareer.toFixed(0),
          avgCareer: avgCareer.toFixed(1),
          stdDev: stdDev.toFixed(1)
        });
      }
    });
    
    const allCounselors = tableData.filter(row => row['직종'] === '상담사');
    if (allCounselors.length > 0) {
      const minCareer = Math.min(...allCounselors.map(r => parseFloat(r['경력']) || 0));
      const maxCareer = Math.max(...allCounselors.map(r => parseFloat(r['경력']) || 0));
      const avgCareer = allCounselors.reduce((sum, row) => sum + (parseFloat(row['경력']) || 0), 0) / allCounselors.length;
      const stdDev = Math.sqrt(allCounselors.reduce((sum, row) => sum + Math.pow((parseFloat(row['경력']) || 0) - avgCareer, 2), 0) / allCounselors.length);
      
      data.push({ 
        region: '전국', 
        minCareer: minCareer.toFixed(0),
        maxCareer: maxCareer.toFixed(0),
        avgCareer: avgCareer.toFixed(1),
        stdDev: stdDev.toFixed(1)
      });
    }
    
    return data;
  };

  // 표 9: 보건소 급여상담사 성별 현황
  const calculateTable9 = () => {
    const data: any[] = [];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region && row['직종'] === '상담사');
      const male = regionData.filter(row => row['성별'] === '남성').length;
      const female = regionData.filter(row => row['성별'] === '여성').length;
      const notSpecified = regionData.filter(row => !row['성별'] || (row['성별'] !== '남성' && row['성별'] !== '여성')).length;
      const total = regionData.length;
      
      data.push({ 
        region, 
        male: `${male}(${total > 0 ? ((male/total)*100).toFixed(1) : '0.0'})`,
        female: `${female}(${total > 0 ? ((female/total)*100).toFixed(1) : '0.0'})`,
        notSpecified: `${notSpecified}(${total > 0 ? ((notSpecified/total)*100).toFixed(1) : '0.0'})`,
        total: `${total}(100.0)`
      });
    });
    
    const allCounselors = tableData.filter(row => row['직종'] === '상담사');
    const totalMale = allCounselors.filter(row => row['성별'] === '남성').length;
    const totalFemale = allCounselors.filter(row => row['성별'] === '여성').length;
    const totalNotSpecified = allCounselors.filter(row => !row['성별'] || (row['성별'] !== '남성' && row['성별'] !== '여성')).length;
    const totalAll = allCounselors.length;
    
    data.push({ 
      region: '전국', 
      male: `${totalMale}(${totalAll > 0 ? ((totalMale/totalAll)*100).toFixed(1) : '0.0'})`,
      female: `${totalFemale}(${totalAll > 0 ? ((totalFemale/totalAll)*100).toFixed(1) : '0.0'})`,
      notSpecified: `${totalNotSpecified}(${totalAll > 0 ? ((totalNotSpecified/totalAll)*100).toFixed(1) : '0.0'})`,
      total: `${totalAll}(100.0)`
    });
    
    return data;
  };

  // 표 11: 보건소 급여상담사 고용형태
  const calculateTable11 = () => {
    const data: any[] = [];
    const employmentTypes = ['기간제근로자', '무기계약자', '시간선택제임기제공무원', '일반공무원'];
    
    regions.forEach(region => {
      const regionData = tableData.filter(row => row.region === region && row['직종'] === '상담사');
      const total = regionData.length;
      const row: any = { region };
      
      employmentTypes.forEach(type => {
        const count = regionData.filter(r => r['고용형태'] === type).length;
        row[type] = `${count}(${total > 0 ? ((count/total)*100).toFixed(1) : '0.0'})`;
      });
      
      row.total = `${total}(100.0)`;
      data.push(row);
    });
    
    const allCounselors = tableData.filter(row => row['직종'] === '상담사');
    const totalAll = allCounselors.length;
    const totalRow: any = { region: '전국' };
    employmentTypes.forEach(type => {
      const count = allCounselors.filter(r => r['고용형태'] === type).length;
      totalRow[type] = `${count}(${totalAll > 0 ? ((count/totalAll)*100).toFixed(1) : '0.0'})`;
    });
    totalRow.total = `${totalAll}(100.0)`;
    data.push(totalRow);
    
    return data;
  };

  const table1Data = calculateTable1();
  const table2Data = calculateTable2();
  const table3Data = calculateTable3();
  const table4Data = calculateTable4();
  const table5Data = calculateTable5();
  const table6Data = calculateTable6();
  const table7Data = calculateTable7();
  const table8Data = calculateTable8();
  const table9Data = calculateTable9();
  const table11Data = calculateTable11();

  return (
    <div className="bg-gray-100 min-h-screen pb-12">
      <div className="bg-white border-b border-gray-200 p-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">통계 분석</h1>
          <select 
            className="ml-auto p-2 border border-gray-300 rounded-md text-sm"
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
          >
            {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {submissions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">제출된 데이터가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 표 1 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 1. 보건소 급여상담 업무담당자 배치 현황</h3>
                <button onClick={() => copyTableToClipboard('table1')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table1" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">보건소 수</th>
                      <th className="border border-gray-300 px-4 py-2">업무담당자 인원수</th>
                      <th className="border border-gray-300 px-4 py-2">보건소 1개소당 업무담당자 평균 인원</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table1Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.healthCenters}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.workers}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgWorkers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 2 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 2. 보건소 급여상담 업무담당자 연령 및 경력 현황</h3>
                <button onClick={() => copyTableToClipboard('table2')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table2" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">평균 연령</th>
                      <th className="border border-gray-300 px-4 py-2">표준편차</th>
                      <th className="border border-gray-300 px-4 py-2">평균 경력</th>
                      <th className="border border-gray-300 px-4 py-2">표준편차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table2Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgAge}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgCareer}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgExperience}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgStdCareer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 3 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 3. 보건소 급여상담 업무담당자 성별 현황</h3>
                <button onClick={() => copyTableToClipboard('table3')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table3" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">남성</th>
                      <th className="border border-gray-300 px-4 py-2">여성</th>
                      <th className="border border-gray-300 px-4 py-2">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table3Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.male}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.female}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 4 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 4. 보건소 급여상담 업무담당자 직렬 현황</h3>
                <button onClick={() => copyTableToClipboard('table4')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table4" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">간호</th>
                      <th className="border border-gray-300 px-4 py-2">보건</th>
                      <th className="border border-gray-300 px-4 py-2">의료기술</th>
                      <th className="border border-gray-300 px-4 py-2">행정</th>
                      <th className="border border-gray-300 px-4 py-2">기타</th>
                      <th className="border border-gray-300 px-4 py-2">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table4Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['간호']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['보건']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['의료기술']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['행정']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['기타']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 5 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 5. 보건소 급여상담 업무담당자 겸직 현황</h3>
                <button onClick={() => copyTableToClipboard('table5')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table5" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th rowSpan={2} className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th colSpan={2} className="border border-gray-300 px-4 py-2">급여상담업무 겸직</th>
                      <th colSpan={2} className="border border-gray-300 px-4 py-2">급여지도담당업무 겸직</th>
                      <th rowSpan={2} className="border border-gray-300 px-4 py-2">전체</th>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">겸직 중</th>
                      <th className="border border-gray-300 px-4 py-2">해당없음</th>
                      <th className="border border-gray-300 px-4 py-2">겸직 중</th>
                      <th className="border border-gray-300 px-4 py-2">해당없음</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table5Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.dedicated}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.dedicatedNot}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.concurrent}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.concurrentNot}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 6 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 6. 보건소 급여상담사 배치 현황</h3>
                <button onClick={() => copyTableToClipboard('table6')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table6" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">보건소 수</th>
                      <th className="border border-gray-300 px-4 py-2">상담사 인원수</th>
                      <th className="border border-gray-300 px-4 py-2">보건소 1개소당 상담사 평균 인원</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table6Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.healthCenters}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.counselors}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgCounselors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 7 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 7. 보건소 급여상담사 연령 현황</h3>
                <button onClick={() => copyTableToClipboard('table7')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table7" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">최저 연령</th>
                      <th className="border border-gray-300 px-4 py-2">최고 연령</th>
                      <th className="border border-gray-300 px-4 py-2">평균 연령</th>
                      <th className="border border-gray-300 px-4 py-2">표준편차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table7Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.minAge}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.maxAge}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgAge}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.stdDev}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 8 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 8. 보건소 급여상담사 급여상담 경력 현황</h3>
                <button onClick={() => copyTableToClipboard('table8')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table8" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">최저 경력</th>
                      <th className="border border-gray-300 px-4 py-2">최고 경력</th>
                      <th className="border border-gray-300 px-4 py-2">평균 경력</th>
                      <th className="border border-gray-300 px-4 py-2">표준편차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table8Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.minCareer}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.maxCareer}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.avgCareer}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.stdDev}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 9 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 9. 보건소 급여상담사 성별 현황</h3>
                <button onClick={() => copyTableToClipboard('table9')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table9" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">남성</th>
                      <th className="border border-gray-300 px-4 py-2">여성</th>
                      <th className="border border-gray-300 px-4 py-2">채용예정</th>
                      <th className="border border-gray-300 px-4 py-2">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table9Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.male}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.female}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.notSpecified}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 표 11 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">표 11. 보건소 급여상담사 고용형태</h3>
                <button onClick={() => copyTableToClipboard('table11')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                  <Copy size={16} /> 복사
                </button>
              </div>
              <div className="overflow-x-auto">
                <table id="table11" className="min-w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">시도구분</th>
                      <th className="border border-gray-300 px-4 py-2">기간제근로자</th>
                      <th className="border border-gray-300 px-4 py-2">무기계약자</th>
                      <th className="border border-gray-300 px-4 py-2">시간선택제임기제공무원</th>
                      <th className="border border-gray-300 px-4 py-2">일반공무원</th>
                      <th className="border border-gray-300 px-4 py-2">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table11Data.map((row, idx) => (
                      <tr key={idx} className={row.region === '전국' ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50'}>
                        <td className="border border-gray-300 px-4 py-2">{row.region}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['기간제근로자']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['무기계약자']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['시간선택제임기제공무원']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row['일반공무원']}</td>
                        <td className="border border-gray-300 px-4 py-2 text-right">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Statistics;
