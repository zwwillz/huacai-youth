with phase_defs(code,phase_number,title,sort_order) as (
  values
    ('qualifier-one','01','资格赛第一场',1),
    ('qualifier-two','02','资格赛第二场',2),
    ('main-one','03','正赛第一阶段',3),
    ('main-two','04','正赛第二阶段',4)
)
insert into public.event_phases (id,event_id,code,phase_number,title,date_label,status,sort_order,created_at,updated_at)
select 'phase_' || md5(e.id || '|' || p.code), e.id, p.code, p.phase_number, p.title, null, 'pending', p.sort_order, now()::text, now()::text
from public.events e cross join phase_defs p
on conflict (event_id,code) do update set
  phase_number=excluded.phase_number,
  title=excluded.title,
  sort_order=excluded.sort_order,
  updated_at=excluded.updated_at;
