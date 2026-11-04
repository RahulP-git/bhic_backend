export const successResponse = (res, data = null, status = 200) => {
  res.status(status).json({
    success: true,
    data,
    serverTimestamp: new Date().toISOString(),
    requestId: res.getHeader("x-request-id"),
  });
};

export const errorResponse = (res, error) => {
  res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.status ? error.message : "Unexpected server error",
      ...(error.details ? { details: error.details } : {}),
    },
    requestId: res.getHeader("x-request-id"),
  });
};

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
