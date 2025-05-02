import { supabase } from './supabase';

export interface ResponseTimeMetrics {
  averageResponseTime: number; // in milliseconds
  percentageChange: number; // compared to previous period
  count: number; // number of responses analyzed
}

export interface ResponseTimeDataPoint {
  name: string;
  time: number;
}

export interface TimeSavedMetrics {
  hours: number;
  minutes: number;
  messageCount: number;
}

interface Message {
  id: string;
  created_at: string;
  sender_type: 'user' | 'bot' | 'agent';
  conversation_id: string;
  content: string;
}

export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Calculate the average response time for messages
 * This calculates how long it takes to respond to user messages on average
 */
export async function calculateResponseTimes(timeRange: TimeRange, businessId?: string): Promise<ResponseTimeMetrics> {
  try {
    // Get the date range for the current period
    const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = getDateRangeForPeriod(timeRange);
    
    // First, if we have a business ID, fetch conversations for that business
    let conversationFilter: string[] = [];
    if (businessId) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('business_id', businessId);
      
      if (convError) {
        console.error('Error fetching conversations for business:', convError);
      } else if (conversations && conversations.length > 0) {
        conversationFilter = conversations.map((conv: { id: string }) => conv.id);
      }
    }
    
    // Get all messages for the current time range
    const { data: currentMessagesAll, error: currentMessagesError } = await fetchMessages(
      currentStartDate, 
      currentEndDate
    );
    
    if (currentMessagesError) {
      console.error('Error fetching current messages:', currentMessagesError);
      return { averageResponseTime: 0, percentageChange: 0, count: 0 };
    }
    
    // Filter messages by conversation_id if we have a business filter
    const currentMessages = businessId && conversationFilter.length > 0
      ? currentMessagesAll?.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
      : currentMessagesAll;
    
    // Store the currently processed messages for reference by other functions
    // This helps ensure consistency between different analytics calculations
    storeCurrentMessages(timeRange, currentMessages || []);
    
    // Get all messages for the previous time range (for comparison)
    const { data: previousMessagesAll, error: previousMessagesError } = await fetchMessages(
      previousStartDate, 
      previousEndDate
    );
    
    // Filter messages by conversation_id if we have a business filter
    const previousMessages = businessId && conversationFilter.length > 0
      ? previousMessagesAll?.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
      : previousMessagesAll;
    
    if (previousMessagesError) {
      console.error('Error fetching previous messages:', previousMessagesError);
      // Still continue with current data, just won't have comparison
    }
    
    // 3. Calculate current period response time
    const currentMetrics = calculateAverageResponseTimeFromMessages(currentMessages || []);
    
    // 4. Calculate previous period response time (for comparison)
    const previousMetrics = calculateAverageResponseTimeFromMessages(previousMessages || []);
    
    // 5. Calculate percentage change
    let percentageChange = 0;
    if (previousMetrics.averageResponseTime > 0) {
      percentageChange = ((currentMetrics.averageResponseTime - previousMetrics.averageResponseTime) 
        / previousMetrics.averageResponseTime) * 100;
    }
    
    return {
      averageResponseTime: currentMetrics.averageResponseTime,
      percentageChange: parseFloat(percentageChange.toFixed(1)),
      count: currentMetrics.count
    };
  } catch (error) {
    console.error('Error calculating response times:', error);
    return { averageResponseTime: 0, percentageChange: 0, count: 0 };
  }
}

// Cache to store processed messages by time range to ensure consistency
const processedMessagesCache: Record<TimeRange, Message[]> = {
  daily: [],
  weekly: [],
  monthly: [],
  yearly: []
};

// Store the currently processed messages for reference
function storeCurrentMessages(timeRange: TimeRange, messages: Message[]) {
  processedMessagesCache[timeRange] = messages;
}

// Retrieve previously processed messages
function getProcessedMessages(timeRange: TimeRange): Message[] {
  return processedMessagesCache[timeRange];
}

/**
 * Get messages from Supabase within a specific date range
 */
