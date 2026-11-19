-- Sample SQL file with deliberate security & performance risks for Fixora AI testing

-- BUG 1: Unsanitized concatenation / SQL Injection vulnerability
SELECT * FROM users WHERE username = 'admin' AND password = '' OR '1'='1';

-- BUG 2: Inefficient SELECT * without WHERE clause on high-volume table
SELECT * FROM audit_logs;

-- BUG 3: Cartesian product / Missing JOIN condition
SELECT u.name, o.total 
FROM users u, orders o;
