import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, MoreVertical } from "lucide-react";

export default function CalendarModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");

  // Format current month/year for display
  const formatCurrentMonth = () => {
    return currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Navigate to previous/next month
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of week for the first day (0 = Sunday)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const day = new Date(currentDateObj);
      const isCurrentMonth = day.getMonth() === month;
      const isToday = day.toDateString() === new Date().toDateString();
      
      days.push({
        date: day,
        dayNumber: day.getDate(),
        isCurrentMonth,
        isToday,
        events: getEventsForDay(day) // Mock events
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  };

  // Mock function to get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dayOfMonth = date.getDate();
    const mockEvents = [];
    
    // Add some mock events for demonstration
    if (dayOfMonth === 1) {
      mockEvents.push({ title: "Team Meeting", color: "bg-blue-100 text-blue-800" });
    }
    if (dayOfMonth === 3) {
      mockEvents.push(
        { title: "Client Call", color: "bg-green-100 text-green-800" },
        { title: "Review Session", color: "bg-purple-100 text-purple-800" }
      );
    }
    if (dayOfMonth === 4) {
      mockEvents.push({ title: "Project Deadline", color: "bg-orange-100 text-orange-800" });
    }
    if (dayOfMonth === 6) {
      mockEvents.push({ title: "Urgent Task", color: "bg-red-100 text-red-800" });
    }
    
    return mockEvents;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Mock upcoming events
  const upcomingEvents = [
    {
      id: 1,
      title: "Team Meeting",
      time: "Today, 2:00 PM - 3:00 PM",
      color: "bg-blue-500"
    },
    {
      id: 2,
      title: "Client Presentation",
      time: "Tomorrow, 10:00 AM - 11:30 AM",
      color: "bg-green-500"
    }
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </div>

        {/* Calendar Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrentMonth()}
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              {['Month', 'Week', 'Day'].map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode.toLowerCase() ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode(mode.toLowerCase())}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0">
            {/* Calendar Headers */}
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`calendar-day ${day.isToday ? 'today' : ''} ${
                  !day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    day.isToday 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {day.dayNumber}
                  </span>
                  {day.isToday && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                <div className="space-y-1">
                  {day.events.map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className={`text-xs px-2 py-1 rounded truncate ${event.color}`}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
          </div>
          <div className="p-4 space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                No upcoming events
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className={`w-3 h-3 ${event.color} rounded-full`}></div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {event.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {event.time}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
