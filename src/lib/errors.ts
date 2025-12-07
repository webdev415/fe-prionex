/**
 * Error Handling Utilities
 *
 * Centralized error handling functions for consistent error management.
 */

import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * Get a user-friendly error message from an error object
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Handle Axios errors
    const axiosError = error as AxiosError<{ detail?: string; message?: string }>

    if (axiosError.response?.data) {
      // Try to get error message from response
      const data = axiosError.response.data
      if (typeof data === 'string') return data
      if (data.detail) return data.detail
      if (data.message) return data.message
    }

    // Network errors
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.'
    }
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection.'
    }

    // HTTP status errors
    if (axiosError.response?.status === 401) {
      return 'Unauthorized. Please log in again.'
    }
    if (axiosError.response?.status === 403) {
      return 'Access denied. You do not have permission to perform this action.'
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found.'
    }
    if (axiosError.response?.status === 500) {
      return 'Server error. Please try again later.'
    }

    return axiosError.message || 'An error occurred while processing your request.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'An unexpected error occurred'
}

/**
 * Type guard to check if error is an Axios error
 */
export function isApiError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error)
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatus(error: unknown): number | null {
  if (isApiError(error) && error.response) {
    return error.response.status
  }
  return null
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED'
  }
  return false
}
