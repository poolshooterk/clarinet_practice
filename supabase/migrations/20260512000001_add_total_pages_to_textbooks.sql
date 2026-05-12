alter table textbooks
  add column total_pages integer check (total_pages > 0);
