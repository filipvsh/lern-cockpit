-- Lern-Cockpit · 007 Push-Erinnerungen: Zeitplan für die Edge Function „push-reminder“
-- Ruft die Funktion alle 15 Minuten auf. Sie entscheidet selbst, ob gerade eine
-- Erinnerung fällig ist (Uhrzeit Berlin, je Tag und Art höchstens einmal, nachts nie).
-- Ändert keine Tabellen. Mehrfach ausführbar. Vorher die Funktion deployen (docs/PUSH.md).
-- Der Schlüssel unten ist der öffentliche anon-Schlüssel der App (steht auch in index.html).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'lern-cockpit-push';
select cron.schedule(
  'lern-cockpit-push',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://tafksekafwihvrwxxzdh.supabase.co/functions/v1/push-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZmtzZWthZndpaHZyd3h4emRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjYxNjAsImV4cCI6MjEwMzk0MjE2MH0.25GTHOHZikQAIKkk7SCtBLHyc3fX9KWMNC6RBFJ0dXQ'),
    body := '{"mode":"run"}'::jsonb
  );
  $$
);

-- Prüfen: select * from cron.job_run_details order by start_time desc limit 5;
-- Ausschalten: select cron.unschedule('lern-cockpit-push');
