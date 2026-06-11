alter table purchase_orders add column if not exists qbd_push_pending boolean not null default false;
