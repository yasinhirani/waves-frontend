import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000
});

// Normalise every failure into an Error with a readable message + status.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isCancel(err)) return Promise.reject(err);
    const message =
      err.response?.data?.message ||
      (err.code === 'ECONNABORTED' ? 'The request timed out' : null) ||
      (err.request && !err.response ? 'Cannot reach the server' : null) ||
      err.message ||
      'Something went wrong';
    const error = new Error(message);
    error.status = err.response?.status;
    return Promise.reject(error);
  }
);
