update public.events
set registration_state = case
  when status = 'registration_open' then 'open'
  when status = 'registration_closed' then 'closed'
  else registration_state
end
where registration_state = 'not_open'
  and status in ('registration_open', 'registration_closed');
