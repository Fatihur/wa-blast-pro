import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler.js';

// Validation result handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    throw new ValidationError(errorMessages);
  }
  next();
};

// Auth validators
export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2-255 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  handleValidationErrors
];

export const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  handleValidationErrors
];

export const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  handleValidationErrors
];

export const resetPasswordValidator = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  handleValidationErrors
];

// Contact validators
export const createContactValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 255 }).withMessage('Name too long'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .matches(/^[\d+\-\s()]+$/).withMessage('Invalid phone format'),
  
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
  
  handleValidationErrors
];

// Blast job validators
export const createBlastJobValidator = [
  body('message_type')
    .optional()
    .isIn(['TEXT', 'IMAGE', 'DOCUMENT', 'POLL', 'LOCATION'])
    .withMessage('Invalid message type'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ max: 4096 }).withMessage('Content too long'),
  
  body('delay_ms')
    .optional()
    .isInt({ min: 1000, max: 60000 })
    .withMessage('Delay must be between 1-60 seconds'),
  
  body('scheduled_at')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const scheduledDate = new Date(value);
      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors
];

// WhatsApp message validators
export const sendMessageValidator = [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[\d+]+$/).withMessage('Invalid phone format'),
  
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required')
    .isLength({ max: 4096 }).withMessage('Message too long'),
  
  body('type')
    .optional()
    .isIn(['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'])
    .withMessage('Invalid message type'),
  
  handleValidationErrors
];

export const sendPollValidator = [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required'),
  
  body('question')
    .trim()
    .notEmpty().withMessage('Poll question is required')
    .isLength({ max: 255 }).withMessage('Question too long'),
  
  body('options')
    .isArray({ min: 2, max: 12 }).withMessage('Poll must have 2-12 options')
    .custom((options) => {
      if (options.some((opt: string) => !opt || opt.trim().length === 0)) {
        throw new Error('All poll options must be non-empty');
      }
      return true;
    }),
  
  body('allowMultiple')
    .optional()
    .isBoolean().withMessage('allowMultiple must be boolean'),
  
  handleValidationErrors
];

export const sendLocationValidator = [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required'),
  
  body('latitude')
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  
  body('longitude')
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Description too long'),
  
  handleValidationErrors
];

// Param validators
export const idValidator = [
  param('id')
    .trim()
    .notEmpty().withMessage('ID is required')
    .isUUID().withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Query validators
export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  
  handleValidationErrors
];

export default {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  createContactValidator,
  createBlastJobValidator,
  sendMessageValidator,
  sendPollValidator,
  sendLocationValidator,
  idValidator,
  paginationValidator,
  handleValidationErrors
};
