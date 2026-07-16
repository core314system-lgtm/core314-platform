-- Allow the AI quote-compliance pipeline to log its gap notifications.
-- analyze-quote inserts sow_communications rows with
-- comm_type = 'compliance_gap_notification'; without this value the insert
-- silently violates the check constraint and the notification is never logged.
ALTER TABLE public.sow_communications
  DROP CONSTRAINT IF EXISTS sow_communications_comm_type_check;

ALTER TABLE public.sow_communications
  ADD CONSTRAINT sow_communications_comm_type_check CHECK (
    comm_type = ANY (ARRAY[
      'rfq_sent'::text,
      'question'::text,
      'response'::text,
      'follow_up'::text,
      'quote_received'::text,
      'clarification'::text,
      'award_notice'::text,
      'decline_notice'::text,
      'note'::text,
      'compliance_gap_notification'::text
    ])
  );
