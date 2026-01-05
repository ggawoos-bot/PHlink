import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, MessageCircle, ClipboardList, FileText, Pencil, Trash2, Share2, X, Copy, QrCode, Eye, BarChart3 } from 'lucide-react';
import { answerSurveyQnA, clearSurveyQnAAnswer, deleteSurveyById, deleteSurveyQnAById, listSurveyQnAs, listSurveySubmissions, listSurveys } from '../services/surveys';

import { Survey, SurveyQnAPost, SurveySubmission } from '../types';
import { supabase } from '../services/supabaseClient';

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

  const loadSurveySubmissionsAndQnAs = async (surveyId: string) => {
    try {
      const [subs, qnas] = await Promise.all([
        listSurveySubmissions(surveyId),
        listSurveyQnAs(surveyId),
      ]);
      setSubmissions(subs);
      setSurveyQnAs(qnas);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
      setSurveyQnAs([]);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  useEffect(() => {
    if (selectedSurveyId) {
      loadSurveySubmissionsAndQnAs(selectedSurveyId);
    }
  }, [selectedSurveyId]);

  const reloadSurveys = (keepSelectedId?: string) => {
    loadSurveys(keepSelectedId);
  };

  const currentSurvey = surveys.find(s => s.id === selectedSurveyId);

  const handleSurveyExport = () => {
    if (!currentSurvey) return;
    // Build headers dynamically
    const fieldHeaders = currentSurvey.fields.map(f => f.label);
    const headers = ['기관명', ...fieldHeaders, '제출일시'];
    const rows = submissions.map(sub => {
      const fieldValues = currentSurvey.fields.map(f => {
        const val = sub.data[f.id];
        // Handle arrays (multiselect) by joining with comma
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        return val || '';
      });
      return [
        sub.agencyName,
        ...fieldValues,
        new Date(sub.submittedAt).toLocaleString('ko-KR')
      ];
    });
    downloadCsv(headers, rows, `취합자료_${currentSurvey.title}`);
  };

  const handleSurveyEdit = () => {
    if (!selectedSurveyId) return;
    navigate(`/admin/survey/edit/${selectedSurveyId}`);
  };

  const handleSurveyDelete = () => {
    if (!selectedSurveyId || !currentSurvey) return;
    const ok = window.confirm(`'${currentSurvey.title}' 자료 취합 요청을 삭제할까요?\n삭제 시 제출 데이터도 함께 삭제됩니다.`);
    if (!ok) return;
    (async () => {
      try {
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
              onClick={() => navigate('/admin/statistics')}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-md text-sm border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <BarChart3 size={16} /> 통계
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-white text-gray-700 rounded-md text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
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
                  <div className="text-2xl font-bold text-indigo-600">{submissions.length}</div>
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
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">제출일시</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {submissions.length === 0 ? (
                        <tr><td colSpan={(currentSurvey?.fields.length || 0) + 2} className="text-center py-8 text-gray-500">제출된 내역이 없습니다.</td></tr>
                      ) : (
                        submissions.map((sub) => (
                          <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100">{sub.agencyName}</td>
                            {currentSurvey?.fields.map(field => {
                              const value = sub.data[field.id];
                              let displayValue = '';
                              
                              if (field.type === 'table' && Array.isArray(value)) {
                                // Table data: show row count
                                displayValue = `${value.length}개 행`;
                              } else if (Array.isArray(value)) {
                                // Multiselect
                                displayValue = value.join(', ');
                              } else {
                                displayValue = value || '';
                              }
                              
                              return (
                                <td key={field.id} className="px-6 py-4 whitespace-nowrap text-gray-600">
                                  {field.type === 'table' && Array.isArray(value) && value.length > 0 ? (
                                    <button
                                      onClick={() => setSelectedSubmission(sub)}
                                      className="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                                    >
                                      <Eye size={14} /> {displayValue}
                                    </button>
                                  ) : (
                                    displayValue
                                  )}
                                </td>
                              );
                            })}
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
                      
                      {field.type === 'table' && Array.isArray(value) ? (
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
                              {value.map((row: any, idx: number) => (
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