async function fetchMessages(startDate: Date, endDate: Date, businessId?: string) {
  const query = supabase
    .from('messages')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });
  
  // Note: business_id doesn't exist in the messages table
  // Instead, we need to filter messages by conversations that belong to the business
  // This needs to be done after fetching the data
  
  return await query;
}

/**
 * Calculate average response time from a list of messages
 * This pairs user messages with the next bot message to calculate response time
 * Only considers responses from the bot, not manual agent responses
 */
function calculateAverageResponseTimeFromMessages(messages: Message[]) {
  const responseTimes: number[] = [];
  
  // Group messages by conversation
  const conversationMessages: Record<string, Message[]> = {};
  
  messages.forEach((message: Message) => {
    if (!conversationMessages[message.conversation_id]) {
      conversationMessages[message.conversation_id] = [];
    }
    conversationMessages[message.conversation_id].push(message);
  });
  
  // For each conversation, calculate response times
  Object.values(conversationMessages).forEach(conversationMsgs => {
    // Sort by created_at time
    conversationMsgs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Find pairs of user -> bot messages (excluding agent/manual messages)
    for (let i = 0; i < conversationMsgs.length - 1; i++) {
      const currentMsg = conversationMsgs[i];
      const nextMsg = conversationMsgs[i + 1];
      
      // If current is from user and next is from bot (not agent)
      if (currentMsg.sender_type === 'user' && nextMsg.sender_type === 'bot') {
        
        const userMessageTime = new Date(currentMsg.created_at).getTime();
        const responseTime = new Date(nextMsg.created_at).getTime();
        const timeDifference = responseTime - userMessageTime;
        
        // Only count if response was within 24 hours (to filter out abandoned conversations)
        if (timeDifference > 0 && timeDifference < 24 * 60 * 60 * 1000) {
          responseTimes.push(timeDifference);
        }
      }
    }
  });
  
  // Get bot messages for counting - use the same logic as in calculateTimeSaved
  const botMessages = messages.filter(
    (msg: Message) => msg.sender_type === 'bot'
  );
  
  // Calculate average
  const count = botMessages.length; // Use the total count of bot messages
  
  // Only calculate average if we have response times
  const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
  const averageTime = responseTimes.length > 0 ? totalTime / responseTimes.length : 0;
  
  return {
    averageResponseTime: averageTime,
    count // Return the count of all bot messages
  };
}

/**
 * Calculate date ranges for different time periods with proportional comparison
 */
