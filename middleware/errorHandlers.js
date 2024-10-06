// Middleware for 404 Not Found
export const notFoundHandler = (req, res, next) => {
    res.status(404).render('error', { 
      message: 'Oops! Page not found', 
      errorCode: '404' 
    });
  };
  
  // Global error handler for 500 Internal Server Error
  export const globalErrorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
      message: 'Internal Server Error', 
      errorCode: '500' 
    });
  };
  