-- Жалобы на игроков убраны из формы обращений: тип 'player' больше не поддерживается.
-- Существующие обращения этого типа сохраняем, переводя их в 'other'.

UPDATE support_tickets
SET kind = 'other'
WHERE kind = 'player';

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_kind_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_kind_check
  CHECK (kind IN ('item', 'price', 'error', 'other'));
