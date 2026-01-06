import { supabase } from './supabaseClient';
import { SurveyTemplate, SurveyField } from '../types';

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  fields: any;
  created_at: string;
  updated_at: string;
};

const mapTemplateRowToTemplate = (row: TemplateRow): SurveyTemplate => {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    fields: Array.isArray(row.fields) ? row.fields : [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
};

export const listTemplates = async (): Promise<SurveyTemplate[]> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('survey_templates')
    .select('id,name,description,fields,created_at,updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r: any) => mapTemplateRowToTemplate(r as TemplateRow));
};

export const getTemplate = async (id: string): Promise<SurveyTemplate | null> => {
  const { data, error } = await supabase
    .schema('phlink')
    .from('survey_templates')
    .select('id,name,description,fields,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapTemplateRowToTemplate(data as any);
};

export const upsertTemplate = async (template: SurveyTemplate): Promise<void> => {
  const now = new Date().toISOString();
  const payload: any = {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    fields: template.fields ?? [],
    created_at: new Date(template.createdAt).toISOString(),
    updated_at: now,
  };

  const { error } = await supabase
    .schema('phlink')
    .from('survey_templates')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
};

export const deleteTemplateById = async (templateId: string): Promise<void> => {
  const { error } = await supabase
    .schema('phlink')
    .from('survey_templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;
};
