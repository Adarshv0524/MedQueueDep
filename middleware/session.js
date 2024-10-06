import session from 'express-session';

export const sessionMiddleware = session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
});
