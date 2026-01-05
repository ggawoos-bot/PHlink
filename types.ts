export interface Agency {
  id: string;
  name: string;
  region: string;
  regionCode?: string;
  regionLong?: string;
  orgCode?: string;
  orgName?: string;
  orgType?: string;
}

export interface SurveyQnAPost {
  id: string;
  surveyId: string;
  authorName: string;
  password: string;
  question: string;
  answer?: string;
  answeredAt?: number;
  createdAt: number;
}

// Survey / Data Collection Types
export type SurveyFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect';

export interface SurveyField {
  id: string;
  label: string; // e.g., "금연상담사 수"
  type: SurveyFieldType; // Data type
  required: boolean;
  options?: string[]; // For select and multiselect types
  description?: string; // Optional help text
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  host: string; // Requesting Agency/Dept
  deadline?: string; // YYYY-MM-DD (legacy)
  startAt: string; // YYYY-MM-DDTHH:mm (local)
  endAt: string; // YYYY-MM-DDTHH:mm (local)
  fields: SurveyField[];
  status: 'OPEN' | 'CLOSED';
  createdAt: number;
}

export interface SurveySubmission {
  id: string;
  surveyId: string;
  agencyId: string;
  agencyName: string;
  data: Record<string, any>; // Changed to any to support arrays (multiselect)
  submittedAt: number;
}