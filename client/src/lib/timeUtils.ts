/**
 * Smart timestamp formatting for conversation list
 * - Today: Show time (e.g., "2:30 PM")
 * - Yesterday: Show "Yesterday"
 * - This week: Show day name (e.g., "Friday")
 * - Older: Show date (e.g., "12/25")
 */
export function formatConversationTimestamp(timestamp: string | Date): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Today - show time
  if (date >= startOfToday) {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  // Yesterday
  if (date >= startOfYesterday) {
    return 'Yesterday';
  }
  
  // This week - show day name
  if (date >= startOfWeek) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  
  // Older - show date
  return date.toLocaleDateString([], { 
    month: 'numeric', 
    day: 'numeric' 
  });
}