import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { listSurveys } from '../services/surveys';
import { Survey } from '../types';

type SurveyTimingStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

type SurveyFilter = 'ALL' | SurveyTimingStatus;

const getSurveyTimingStatus = (survey: Survey, nowMs: number): SurveyTimingStatus => {
  if (survey.status === 'CLOSED') return 'CLOSED';
  const startMs = new Date(survey.startAt).getTime();
  const endMs = new Date(survey.endAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'OPEN';
  if (nowMs < startMs) return 'UPCOMING';
  if (nowMs > endMs) return 'CLOSED';
  return 'OPEN';
};

const formatPeriod = (survey: Survey) => {
  const start = survey.startAt?.replace('T', ' ');
  const end = survey.endAt?.replace('T', ' ');
  return `${start} ~ ${end}`;
};

const getTimingBadge = (timing: SurveyTimingStatus) => {
  switch (timing) {
    case 'OPEN':
      return {
        label: '진행중',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'UPCOMING':
      return {
        label: '예정',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    case 'CLOSED':
    default:
      return {
        label: '마감',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
};

const SurveyList: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [filter, setFilter] = useState<SurveyFilter>('ALL');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listSurveys();
        if (!mounted) return;
        setSurveys(all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setSurveys([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const nowMs = Date.now();
  const filteredSurveys = surveys.filter(s => {
    if (filter === 'ALL') return true;
    return getSurveyTimingStatus(s, nowMs) === filter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          자료 취합 관리
        </h1>
        <p className="mt-4 text-xl text-gray-500">
          관할 기관에서 요청한 자료 및 통계 제출 건을 확인하세요.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as SurveyFilter)}
          className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        >
          <option value="ALL">전체</option>
          <option value="UPCOMING">예정</option>
          <option value="OPEN">진행</option>
          <option value="CLOSED">마감</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredSurveys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-gray-500 text-lg">해당 조건의 자료 취합 요청이 없습니다.</p>
          </div>
        ) : (
          filteredSurveys.map((survey) => (
            (() => {
              const timing = getSurveyTimingStatus(survey, nowMs);
              const timingBadge = getTimingBadge(timing);
              const isDisabled = timing !== 'OPEN';
              const buttonLabel = timing === 'UPCOMING' ? '예정' : timing === 'CLOSED' ? '제출 마감' : '자료 작성';
              const buttonClass = timing === 'OPEN'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md'
                : timing === 'UPCOMING'
                  ? 'bg-slate-200 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-600 cursor-not-allowed';

              return (
            <div key={survey.id} className="bg-white/90 rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md hover:border-slate-300 transition-all">
              <div className="flex-grow">
                 <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                      {survey.host}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${timingBadge.className}`}>
                      {timingBadge.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      <span className="font-bold">제출기간:</span> {formatPeriod(survey)}
                    </span>
                 </div>
                 <h3 className="text-xl font-bold text-gray-900 mb-2">{survey.title}</h3>
                 <p className="text-gray-600 line-clamp-2">{survey.description}</p>
                 <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                        <ClipboardList size={14} />
                        <span>총 {survey.fields.length}개 항목</span>
                    </div>
                 </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                 {isDisabled ? (
                   <button
                     type="button"
                     disabled
                     className={`block w-full text-center px-6 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${buttonClass}`}
                   >
                     {buttonLabel}
                   </button>
                 ) : (
                   <Link 
                     to={`/surveys/submit/${survey.id}`}
                     className={`block w-full text-center px-6 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${buttonClass}`}
                   >
                     {buttonLabel} <ArrowRight size={16} />
                   </Link>
                 )}
              </div>
            </div>
              );
            })()
          ))
        )}
      </div>
    </div>
  );
};

export default SurveyList;