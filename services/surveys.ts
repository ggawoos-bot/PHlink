import { supabase } from './supabaseClient';
import { Survey, SurveyQnAPost, SurveySubmission } from '../types';

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalDateTimeInputValue = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const parseLocalDateTimeToIso = (local: string | undefined) => {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const sha256Hex = async (text: string) => {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
};

type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  host: string | null;
  status: 'OPEN' | 'CLOSED' | string;
  start_at: string | null;
  end_at: string | null;
  fields: any;
  created_at: string | null;
};

const mapSurveyRowToSurvey = (row: SurveyRow): Survey => {
  const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const startAt = row.start_at ? toLocalDateTimeInputValue(new Date(row.start_at)) : toLocalDateTimeInputValue(new Date(createdAtMs));
  const endAt = row.end_at ? toLocalDateTimeInputValue(new Date(row.end_at)) : startAt;

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    host: row.host ?? '',
    deadline: endAt.split('T')[0],
    startAt,
    endAt,
    fields: Array.isArray(row.fields) ? row.fields : (row.fields ?? []),
    status: row.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    createdAt: createdAtMs,
  };
};

export const listSurveys = async (): Promise<Survey[]> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('surveys')
    .select('id,title,description,host,status,start_at,end_at,fields,created_at')
    .order('start_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r: any) => mapSurveyRowToSurvey(r as SurveyRow));
};

export const getSurvey = async (id: string): Promise<Survey | null> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('surveys')
    .select('id,title,description,host,status,start_at,end_at,fields,created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSurveyRowToSurvey(data as any);
};

export const upsertSurvey = async (survey: Survey): Promise<void> => {
  const payload: any = {
    id: survey.id,
    title: survey.title,
    description: survey.description ?? '',
    host: survey.host ?? '',
    status: survey.status,
    start_at: parseLocalDateTimeToIso(survey.startAt),
    end_at: parseLocalDateTimeToIso(survey.endAt),
    fields: survey.fields ?? [],
    created_at: new Date(survey.createdAt).toISOString(),
  };

  const { error } = await supabase
    .schema('phlink')
    .from('surveys')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
};

export const deleteSurveyById = async (surveyId: string): Promise<void> => {
  const { error } = await supabase
    .schema('phlink')
    .from('surveys')
    .delete()
    .eq('id', surveyId);

  if (error) throw error;
};

type SurveySubmissionRow = {
  id: string;
  survey_id: string;
  agency_id: string;
  agency_name: string | null;
  data: any;
  submitted_at: string;
};

export const listSurveySubmissions = async (surveyId: string): Promise<SurveySubmission[]> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('survey_submissions')
    .select('id,survey_id,agency_id,agency_name,data,submitted_at')
    .eq('survey_id', surveyId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const row = r as SurveySubmissionRow;
    return {
      id: row.id,
      surveyId: row.survey_id,
      agencyId: row.agency_id,
      agencyName: row.agency_name ?? '',
      data: (row.data ?? {}) as Record<string, any>,
      submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : Date.now(),
    };
  });
};

type SurveyQnAPublicRow = {
  id: string;
  survey_id: string;
  author_name: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

export const listSurveyQnAs = async (surveyId: string): Promise<SurveyQnAPost[]> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('survey_qna_public')
    .select('id,survey_id,author_name,question,answer,answered_at,created_at')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const row = r as SurveyQnAPublicRow;
    return {
      id: row.id,
      surveyId: row.survey_id,
      authorName: row.author_name,
      password: '',
      question: row.question,
      answer: row.answer ?? undefined,
      answeredAt: row.answered_at ? new Date(row.answered_at).getTime() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    };
  });
};

export const createSurveyQnA = async (args: {
  surveyId: string;
  authorName: string;
  password: string;
  question: string;
}): Promise<void> => {
  const passwordHash = await sha256Hex(args.password);

  const { error } = await supabase
    .schema('phlink')
    .from('survey_qna')
    .insert({
      survey_id: args.surveyId,
      author_name: args.authorName,
      password_hash: passwordHash,
      question: args.question,
    });

  if (error) throw error;
};

export const answerSurveyQnA = async (args: { id: string; answer: string }): Promise<void> => {
  const { error } = await supabase
    .schema('phlink')
    .from('survey_qna')
    .update({ answer: args.answer, answered_at: new Date().toISOString() })
    .eq('id', args.id);

  if (error) throw error;
};

export const clearSurveyQnAAnswer = async (id: string): Promise<void> => {
  const { error } = await supabase
    .schema('phlink')
    .from('survey_qna')
    .update({ answer: null, answered_at: null })
    .eq('id', id);

  if (error) throw error;
};

export const deleteSurveyQnAById = async (id: string): Promise<void> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('survey_qna')
    .delete()
    .select('id')
    .eq('id', id);

  if (error) throw error;

  // PostgREST can return 204 with no error even if 0 rows were affected (e.g. RLS).
  // Force returning rows and validate.
  const deleted = data as unknown as Array<{ id: string }> | null;
  if (!deleted || deleted.length === 0) {
    throw new Error('No rows deleted (possible RLS/permission issue).');
  }
};
