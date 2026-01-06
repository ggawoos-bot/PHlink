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
export type SurveyFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'table';

export interface TableColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  options?: string[]; // For select type
  width?: number; // Column width in pixels
}

export interface TableRow {
  id: string;
  data: Record<string, any>; // columnId -> value
}

export interface SurveyField {
  id: string;
  label: string; // e.g., "금연상담사 수"
  type: SurveyFieldType; // Data type
  required: boolean;
  options?: string[]; // For select and multiselect types
  description?: string; // Optional help text
  columns?: TableColumn[]; // For table type
  minRows?: number; // Minimum rows for table
  maxRows?: number; // Maximum rows for table
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

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  fields: SurveyField[];
  createdAt: number;
  updatedAt: number;
}