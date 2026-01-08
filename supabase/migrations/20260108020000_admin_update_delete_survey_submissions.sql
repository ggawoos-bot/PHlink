alter table if exists phlink.survey_submissions enable row level security;

grant update, delete on table phlink.survey_submissions to authenticated;

-- Admins can update submissions
DROP POLICY IF EXISTS "admin_update_survey_submissions" ON phlink.survey_submissions;
CREATE POLICY "admin_update_survey_submissions"
ON phlink.survey_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM core.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM core.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  )
);

-- Admins can delete submissions
DROP POLICY IF EXISTS "admin_delete_survey_submissions" ON phlink.survey_submissions;
CREATE POLICY "admin_delete_survey_submissions"
ON phlink.survey_submissions
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM core.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  )
);
