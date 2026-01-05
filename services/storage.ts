import { Survey, SurveyQnAPost, SurveySubmission } from '../types';

const EVENTS_KEY = 'ph_link_events';
const APPLICATIONS_KEY = 'ph_link_applications';
const QNA_KEY = 'ph_link_qna';
const SURVEYS_KEY = 'ph_link_surveys';
const SURVEY_SUBMISSIONS_KEY = 'ph_link_survey_submissions';
const SURVEY_QNA_KEY = 'ph_link_survey_qna';

// Initialize storage with mock data if empty
export const initStorage = () => {
  // Event/applications/QnA storage is no longer used (survey-only app)
  if (!localStorage.getItem(APPLICATIONS_KEY)) {
    localStorage.setItem(APPLICATIONS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(QNA_KEY)) {
    localStorage.setItem(QNA_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(SURVEYS_KEY)) {
    localStorage.setItem(SURVEYS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(SURVEY_SUBMISSIONS_KEY)) {
    localStorage.setItem(SURVEY_SUBMISSIONS_KEY, JSON.stringify([]));
  }
  if (!localStorage.getItem(SURVEY_QNA_KEY)) {
    localStorage.setItem(SURVEY_QNA_KEY, JSON.stringify([]));
  }
};

// --- Events ---
export const getEvents = (): any[] => {
  return [];
};

export const getEventById = (_id: string): any | undefined => {
  return undefined;
};

export const saveEvent = (_event: any) => {
  return;
};

export const deleteEvent = (_eventId: string) => {
  return;
};

// --- Applications ---
export const getApplications = (): any[] => {
  const data = localStorage.getItem(APPLICATIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveApplication = (app: any) => {
  const apps = getApplications();
  const index = apps.findIndex((a: any) => a.id === app.id);

  if (index >= 0) {
    apps[index] = app;
  } else {
    apps.push(app);
  }
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps));
};

export const updateSessionCapacity = (_eventId: string, _sessionId: string, _paxDelta: number) => {
  return;
};

export const deleteApplication = (appId: string) => {
  const apps = getApplications();
  const newApps = apps.filter((a: any) => a.id !== appId);
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(newApps));
};

export const findApplication = (_agencyId: string, _eventId: string): any | undefined => {
  return undefined;
};

// --- QnA ---
export const getQnAs = (_eventId: string): any[] => {
  return [];
};

export const saveQnA = (_qna: any) => {
  return;
};

export const deleteQnA = (_id: string) => {
  return;
};

// --- Survey QnA ---
export const getSurveyQnAs = (surveyId: string): SurveyQnAPost[] => {
  const data = localStorage.getItem(SURVEY_QNA_KEY);
  const allQnAs: SurveyQnAPost[] = data ? JSON.parse(data) : [];
  return allQnAs.filter(q => q.surveyId === surveyId).sort((a, b) => b.createdAt - a.createdAt);
};

export const saveSurveyQnA = (qna: SurveyQnAPost) => {
  const data = localStorage.getItem(SURVEY_QNA_KEY);
  const allQnAs: SurveyQnAPost[] = data ? JSON.parse(data) : [];
  const index = allQnAs.findIndex(q => q.id === qna.id);

  if (index >= 0) {
    allQnAs[index] = qna;
  } else {
    allQnAs.push(qna);
  }
  localStorage.setItem(SURVEY_QNA_KEY, JSON.stringify(allQnAs));
};

export const deleteSurveyQnA = (id: string) => {
  const data = localStorage.getItem(SURVEY_QNA_KEY);
  let allQnAs: SurveyQnAPost[] = data ? JSON.parse(data) : [];
  allQnAs = allQnAs.filter(q => q.id !== id);
  localStorage.setItem(SURVEY_QNA_KEY, JSON.stringify(allQnAs));
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalDateTimeInputValue = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// --- Surveys (Data Collection) ---
export const getSurveys = (): Survey[] => {
  const data = localStorage.getItem(SURVEYS_KEY);
  const surveys: Survey[] = data ? JSON.parse(data) : [];
  return surveys.map((s: any) => {
    if (s.startAt && s.endAt) return s;

    const createdAt = typeof s.createdAt === 'number' ? s.createdAt : Date.now();
    const startAt = toLocalDateTimeInputValue(new Date(createdAt));

    if (s.deadline) {
      const endAt = `${s.deadline}T23:59`;
      return { ...s, startAt, endAt };
    }

    const endAt = startAt;
    return { ...s, startAt, endAt };
  });
};

export const getSurveyById = (id: string): Survey | undefined => {
  const surveys = getSurveys();
  return surveys.find(s => s.id === id);
};

export const saveSurvey = (survey: Survey) => {
  const surveys = getSurveys();
  const index = surveys.findIndex(s => s.id === survey.id);
  if (index >= 0) {
    surveys[index] = survey;
  } else {
    surveys.unshift(survey);
  }
  localStorage.setItem(SURVEYS_KEY, JSON.stringify(surveys));
};

export const deleteSurvey = (surveyId: string) => {
  const surveys = getSurveys().filter(s => s.id !== surveyId);
  localStorage.setItem(SURVEYS_KEY, JSON.stringify(surveys));

  const data = localStorage.getItem(SURVEY_SUBMISSIONS_KEY);
  const allSubs: SurveySubmission[] = data ? JSON.parse(data) : [];
  const remainingSubs = allSubs.filter(s => s.surveyId !== surveyId);
  localStorage.setItem(SURVEY_SUBMISSIONS_KEY, JSON.stringify(remainingSubs));

  const qnaData = localStorage.getItem(SURVEY_QNA_KEY);
  const allQnAs: SurveyQnAPost[] = qnaData ? JSON.parse(qnaData) : [];
  const remainingQnAs = allQnAs.filter(q => q.surveyId !== surveyId);
  localStorage.setItem(SURVEY_QNA_KEY, JSON.stringify(remainingQnAs));
};

export const getSurveySubmissions = (surveyId: string): SurveySubmission[] => {
  const data = localStorage.getItem(SURVEY_SUBMISSIONS_KEY);
  const allSubs: SurveySubmission[] = data ? JSON.parse(data) : [];
  return allSubs.filter(s => s.surveyId === surveyId);
};

export const saveSurveySubmission = (submission: SurveySubmission) => {
  const data = localStorage.getItem(SURVEY_SUBMISSIONS_KEY);
  const allSubs: SurveySubmission[] = data ? JSON.parse(data) : [];
  // Check if existing submission for this agency/survey combo (optional logic, allowing overwrite for now)
  const existingIndex = allSubs.findIndex(s => s.surveyId === submission.surveyId && s.agencyId === submission.agencyId);
  
  if (existingIndex >= 0) {
    allSubs[existingIndex] = submission;
  } else {
    allSubs.push(submission);
  }
  localStorage.setItem(SURVEY_SUBMISSIONS_KEY, JSON.stringify(allSubs));
};

export const hasAgencySubmittedSurvey = (surveyId: string, agencyId: string): boolean => {
  const subs = getSurveySubmissions(surveyId);
  return subs.some(s => s.agencyId === agencyId);
};
