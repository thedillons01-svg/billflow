-- Add QBD Web Connector fields to companies
alter table companies
  add column if not exists qbd_service_key text unique;
