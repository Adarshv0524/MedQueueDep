export const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
      next();
    } else {
      res.redirect('/login');
    }
  };
  
  export const isAdminAuthenticated = (req, res, next) => {
    if (req.session.adminId) {
      next();
    } else {
      res.redirect('/admin'); // Redirect to admin login page
    }
  };
  