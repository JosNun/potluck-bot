import * as chrono from 'chrono-node';
import { createBotLogger } from './logger';

const logger = createBotLogger();

export interface ParsedEventDate {
  startTime: Date;
  endTime: Date;
  originalInput: string;
  wasAmbiguous: boolean;
  parseMethod: 'chrono' | 'native' | 'default';
}

export interface DateParseOptions {
  defaultHour?: number; // Default hour if no time specified (24-hour format)
  defaultDurationHours?: number; // Default event duration in hours
  referenceDate?: Date; // Reference date for parsing relative dates
  futureBias?: boolean; // Prefer future dates when ambiguous
}

const DEFAULT_OPTIONS: Required<DateParseOptions> = {
  defaultHour: 18, // 6 PM default for events
  defaultDurationHours: 3, // 3-hour default duration
  referenceDate: new Date(),
  futureBias: true,
};

/**
 * Parses a date string using natural language processing and returns event start/end times
 */
export function parseEventDate(
  dateInput: string, 
  options: DateParseOptions = {}
): ParsedEventDate | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!dateInput || typeof dateInput !== 'string') {
    return null;
  }

  const trimmedInput = dateInput.trim();
  if (!trimmedInput) {
    return null;
  }

  logger.info({ 
    dateInput: trimmedInput, 
    options: opts 
  }, 'Attempting to parse date string');

  // Try Chrono.js first for natural language parsing
  try {
    const chronoResults = chrono.parse(trimmedInput, opts.referenceDate, {
      forwardDate: opts.futureBias,
    });

    if (chronoResults.length > 0) {
      const result = chronoResults[0];
      if (result && result.start) {
        const startDate = result.start.date();
        
        // If no time was specified, set to default hour
        if (!result.start.isCertain('hour')) {
          startDate.setHours(opts.defaultHour, 0, 0, 0);
        }

        // Calculate end time
        let endDate: Date;
        if (result.end) {
          endDate = result.end.date();
        } else {
          endDate = new Date(startDate.getTime() + (opts.defaultDurationHours * 60 * 60 * 1000));
        }

        // Validate the parsed date is reasonable
        if (isValidEventDate(startDate)) {
          logger.info({
            originalInput: trimmedInput,
            parsedStart: startDate.toISOString(),
            parsedEnd: endDate.toISOString(),
            method: 'chrono'
          }, 'Successfully parsed date with Chrono.js');

          return {
            startTime: startDate,
            endTime: endDate,
            originalInput: trimmedInput,
            wasAmbiguous: !result.start.isCertain('year') || !result.start.isCertain('month'),
            parseMethod: 'chrono',
          };
        }
      }
    }
  } catch (error) {
    logger.warn({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      dateInput: trimmedInput 
    }, 'Chrono.js parsing failed');
  }

  // Fallback to native Date parsing
  try {
    const nativeDate = new Date(trimmedInput);
    
    if (!isNaN(nativeDate.getTime()) && isValidEventDate(nativeDate)) {
      // If only date was provided (time is midnight), set to default hour
      if (nativeDate.getHours() === 0 && nativeDate.getMinutes() === 0) {
        nativeDate.setHours(opts.defaultHour, 0, 0, 0);
      }

      const endDate = new Date(nativeDate.getTime() + (opts.defaultDurationHours * 60 * 60 * 1000));

      logger.info({
        originalInput: trimmedInput,
        parsedStart: nativeDate.toISOString(),
        parsedEnd: endDate.toISOString(),
        method: 'native'
      }, 'Successfully parsed date with native Date constructor');

      return {
        startTime: nativeDate,
        endTime: endDate,
        originalInput: trimmedInput,
        wasAmbiguous: false,
        parseMethod: 'native',
      };
    }
  } catch (error) {
    logger.warn({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      dateInput: trimmedInput 
    }, 'Native Date parsing failed');
  }

  logger.warn({ dateInput: trimmedInput }, 'Failed to parse date string');
  return null;
}

/**
 * Creates default event times (2 hours from now, 3-hour duration)
 */
export function createDefaultEventTimes(options: DateParseOptions = {}): ParsedEventDate {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = opts.referenceDate;
  
  // Default to 2 hours from now
  const startTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  const endTime = new Date(startTime.getTime() + (opts.defaultDurationHours * 60 * 60 * 1000));

  return {
    startTime,
    endTime,
    originalInput: '',
    wasAmbiguous: false,
    parseMethod: 'default',
  };
}

/**
 * Validates that a date is reasonable for an event
 */
function isValidEventDate(date: Date): boolean {
  const now = new Date();
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  // Date should be within reasonable bounds
  if (date < oneYearAgo || date > oneYearFromNow) {
    return false;
  }

  // Date should not be NaN
  if (isNaN(date.getTime())) {
    return false;
  }

  return true;
}

/**
 * Formats a date for user-friendly display
 */
export function formatEventDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Gets example date formats for user guidance
 */
export function getDateExamples(): string[] {
  return [
    'Saturday at 6pm',
    'next Friday at 7:30pm', 
    'December 14th at 6pm',
    'tomorrow evening',
    '2024-12-14 18:00',
    'in 3 days at 5pm',
  ];
}

/**
 * Parses a date string specifically for potluck events with smart defaults
 */
export function parsePotluckEventDate(
  dateInput: string | undefined,
  options: DateParseOptions = {}
): ParsedEventDate {
  if (!dateInput) {
    return createDefaultEventTimes(options);
  }

  const parsed = parseEventDate(dateInput, {
    defaultHour: 18, // Evening events are common for potlucks
    defaultDurationHours: 3, // Typical potluck duration
    futureBias: true, // Always prefer future dates
    ...options,
  });

  if (parsed) {
    return parsed;
  }

  // If parsing failed completely, return defaults but log the attempt
  logger.info({ 
    dateInput, 
    fallback: 'default_times' 
  }, 'Date parsing failed, using default event times');

  return createDefaultEventTimes(options);
}