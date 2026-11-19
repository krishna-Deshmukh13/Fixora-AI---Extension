-- Fixora AI Sample Test File: SQL
-- Demonstrates query anti-patterns and performance risks

-- Issue 1: Unindexed query with wildcards without LIMIT
SELECT * FROM audit_logs WHERE log_message LIKE '%error%';

-- Issue 2: Mixing implicit and explicit JOIN styles
SELECT u.username, o.order_id
FROM users u, orders o
WHERE u.id = o.user_id AND o.amount > 100;
