insert into instrument_models (maker_id, name)
select id, 'YCL-450' from instrument_makers where name = 'Yamaha'
on conflict (maker_id, name) do nothing;
