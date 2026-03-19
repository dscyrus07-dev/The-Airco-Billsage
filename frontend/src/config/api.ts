// Re-export from centralized API endpoints
export { API_ENDPOINTS } from '@/api/endpoints';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export default API_BASE_URL;
