-- Local development only: two fake users so you can try both roles.
-- Switch roles by changing DEV_AUTH_EMAIL in .dev.vars and restarting `npm run dev`.
INSERT OR IGNORE INTO users (email, role) VALUES ('parent@example.com', 'parent');
INSERT OR IGNORE INTO users (email, role) VALUES ('child@example.com', 'child');
