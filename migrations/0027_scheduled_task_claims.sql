-- Una consegna concorrente non esegue lo stesso compito mentre il consumer ha il turno.
ALTER TABLE scheduled_tasks ADD COLUMN lease TEXT;
ALTER TABLE scheduled_tasks ADD COLUMN locked_until TEXT;
