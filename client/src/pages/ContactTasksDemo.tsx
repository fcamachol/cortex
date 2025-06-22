import React from 'react';
import { ContactTasksAndEvents } from '@/components/contacts/ContactTasksAndEvents';

export default function ContactTasksDemo() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Contact Tasks & Events Demo
        </h1>
        
        <div className="space-y-8">
          {/* Demo with Mexican contact */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Demo Contact: Andres Camacho
            </h2>
            <ContactTasksAndEvents
              contactJid="5215585333840@s.whatsapp.net"
              contactName="Andres Camacho"
              instanceId="live-test-1750199771"
            />
          </div>

          {/* Demo with another contact */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Demo Contact: Sample User
            </h2>
            <ContactTasksAndEvents
              contactJid="5215530453567@s.whatsapp.net"
              contactName="Sample User"
              instanceId="instance-1750433520122"
            />
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              How to Use
            </h3>
            <ul className="space-y-2 text-blue-800 dark:text-blue-200">
              <li>• Click on "Tasks & Events" to expand the section</li>
              <li>• View tasks and upcoming events linked to the contact</li>
              <li>• Click "View All Tasks for Contact" to see the full list</li>
              <li>• Tasks are filtered by contact JID and related metadata</li>
              <li>• Events are matched by attendee email and content keywords</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}