function getDateRangeForPeriod(timeRange: TimeRange) {
  const now = new Date();
  let currentStartDate: Date;
  let currentEndDate: Date = now;
  let previousStartDate: Date;
  let previousEndDate: Date;
  
  switch (timeRange) {
    case 'daily':
      // Current: Today from 00:00 until now
      currentStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      
      // Determine how many hours have passed today
      const hoursPassedToday = (now.getTime() - currentStartDate.getTime()) / (60 * 60 * 1000);
      
      // Previous: Yesterday, same time range (same hour count)
      previousEndDate = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate() - 1);
      previousEndDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      previousStartDate = new Date(previousEndDate.getFullYear(), previousEndDate.getMonth(), previousEndDate.getDate(), 0, 0, 0);
      break;
      
    case 'weekly':
      // Current: From 7 days ago until now
      currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Calculate days passed in current week
      const daysPassed = Math.ceil((now.getTime() - currentStartDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Previous: Same number of days in previous week
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - (daysPassed * 24 * 60 * 60 * 1000) + 1);
      break;
      
    case 'monthly':
      // Current: From 30 days ago until now
      currentStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Calculate days passed in current month
      const daysPassedMonth = Math.ceil((now.getTime() - currentStartDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Previous: Same number of days in previous month
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - (daysPassedMonth * 24 * 60 * 60 * 1000) + 1);
      break;
      
    case 'yearly':
      // Current: From 365 days ago until now
      currentStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      
      // Calculate days passed in current year
      const daysPassedYear = Math.ceil((now.getTime() - currentStartDate.getTime()) / (24 * 60 * 60 * 1000));
      
      // Previous: Same number of days in previous year
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - (daysPassedYear * 24 * 60 * 60 * 1000) + 1);
      break;
      
    default:
      // Default to weekly
      currentStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEndDate = new Date(currentStartDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
  }
  
  return {
    currentStartDate,
    currentEndDate,
    previousStartDate,
    previousEndDate
  };
}

/**
 * Format milliseconds to a human-readable format (e.g., "14 min")
 */
export function formatResponseTime(milliseconds: number): string {
  if (milliseconds < 60000) { // Less than a minute
    return `${Math.round(milliseconds / 1000)} seg`;
  } else if (milliseconds < 3600000) { // Less than an hour
    return `${Math.round(milliseconds / 60000)} min`;
  } else if (milliseconds < 86400000) { // Less than a day
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.round((milliseconds % 3600000) / 60000);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else { // Days or more
    const days = Math.round(milliseconds / 86400000);
    return `${days}d`;
  }
}

/**
 * Fetch historical response time data for charting
 * Returns data formatted for charts based on time range
 */
export async function fetchResponseTimeHistory(
  timeRange: TimeRange, 
  businessId?: string
): Promise<ResponseTimeDataPoint[]> {
  try {
    const { startDate, endDate, interval, format } = getHistoricalTimeRange(timeRange);
    
    // First, if we have a business ID, fetch conversations for that business
    let conversationFilter: string[] = [];
    if (businessId) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('business_id', businessId);
      
      if (convError) {
        console.error('Error fetching conversations for business:', convError);
      } else if (conversations && conversations.length > 0) {
        conversationFilter = conversations.map((conv: { id: string }) => conv.id);
      }
    }
    
    // 1. Get all messages between the start and end date
    const { data: allMessages, error } = await fetchMessages(startDate, endDate);
    
    if (error) {
      console.error('Error fetching messages for historical data:', error);
      return [];
    }
    
    if (!allMessages || allMessages.length === 0) {
      return [];
    }
    
    // Filter messages by conversation_id if we have a business filter
    const messages = businessId && conversationFilter.length > 0
      ? allMessages.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
      : allMessages;
    
    // 2. Group messages by conversation
    const conversationMessages: Record<string, Message[]> = {};
    
    messages.forEach((message: Message) => {
      if (!conversationMessages[message.conversation_id]) {
        conversationMessages[message.conversation_id] = [];
      }
      conversationMessages[message.conversation_id].push(message);
    });
    
    // 3. Calculate response times for each conversation
    interface ResponseData {
      timestamps: Record<string, number[]>;
    }
    
    const responseData: ResponseData = {
      timestamps: {},
    };
    
    // Calculate response times and group by timestamp
    Object.values(conversationMessages).forEach(convMessages => {
      // Sort by timestamp
      convMessages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // Calculate response times between user and bot/agent messages
      for (let i = 0; i < convMessages.length - 1; i++) {
        const currentMsg = convMessages[i];
        const nextMsg = convMessages[i + 1];
        
        if (currentMsg.sender_type === 'user' && 
            (nextMsg.sender_type === 'bot' || nextMsg.sender_type === 'agent')) {
          
          const userMessageTime = new Date(currentMsg.created_at);
          const responseTime = new Date(nextMsg.created_at);
          const responseTimeDiff = responseTime.getTime() - userMessageTime.getTime();
          
          // Only include if response was within 24 hours
          if (responseTimeDiff > 0 && responseTimeDiff < 24 * 60 * 60 * 1000) {
            // Format the timestamp based on interval (hourly, daily, weekly, monthly)
            const formattedTimestamp = formatTimestamp(userMessageTime, format);
            
            if (!responseData.timestamps[formattedTimestamp]) {
              responseData.timestamps[formattedTimestamp] = [];
            }
            
            responseData.timestamps[formattedTimestamp].push(responseTimeDiff);
          }
        }
      }
    });
    
    // 4. Create the final dataset for the chart
    const chartData: ResponseTimeDataPoint[] = [];
    
    // Create an array of all possible timestamps in the range
    const allTimestamps = generateTimestampRange(startDate, endDate, interval, format);
    
    // Calculate average for each timestamp
    allTimestamps.forEach(timestamp => {
      const responseTimes = responseData.timestamps[timestamp] || [];
      const average = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;
      
      chartData.push({
        name: timestamp,
        time: average,
      });
    });
    
    return chartData;
  } catch (error) {
    console.error('Error calculating historical response times:', error);
    return [];
  }
}

/**
 * Generate a range of timestamps based on interval
 */
function generateTimestampRange(
  startDate: Date, 
  endDate: Date, 
  interval: 'hour' | 'day' | 'week' | 'month', 
  format: string
): string[] {
  const timestamps: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    timestamps.push(formatTimestamp(current, format));
    
    // Increment based on interval
    switch (interval) {
      case 'hour':
        current.setHours(current.getHours() + 1);
        break;
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }
  
  return timestamps;
}

/**
 * Format a date based on the specified format
 */
function formatTimestamp(date: Date, format: string): string {
  switch (format) {
    case 'HH:00':
      return date.getHours().toString().padStart(2, '0') + ':00';
    case 'ddd':
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    case 'Sem W':
      // Calcular número de semana en el mes (1-5)
      const weekNum = Math.ceil(date.getDate() / 7);
      return `Sem ${weekNum}`;
    case 'MMM':
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return months[date.getMonth()];
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Get date range and format settings for historical time range queries
 */
function getHistoricalTimeRange(timeRange: TimeRange) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let interval: 'hour' | 'day' | 'week' | 'month';
  let format: string;
  
  switch (timeRange) {
    case 'daily':
      // Current day (last 24 hours)
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      interval = 'hour';
      format = 'HH:00'; // Hour format (01:00, 02:00, etc.)
      break;
      
    case 'weekly':
      // Current week (last 7 days)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      interval = 'day';
      format = 'ddd'; // Day format (Lun, Mar, etc.)
      break;
      
    case 'monthly':
      // Current month (last 30 days)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      interval = 'week';
      format = 'Sem W'; // Week format (Sem 1, Sem 2, etc.)
      break;
      
    case 'yearly':
      // Current year (last 12 months)
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      interval = 'month';
      format = 'MMM'; // Month format (Ene, Feb, etc.)
      break;
      
    default:
      // Default to daily
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      interval = 'hour';
      format = 'HH:00';
  }
  
  return { startDate, endDate, interval, format };
}

/**
 * Calculate time saved by bot automation
 * This calculates how much time has been saved by the bot responding instead of humans
 * Assumes each human response would take 1 minute and 35 seconds (95 seconds)
 * Only counts bot messages, not agent messages (which are manual)
 */
export async function calculateTimeSaved(timeRange: TimeRange, businessId?: string): Promise<TimeSavedMetrics> {
  try {
    // Check if we already have processed messages for this time range
    let messages = getProcessedMessages(timeRange);
    
    // If we don't have cached messages, fetch them
    if (messages.length === 0) {
      // Get the date range for the current period
      const { currentStartDate, currentEndDate } = getDateRangeForPeriod(timeRange);
      
      // First, if we have a business ID, fetch conversations for that business
      let conversationFilter: string[] = [];
      if (businessId) {
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('id')
          .eq('business_id', businessId);
        
        if (convError) {
          console.error('Error fetching conversations for business:', convError);
        } else if (conversations && conversations.length > 0) {
          conversationFilter = conversations.map((conv: { id: string }) => conv.id);
        }
      }
      
      // Get all messages for the period
      const { data: allMessages, error: messagesError } = await fetchMessages(
        currentStartDate, 
        currentEndDate
      );
      
      if (messagesError) {
        console.error('Error fetching messages for time saved calculation:', messagesError);
        return { hours: 0, minutes: 0, messageCount: 0 };
      }
      
      // Filter messages by conversation_id if we have a business filter
      messages = businessId && conversationFilter.length > 0
        ? allMessages?.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
        : allMessages || [];
        
      // Store the processed messages for future reference
      storeCurrentMessages(timeRange, messages);
    }
    
    // Count only bot messages (excluding agent/manual messages)
    const botMessages = messages.filter(
      (msg: Message) => msg.sender_type === 'bot'
    );
    
    const messageCount = botMessages.length;
    
    // Calculate time saved (95 seconds per message - 1min 35sec)
    const totalSecondsSaved = messageCount * 95;
    
    // Convert to hours and minutes
    const totalHours = Math.floor(totalSecondsSaved / 3600);
    const totalMinutes = Math.floor((totalSecondsSaved % 3600) / 60);
    
    return {
      hours: totalHours,
      minutes: totalMinutes,
      messageCount
    };
  } catch (error) {
    console.error('Error calculating time saved:', error);
    return { hours: 0, minutes: 0, messageCount: 0 };
  }
}

export interface ConversationMetrics {
  totalCount: number;
  percentageChange: number;
}

/**
 * Calculate conversation statistics for a specific time range
 * This counts all conversations including those that were deleted
 */
export async function calculateConversations(timeRange: TimeRange, businessId?: string): Promise<ConversationMetrics> {
  try {
    // Get the date range for the current period
    const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = getDateRangeForPeriod(timeRange);
    
    // Base query for current period
    let currentQuery = supabase
      .from('conversations')
      .select('id, created_at, business_id')
      .gte('created_at', currentStartDate.toISOString())
      .lte('created_at', currentEndDate.toISOString());
    
    // Add business filter if provided
    if (businessId) {
      currentQuery = currentQuery.eq('business_id', businessId);
    }
    
    // Execute the query
    const { data: currentConversations, error: currentError } = await currentQuery;
    
    if (currentError) {
      console.error('Error fetching current conversations:', currentError);
      return { totalCount: 0, percentageChange: 0 };
    }
    
    // Base query for previous period
    let previousQuery = supabase
      .from('conversations')
      .select('id, created_at, business_id')
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString());
    
    // Add business filter if provided
    if (businessId) {
      previousQuery = previousQuery.eq('business_id', businessId);
    }
    
    // Execute the query
    const { data: previousConversations, error: previousError } = await previousQuery;
    
    if (previousError) {
      console.error('Error fetching previous conversations:', previousError);
      // Still continue with current data, just won't have comparison
    }
    
    // Count conversations
    const currentCount = currentConversations?.length || 0;
    const previousCount = previousConversations?.length || 0;
    
    // Calculate percentage change
    let percentageChange = 0;
    if (previousCount > 0) {
      percentageChange = ((currentCount - previousCount) / previousCount) * 100;
    }
    
    return {
      totalCount: currentCount,
      percentageChange: parseFloat(percentageChange.toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating conversations:', error);
    return { totalCount: 0, percentageChange: 0 };
  }
}

export interface LeadsQualifiedMetrics {
  totalCount: number;
  percentageChange: number;
}

/**
 * Calculate qualified leads (important conversations) for a specific time range
 * This counts conversations marked as important or urgent
 */
export async function calculateQualifiedLeads(timeRange: TimeRange, businessId?: string): Promise<LeadsQualifiedMetrics> {
  try {
    // Get the date range for the current period
    const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = getDateRangeForPeriod(timeRange);
    
    // Base query for current period
    let currentQuery = supabase
      .from('conversations')
      .select('id, created_at, business_id, user_category')
      .gte('created_at', currentStartDate.toISOString())
      .lte('created_at', currentEndDate.toISOString())
      .or('user_category.eq.important,user_category.eq.urgent');
    
    // Add business filter if provided
    if (businessId) {
      currentQuery = currentQuery.eq('business_id', businessId);
    }
    
    // Execute the query
    const { data: currentConversations, error: currentError } = await currentQuery;
    
    if (currentError) {
      console.error('Error fetching current qualified leads:', currentError);
      return { totalCount: 0, percentageChange: 0 };
    }
    
    // Base query for previous period
    let previousQuery = supabase
      .from('conversations')
      .select('id, created_at, business_id, user_category')
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())
      .or('user_category.eq.important,user_category.eq.urgent');
    
    // Add business filter if provided
    if (businessId) {
      previousQuery = previousQuery.eq('business_id', businessId);
    }
    
    // Execute the query
    const { data: previousConversations, error: previousError } = await previousQuery;
    
    if (previousError) {
      console.error('Error fetching previous qualified leads:', previousError);
      // Still continue with current data, just won't have comparison
    }
    
    // Count conversations
    const currentCount = currentConversations?.length || 0;
    const previousCount = previousConversations?.length || 0;
    
    // Calculate percentage change
    let percentageChange = 0;
    if (previousCount > 0) {
      percentageChange = ((currentCount - previousCount) / previousCount) * 100;
    }
    
    return {
      totalCount: currentCount,
      percentageChange: parseFloat(percentageChange.toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating qualified leads:', error);
    return { totalCount: 0, percentageChange: 0 };
  }
}

export interface MessageVolumeDataPoint {
  name: string;
  sent: number;
  received: number;
}

export interface MessageVolumeMetrics {
  data: MessageVolumeDataPoint[];
  totalSent: number;
  totalReceived: number;
  sentPercentageChange: number;
  receivedPercentageChange: number;
}

/**
 * Calculate message volume statistics for a specific time range
 * This counts messages sent and received by period
 */
export async function calculateMessageVolume(timeRange: TimeRange, businessId?: string): Promise<MessageVolumeMetrics> {
  try {
    // Get the date range for the current period
    const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = getDateRangeForPeriod(timeRange);
    
    // First, if we have a business ID, fetch conversations for that business
    let conversationFilter: string[] = [];
    if (businessId) {
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('business_id', businessId);
      
      if (convError) {
        console.error('Error fetching conversations for business:', convError);
      } else if (conversations && conversations.length > 0) {
        conversationFilter = conversations.map((conv: { id: string }) => conv.id);
      }
    }
    
    // Get all messages for the current period
    const { data: currentMessagesAll, error: currentMessagesError } = await fetchMessages(
      currentStartDate, 
      currentEndDate
    );
    
    if (currentMessagesError) {
      console.error('Error fetching current messages for volume:', currentMessagesError);
      return { 
        data: [], 
        totalSent: 0, 
        totalReceived: 0, 
        sentPercentageChange: 0, 
        receivedPercentageChange: 0 
      };
    }
    
    // Filter messages by conversation_id if we have a business filter
    const currentMessages = businessId && conversationFilter.length > 0
      ? currentMessagesAll?.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
      : currentMessagesAll || [];
      
    // Get all messages for the previous period (for comparison)
    const { data: previousMessagesAll, error: previousMessagesError } = await fetchMessages(
      previousStartDate, 
      previousEndDate
    );
    
    // Filter messages by conversation_id if we have a business filter
    const previousMessages = businessId && conversationFilter.length > 0
      ? previousMessagesAll?.filter((msg: Message) => conversationFilter.includes(msg.conversation_id))
      : previousMessagesAll || [];
    
    if (previousMessagesError) {
      console.error('Error fetching previous messages for volume:', previousMessagesError);
      // Still continue with current data, just won't have comparison
    }
    
    // Group and count current messages
    const currentData = groupMessagesByTimePeriod(currentMessages, timeRange);
    
    // Count totals for current period
    const currentTotalSent = currentMessages.filter((msg: Message) => msg.sender_type === 'user').length;
    const currentTotalReceived = currentMessages.filter((msg: Message) => msg.sender_type === 'bot' || msg.sender_type === 'agent').length;
    
    // Count totals for previous period
    const previousTotalSent = previousMessages.filter((msg: Message) => msg.sender_type === 'user').length;
    const previousTotalReceived = previousMessages.filter((msg: Message) => msg.sender_type === 'bot' || msg.sender_type === 'agent').length;
    
    // Calculate percentage change
    let sentPercentageChange = 0;
    if (previousTotalSent > 0) {
      sentPercentageChange = ((currentTotalSent - previousTotalSent) / previousTotalSent) * 100;
    }
    
    let receivedPercentageChange = 0;
    if (previousTotalReceived > 0) {
      receivedPercentageChange = ((currentTotalReceived - previousTotalReceived) / previousTotalReceived) * 100;
    }
    
    return {
      data: currentData,
      totalSent: currentTotalSent,
      totalReceived: currentTotalReceived,
      sentPercentageChange: parseFloat(sentPercentageChange.toFixed(1)),
      receivedPercentageChange: parseFloat(receivedPercentageChange.toFixed(1))
    };
  } catch (error) {
    console.error('Error calculating message volume:', error);
    return { 
      data: [], 
      totalSent: 0, 
      totalReceived: 0, 
      sentPercentageChange: 0, 
      receivedPercentageChange: 0 
    };
  }
}

/**
 * Group messages by time period (hours, days, weeks, months)
 */
function groupMessagesByTimePeriod(messages: Message[], timeRange: TimeRange): MessageVolumeDataPoint[] {
  const groupedData: Record<string, { sent: number, received: number }> = {};
  
  // Define format based on time range
  let format: string;
  switch (timeRange) {
    case 'daily':
      format = 'HH:00'; // Hour format (01:00, 02:00, etc.)
      break;
    case 'weekly':
      format = 'ddd'; // Day format (Lun, Mar, etc.)
      break;
    case 'monthly':
      format = 'Sem W'; // Week format (Sem 1, Sem 2, etc.)
      break;
    case 'yearly':
      format = 'MMM'; // Month format (Ene, Feb, etc.)
      break;
    default:
      format = 'HH:00';
  }
  
  // Initialize periods based on time range
  switch (timeRange) {
    case 'daily':
      // Initialize all hours of the day
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0') + ':00';
        groupedData[hour] = { sent: 0, received: 0 };
      }
      break;
    case 'weekly':
      // Initialize all days of the week
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      days.forEach(day => {
        groupedData[day] = { sent: 0, received: 0 };
      });
      break;
    case 'monthly':
      // Initialize all weeks of the month
      for (let i = 1; i <= 5; i++) {
        groupedData[`Sem ${i}`] = { sent: 0, received: 0 };
      }
      break;
    case 'yearly':
      // Initialize all months of the year
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      months.forEach(month => {
        groupedData[month] = { sent: 0, received: 0 };
      });
      break;
  }
  
  // Group messages
  messages.forEach(message => {
    const date = new Date(message.created_at);
    let period = formatTimestamp(date, format);
    
    // Special case for weekly: adjust to calendar week
    if (timeRange === 'monthly') {
      const weekNum = Math.ceil(date.getDate() / 7);
      period = `Sem ${weekNum}`;
    }
    
    if (!groupedData[period]) {
      groupedData[period] = { sent: 0, received: 0 };
    }
    
    if (message.sender_type === 'user') {
      groupedData[period].sent += 1;
    } else if (message.sender_type === 'bot' || message.sender_type === 'agent') {
      groupedData[period].received += 1;
    }
  });
  
  // Convert to array format for charts
  const result: MessageVolumeDataPoint[] = Object.keys(groupedData).map(name => ({
    name,
    sent: groupedData[name].sent,
    received: groupedData[name].received
  }));
  
  // Sort data points based on time range
  if (timeRange === 'daily') {
    result.sort((a, b) => {
      return parseInt(a.name.split(':')[0]) - parseInt(b.name.split(':')[0]);
    });
  } else if (timeRange === 'weekly') {
    const dayOrder = { 'Dom': 0, 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6 };
    result.sort((a, b) => {
      return dayOrder[a.name as keyof typeof dayOrder] - dayOrder[b.name as keyof typeof dayOrder];
    });
  } else if (timeRange === 'monthly') {
    result.sort((a, b) => {
      return parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]);
    });
  } else if (timeRange === 'yearly') {
    const monthOrder = { 
      'Ene': 0, 'Feb': 1, 'Mar': 2, 'Abr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dic': 11
    };
    result.sort((a, b) => {
      return monthOrder[a.name as keyof typeof monthOrder] - monthOrder[b.name as keyof typeof monthOrder];
    });
  }
  
  return result;
} 