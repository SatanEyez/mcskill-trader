-- Жалобы на игроков убраны из формы обращений: тип 'player' больше не поддерживается.
-- Существующие обращения этого типа сохраняем, переводя их в 'other'.
UPDATE support_tickets
   SET kind = 'other'
 WHERE kind = 'player';

-- TiDB не хранит CHECK-ограничения, поэтому DROP CHECK там упадёт с ошибкой 1091.
-- @tidb: skip
ALTER TABLE support_tickets DROP CHECK support_tickets_kind_check;

-- @tidb: skip
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_kind_check
  CHECK (kind IN ('item', 'price', 'error', 'other'));
