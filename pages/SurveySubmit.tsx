import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, AlertCircle, Building, Save, Search, Share2, X, Copy, QrCode, Calendar, ChevronDown, MessageSquare, Send, User, Download } from 'lucide-react';
import { createSurveyQnA, getSurvey, listSurveyQnAs } from '../services/surveys';
import { Survey, Agency, SurveyField, SurveyQnAPost, SurveySubmission, TableRow } from '../types';
import { supabase } from '../services/supabaseClient';
import organizationsData from '../org/organizations.generated.json';
import TableEditor from '../components/TableEditor';
import * as XLSX from 'xlsx';

type SurveyTimingStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

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

const SurveySubmit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedSubmission, setSubmittedSubmission] = useState<SurveySubmission | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  // QnA
  const [qnas, setQnAs] = useState<SurveyQnAPost[]>([]);
  const [qAuthor, setQAuthor] = useState('');
  const [qPassword, setQPassword] = useState('');
  const [qQuestion, setQQuestion] = useState('');

  // Form State
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedOrgType, setSelectedOrgType] = useState<string>('');
  const [searchAgency, setSearchAgency] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({}); // any to support array for checkboxes
  const [systemUserId, setSystemUserId] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const s = await getSurvey(id);
        const qnaEnabled = s?.qnaEnabled ?? true;
        const q = qnaEnabled ? await listSurveyQnAs(id) : [];
        if (!mounted) return;
        setSurvey(s ?? undefined);
        setQnAs(q);

        if (s?.targetOrgTypes && s.targetOrgTypes.length === 1) {
          setSelectedOrgType(s.targetOrgTypes[0] ?? '');
        } else if (s?.targetOrgTypes && s.targetOrgTypes.length > 0) {
          setSelectedOrgType(prev => (prev && s.targetOrgTypes?.includes(prev) ? prev : ''));
        }
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setSurvey(undefined);
        setQnAs([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    const loadedAgencies = organizationsData.map(org => ({
      id: org.id,
      name: org.orgName,
      region: org.region,
      regionCode: org.regionCode,
      regionLong: org.regionLong,
      orgCode: org.orgCode,
      orgName: org.orgName,
      orgType: org.orgType
    }));
    setAgencies(loadedAgencies);
  }, []);

  const regions = Array.from(new Set(agencies.map(a => a.region).filter(Boolean))).sort((a, b) => {
    const ia = orderIndex(REGION_ORDER, a);
    const ib = orderIndex(REGION_ORDER, b);
    if (ia !== ib) return ia - ib;
    return compareKorean(a, b);
  });

  const orgTypes = Array.from(new Set(agencies.map(a => a.orgType).filter(Boolean))).sort((a, b) => {
    const ia = orderIndex(ORG_TYPE_ORDER, a);
    const ib = orderIndex(ORG_TYPE_ORDER, b);
    if (ia !== ib) return ia - ib;
    return compareKorean(a, b);
  });

  const targetOrgTypes = survey?.targetOrgTypes ?? [];
  const hasOrgTypeRestriction = targetOrgTypes.length > 0;
  const allowedOrgTypeSet = hasOrgTypeRestriction ? new Set(targetOrgTypes) : null;

  const availableOrgTypes = hasOrgTypeRestriction
    ? orgTypes.filter(t => allowedOrgTypeSet!.has(t))
    : orgTypes;

  useEffect(() => {
    if (!hasOrgTypeRestriction) return;
    if (!selectedOrgType) return;
    if (!allowedOrgTypeSet || !allowedOrgTypeSet.has(selectedOrgType)) {
      setSelectedOrgType('');
      setSelectedAgency(null);
    }
  }, [hasOrgTypeRestriction, selectedOrgType, survey?.targetOrgTypes]);

  const filteredAgencies = agencies.filter(a => {
    const matchesAllowedType = !hasOrgTypeRestriction || (a.orgType ? allowedOrgTypeSet!.has(a.orgType) : false);
    const matchesRegion = !selectedRegion || a.region === selectedRegion;
    const matchesOrgType = !selectedOrgType || a.orgType === selectedOrgType;
    const matchesSearch = !searchAgency || a.name.toLowerCase().includes(searchAgency.toLowerCase());
    return matchesAllowedType && matchesRegion && matchesOrgType && matchesSearch;
  }).sort((a, b) => {
    const ra = orderIndex(REGION_ORDER, String(a.region ?? ''));
    const rb = orderIndex(REGION_ORDER, String(b.region ?? ''));
    if (ra !== rb) return ra - rb;

    const ta = orderIndex(ORG_TYPE_ORDER, String(a.orgType ?? ''));
    const tb = orderIndex(ORG_TYPE_ORDER, String(b.orgType ?? ''));
    if (ta !== tb) return ta - tb;

    return compareKorean(String(a.name ?? ''), String(b.name ?? ''));
  });

  const handleInputChange = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const currentList = (prev[fieldId] as string[]) || [];
      if (checked) {
        return { ...prev, [fieldId]: [...currentList, option] };
      } else {
        return { ...prev, [fieldId]: currentList.filter(item => item !== option) };
      }
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('링크가 클립보드에 복사되었습니다.');
  };

  async function handleSubmitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!survey?.qnaEnabled) {
      alert('문의/답변 기능이 비활성화되어 있습니다.');
      return;
    }
    if (!id || !qAuthor || !qPassword || !qQuestion) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    try {
      await createSurveyQnA({
        surveyId: id,
        authorName: qAuthor,
        password: qPassword,
        question: qQuestion,
      });

      const q = await listSurveyQnAs(id);
      setQnAs(q);
      setQAuthor('');
      setQPassword('');
      setQQuestion('');
      alert('문의가 등록되었습니다.');
    } catch (err) {
      console.error(err);
      alert('문의 등록에 실패했습니다.');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !selectedAgency) {
      alert('기관을 선택해주세요.');
      return;
    }

    if (!String(systemUserId ?? '').trim()) {
      alert(`'시스템 사용자아이디' 항목을 입력/선택해주세요.`);
      return;
    }

    const nowMs = Date.now();
    const timing = getSurveyTimingStatus(survey, nowMs);
    if (timing === 'UPCOMING') {
      alert(`제출 기간이 아직 시작되지 않았습니다.\n제출기간: ${formatPeriod(survey)}`);
      return;
    }
    if (timing === 'CLOSED') {
      alert(`제출 기간이 종료되었습니다.\n제출기간: ${formatPeriod(survey)}`);
      return;
    }

    // Validation
    for (const field of survey.fields) {
      if (field.required) {
        const val = answers[field.id];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          alert(`'${field.label}' 항목을 입력/선택해주세요.`);
          return;
        }
      }
      
      // Table field validation
      if (field.type === 'table' && field.columns) {
        const tableData = answers[field.id] as TableRow[] | undefined;
        if (tableData && Array.isArray(tableData)) {
          for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
            const row = tableData[rowIndex];
            for (const col of field.columns) {
              if (col.required) {
                const cellValue = row.data?.[col.id];
                if (cellValue === undefined || cellValue === null || cellValue === '') {
                  alert(`'${field.label}' 테이블의 ${rowIndex + 1}번째 행에서 '${col.label}' 항목을 입력/선택해주세요.`);
                  return;
                }
              }
            }
          }
        }
      }
    }

    setLoading(true);

    const answersWithMeta = {
      ...answers,
      __system_user_id: systemUserId.trim(),
    };

    const { data, error } = await supabase.functions.invoke('phlink-submit-survey', {
      body: {
        surveyId: survey.id,
        agencyId: selectedAgency.id,
        agencyName: selectedAgency.name,
        answers: answersWithMeta,
      },
    });

    setLoading(false);

    const errMsg = (error as any)?.message || (data as any)?.error;
    if (errMsg) {
      alert(String(errMsg));
      return;
    }

    const sub = (data as any)?.submission;
    if (sub && sub.id && sub.survey_id) {
      setSubmittedSubmission({
        id: String(sub.id),
        surveyId: String(sub.survey_id),
        agencyId: String(sub.agency_id),
        agencyName: String(sub.agency_name ?? selectedAgency.name ?? ''),
        data: (sub.data ?? answersWithMeta) as Record<string, any>,
        submittedAt: sub.submitted_at ? new Date(String(sub.submitted_at)).getTime() : Date.now(),
      });
    } else {
      setSubmittedSubmission({
        id: `LOCAL-${Date.now()}`,
        surveyId: survey.id,
        agencyId: selectedAgency.id,
        agencyName: selectedAgency.name,
        data: (answersWithMeta ?? {}) as Record<string, any>,
        submittedAt: Date.now(),
      });
    }

    setSubmitted(true);
  };

  // Field Renderer
  const renderField = (field: SurveyField) => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            placeholder="내용을 입력하세요"
            value={answers[field.id] || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        );
      case 'select':
        return (
          <div className="relative">
            <select
              className="w-full p-3 bg-white border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
              value={answers[field.id] || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
            >
              <option value="">선택해주세요</option>
              {field.options?.map((opt, idx) => (
                <option key={idx} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
          </div>
        );
      case 'multiselect':
        return (
          <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {field.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={(answers[field.id] as string[])?.includes(opt) || false}
                  onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-700">{opt}</span>
              </label>
            ))}
            {(!field.options || field.options.length === 0) && <span className="text-gray-400 text-sm">옵션이 없습니다.</span>}
          </div>
        );
      case 'date':
        return (
          <div className="relative">
            <input
              type="date"
              className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={answers[field.id] || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
            />
            <Calendar className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
          </div>
        );
      case 'number':
        return (
          <input
            type="number"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="숫자 입력"
            value={answers[field.id] || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        );
      case 'table':
        return (
          <TableEditor
            columns={field.columns || []}
            value={(answers[field.id] as TableRow[]) || []}
            onChange={(rows) => handleInputChange(field.id, rows)}
            minRows={field.minRows || 1}
            maxRows={field.maxRows || 100}
          />
        );
      default: // text
        return (
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="내용을 입력하세요"
            value={answers[field.id] || ''}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        );
    }
  };

  const renderSubmittedValue = (field: SurveyField, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400">(미입력)</span>;
    }

    if (field.type === 'multiselect' && Array.isArray(value)) {
      return <span className="text-gray-900">{value.join(', ')}</span>;
    }

    if (field.type === 'table') {
      const rows = (Array.isArray(value) ? value : []) as TableRow[];
      const cols = field.columns ?? [];

      if (cols.length === 0) {
        return <span className="text-gray-900">(테이블 컬럼 없음)</span>;
      }

      if (rows.length === 0) {
        return <span className="text-gray-400">(입력된 행 없음)</span>;
      }

      return (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                {cols.map(c => (
                  <th key={c.id} className="text-left text-xs font-bold text-gray-700 px-3 py-2 border-b border-gray-200">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id ?? idx} className="odd:bg-white even:bg-gray-50">
                  {cols.map(c => {
                    const cell = (r as any)?.data?.[c.id];
                    const cellText = Array.isArray(cell) ? cell.join(', ') : (cell ?? '');
                    return (
                      <td key={c.id} className="text-sm text-gray-900 px-3 py-2 border-b border-gray-100 whitespace-pre-wrap">
                        {cellText || <span className="text-gray-400">(미입력)</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (typeof value === 'string') {
      return <span className="text-gray-900 whitespace-pre-wrap">{value}</span>;
    }

    return <span className="text-gray-900">{String(value)}</span>;
  };

  const toExcelCellString = (field: SurveyField, value: any) => {
    if (value === undefined || value === null || value === '') return '';
    if (field.type === 'multiselect' && Array.isArray(value)) return value.join(', ');
    if (field.type === 'table') return '(테이블: 별도 시트 참조)';
    if (typeof value === 'string') return value;
    return String(value);
  };

  const sanitizeSheetName = (name: string) => {
    const cleaned = (name ?? '').replace(/[\\/?*\[\]:]/g, ' ').trim();
    const trimmed = cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
    return trimmed || 'Sheet';
  };

  const sanitizeFileName = (name: string) => {
    const cleaned = (name ?? '').replace(/[\\/?%*:|"<>]/g, '_').trim();
    return cleaned || 'download';
  };

  const handleDownloadExcel = () => {
    if (!survey) return;
    const submittedData = submittedSubmission?.data ?? (answers ?? {});
    const submittedAgencyName = submittedSubmission?.agencyName ?? selectedAgency?.name ?? '';
    const submittedAtText = submittedSubmission?.submittedAt
      ? new Date(submittedSubmission.submittedAt).toLocaleString()
      : '';

    try {
      const wb = XLSX.utils.book_new();

      const summaryRows = survey.fields.map(f => ({
        항목: f.label,
        값: toExcelCellString(f, (submittedData as any)[f.id]),
        필수: f.required ? 'Y' : 'N',
      }));

      const metaRows = [
        { 항목: '조사명', 값: survey.title ?? '' },
        { 항목: '제출기관', 값: submittedAgencyName },
        { 항목: '제출시각', 값: submittedAtText },
      ];

      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), sanitizeSheetName('메타정보'));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), sanitizeSheetName('제출내용'));

      for (const field of survey.fields) {
        if (field.type !== 'table') continue;

        const cols = field.columns ?? [];
        const rows = ((submittedData as any)[field.id] ?? []) as TableRow[];

        const header = cols.map(c => c.label);
        const aoa: any[][] = [header];

        for (const r of rows) {
          const line = cols.map(c => {
            const cell = (r as any)?.data?.[c.id];
            if (cell === undefined || cell === null) return '';
            if (Array.isArray(cell)) return cell.join(', ');
            return String(cell);
          });
          aoa.push(line);
        }

        const sheet = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, sheet, sanitizeSheetName(field.label || '테이블'));
      }

      const fileBase = sanitizeFileName(`${survey.title ?? 'survey'}_${submittedAgencyName || 'agency'}`);
      const dateTag = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${fileBase}_${dateTag}.xlsx`, { compression: true });
    } catch (e) {
      console.error(e);
      alert('엑셀 다운로드에 실패했습니다.');
    }
  };

  if (!survey) return <div className="p-12 text-center text-gray-500">요청 정보를 찾을 수 없습니다.</div>;

  const timing = getSurveyTimingStatus(survey, Date.now());
  const isWindowOpen = timing === 'OPEN';
  const timingMessage = timing === 'UPCOMING'
    ? `제출 예정입니다. 제출기간: ${formatPeriod(survey)}`
    : timing === 'CLOSED'
      ? `제출이 마감되었습니다. 제출기간: ${formatPeriod(survey)}`
      : `제출기간: ${formatPeriod(survey)}`;

  if (submitted) {
    const submittedData = submittedSubmission?.data ?? (answers ?? {});
    const submittedAgencyName = submittedSubmission?.agencyName ?? selectedAgency?.name ?? '';
    const submittedAtText = submittedSubmission?.submittedAt
      ? new Date(submittedSubmission.submittedAt).toLocaleString()
      : '';

    return (
      <div className={`${survey?.fields.some(f => f.type === 'table') ? 'w-full px-4 sm:px-6 lg:px-8' : 'w-full px-4 sm:px-6 lg:px-8'} py-12`}>
        <div className="text-center py-10">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">제출이 완료되었습니다.</h2>
          <p className="text-gray-500">
            {submittedAgencyName}의 자료가 성공적으로 저장되었습니다.
          </p>
          {submittedAtText && (
            <div className="text-xs text-gray-400 mt-2">제출 시각: {submittedAtText}</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-gray-900">제출 내용 확인</h3>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors"
              title="엑셀 다운로드"
            >
              <Download size={16} /> 엑셀 다운로드
            </button>
          </div>
          <div className="space-y-4">
            {survey.fields.map(field => (
              <div key={field.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="text-sm font-bold text-gray-800 mb-1.5">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </div>
                {field.description && (
                  <div className="text-xs text-gray-500 mb-2 whitespace-pre-wrap">{field.description}</div>
                )}
                <div className="text-sm">
                  {renderSubmittedValue(field, (submittedData as any)[field.id])}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3 mt-8">
            <button
              onClick={() => navigate('/surveys')}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
            >
              목록으로 돌아가기
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
              }}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              수정하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasTableField = survey?.fields.some(f => f.type === 'table');

  return (
    <div className={`${hasTableField ? 'w-full px-4 sm:px-6 lg:px-8' : 'max-w-3xl mx-auto px-4 sm:px-6 lg:px-8'} py-12`}>
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded mb-2 border border-indigo-100">
              {survey.host} 요청
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
            title="공유하기"
          >
            <Share2 size={24} />
          </button>
        </div>
        {!!(survey.description ?? '').trim() && (
          <div className="mt-3 p-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-900">
            <div className="space-y-2 text-base leading-relaxed">
              {(survey.description ?? '')
                .split(/\n\s*\n/g)
                .map(s => s.trim())
                .filter(Boolean)
                .map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className={`mb-6 p-4 rounded-lg border flex items-start gap-2 ${isWindowOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
        <AlertCircle size={18} className="mt-0.5" />
        <div className="text-base font-medium">{timingMessage}</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Agency Select */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building className="text-indigo-600" size={20} /> 제출 기관 선택
          </h2>
          
          {!selectedAgency ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">시도 구분 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">전체</option>
                      {regions.map(region => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">기관 유형 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      value={selectedOrgType}
                      onChange={(e) => setSelectedOrgType(e.target.value)}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">전체</option>
                      {availableOrgTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">기관명 <span className="text-red-500">*</span></label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="기관명을 검색하여 선택하세요" 
                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchAgency}
                    onChange={(e) => setSearchAgency(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredAgencies.length > 0 ? (
                    filteredAgencies.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAgency(a)}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-sm"
                      >
                        {a.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="font-bold text-indigo-900">{selectedAgency.name}</span>
              <button 
                type="button" 
                onClick={() => setSelectedAgency(null)}
                className="text-sm text-indigo-600 hover:underline"
              >
                변경
              </button>
            </div>
          )}
        </div>

         {/* 2. Dynamic Form */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Save className="text-indigo-600" size={20} /> 자료 입력
            </h2>
            
            <div className="space-y-6">
                {survey.fields.map(field => (
                    <div key={field.id} className={`pb-4 border-b border-gray-100 last:border-0 last:pb-0 ${field.type === 'table' ? '-mx-6 px-6 bg-gray-50/50' : ''}`}>
                        <label className={`block font-bold mb-2 ${field.type === 'table' ? 'text-base text-gray-900 pb-2 border-b-2 border-indigo-200' : 'text-sm text-gray-800 mb-1.5'}`}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                        
                        {renderField(field)}
                    </div>
                ))}
            </div>

            <div className="mt-6">
              <div className="flex flex-nowrap justify-end items-end gap-4">
                <div className="flex items-end gap-3 w-full max-w-xl min-w-0">
                  <div className="text-xl font-bold text-gray-700 whitespace-nowrap pb-1">
                    시스템 사용자아이디
                  </div>
                  <input
                    type="text"
                    placeholder="예: user123"
                    className="flex-1 min-w-0 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={systemUserId}
                    onChange={(e) => setSystemUserId(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !isWindowOpen}
                  className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  {loading ? '제출 중...' : !isWindowOpen ? (timing === 'UPCOMING' ? '예정' : '제출 마감') : '자료 제출하기'}
                </button>
              </div>
              <div className="text-xs text-gray-800 mt-1 w-full text-right">
                ※ 제출자의 금연서비스 통합정보시스템 아이디를 입력하시기 바랍니다. 제출한 자료를 조회/수정할 때 이용됩니다.
              </div>
            </div>
         </div>
      </form>

      {(survey.qnaEnabled ?? true) && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-indigo-600" /> 문의/답변
          </h2>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-6">
            <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
              <MessageSquare size={16} /> 문의 남기기
            </h3>
            <form onSubmit={handleSubmitQuestion} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="작성자명"
                  value={qAuthor}
                  onChange={(e) => setQAuthor(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:border-indigo-500"
                  autoComplete="off"
                  required
                />
                <input
                  type="password"
                  placeholder="비밀번호(수정/삭제용)"
                  value={qPassword}
                  onChange={(e) => setQPassword(e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:border-indigo-500"
                  autoComplete="new-password"
                  required
                />
              </div>
              <textarea
                placeholder="문의하실 내용을 입력해주세요."
                value={qQuestion}
                onChange={(e) => setQQuestion(e.target.value)}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:border-indigo-500 resize-none"
                required
              />
              <div className="text-right">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 ml-auto"
                >
                  <Send size={14} /> 등록
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            {qnas.length === 0 ? (
              <p className="text-center text-gray-400 py-4">등록된 문의가 없습니다.</p>
            ) : (
              qnas.map(qna => (
                <div key={qna.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-1 rounded-full"><User size={14} className="text-gray-500"/></div>
                      <span className="font-bold text-gray-900 text-sm">{qna.authorName}</span>
                      <span className="text-xs text-gray-400">{new Date(qna.createdAt).toLocaleDateString()}</span>
                    </div>
                    {qna.answer ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">답변완료</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">대기중</span>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap">{qna.question}</p>

                  {qna.answer && (
                    <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-sm">
                      <div className="font-bold text-indigo-800 mb-1 flex items-center gap-1">
                        ↳ 담당자 답변
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{qna.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Share2 size={20} className="text-indigo-600"/> 조사 공유하기
              </h3>
              <button 
                onClick={() => setShowShareModal(false)} 
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* URL Copy Section */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">링크 복사</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={window.location.href}
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

              {/* QR Code Section */}
              <div className="flex flex-col items-center pt-2">
                <div className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <QrCode size={16} /> QR 코드 스캔
                </div>
                <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-sm">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}`} 
                    alt="Survey QR Code" 
                    className="w-40 h-40"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  카메라로 스캔하여<br/>모바일에서 작성하세요
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveySubmit;