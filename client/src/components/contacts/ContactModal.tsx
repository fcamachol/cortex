import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, Mail, MapPin, Building2, Users, Calendar, Tag, MessageSquare, ChevronDown, ChevronUp, Edit, User } from "lucide-react";
import type { Contact } from "@shared/schema";

interface ContactModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (contact: Contact) => void;
}

export function ContactModal({ contact, isOpen, onClose, onEdit }: ContactModalProps) {
  const [activeTab, setActiveTab] = useState('tasks');
  const [contactInfoOpen, setContactInfoOpen] = useState(true);
  const [relationshipsOpen, setRelationshipsOpen] = useState(true);
  const [personalDetailsOpen, setPersonalDetailsOpen] = useState(true);

  if (!contact) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={contact.profilePictureUrl || undefined} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-lg font-semibold">
                  {getInitials(contact.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  {contact.fullName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {contact.relationship && (
                    <Badge variant="secondary" className="text-xs">
                      {contact.relationship}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(contact)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Contact Info Section - Platform UX/UI Style */}
          <Collapsible open={contactInfoOpen} onOpenChange={setContactInfoOpen}>
            <CollapsibleTrigger asChild>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">CONTACT INFO</h3>
                  </div>
                  {contactInfoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 border-t-0 rounded-b-lg">
                <div className="p-4 space-y-4">
                  {/* Phone Numbers */}
                  {contact.phones && contact.phones.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Phone Numbers</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.phones.map((phone, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <span>{phone.type || 'Phone'}{phone.isPrimary ? ' (Primary)' : ''}:</span>
                            <span className="font-mono">{phone.phoneNumber}</span>
                            {phone.hasWhatsApp && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                WhatsApp
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Emails */}
                  {contact.emails && contact.emails.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Emails</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.emails.map((email, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <span>{email.type || 'Email'}:</span>
                            <span>{email.emailAddress}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Addresses */}
                  {contact.addresses && contact.addresses.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Addresses</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.addresses.map((address, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{address.type || 'Address'}:</span>
                            <div className="ml-2 text-gray-600">
                              {address.street && <div>{address.street}</div>}
                              <div>
                                {address.city}{address.state && `, ${address.state}`}{address.zipCode && ` ${address.zipCode}`}
                              </div>
                              {address.country && <div>{address.country}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Relationships & Groups Section - Platform UX/UI Style */}
          <Collapsible open={relationshipsOpen} onOpenChange={setRelationshipsOpen}>
            <CollapsibleTrigger asChild>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">RELATIONSHIPS & GROUPS</h3>
                  </div>
                  {relationshipsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 border-t-0 rounded-b-lg">
                <div className="p-4 space-y-4">
                  {/* Company Memberships */}
                  {contact.companyMemberships && contact.companyMemberships.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">Companies</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.companyMemberships.map((membership, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{membership.company.companyName}</span>
                            {membership.role && <span className="text-gray-600"> - {membership.role}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Groups */}
                  {contact.contactGroupMemberships && contact.contactGroupMemberships.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Groups</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.contactGroupMemberships.map((membership, index) => (
                          <div key={index} className="text-sm">
                            <Badge variant="outline">{membership.contactGroup.groupName}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Personal Details Section - Platform UX/UI Style */}
          <Collapsible open={personalDetailsOpen} onOpenChange={setPersonalDetailsOpen}>
            <CollapsibleTrigger asChild>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">PERSONAL DETAILS</h3>
                  </div>
                  {personalDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 border-t-0 rounded-b-lg">
                <div className="p-4 space-y-4">
                  {/* Special Dates */}
                  {contact.specialDates && contact.specialDates.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">Special Dates</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {contact.specialDates.map((date, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{date.dateType}:</span>
                            <span className="ml-2">{date.date}</span>
                            {date.reminderDays && (
                              <span className="text-gray-500 ml-2">(Reminder: {date.reminderDays} days prior)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interests */}
                  {contact.interests && contact.interests.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Interests</span>
                      </div>
                      <div className="ml-6">
                        <div className="flex flex-wrap gap-2">
                          {contact.interests.map((interest, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {interest.interestName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Section - Platform UX/UI Style */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">ACTIVITY</h3>
              
              {/* Activity Tabs - Platform Style */}
              <div className="flex gap-6">
                {[
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'events', label: 'Events' },
                  { id: 'finance', label: 'Finance' },
                  { id: 'notes', label: 'Notes & Docs' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    [ {tab.label} ]
                  </button>
                ))}
              </div>

              {/* Separator Line */}
              <div className="border-t border-gray-300 dark:border-gray-600"></div>

              {/* Activity Content */}
              <div className="space-y-3">
                {activeTab === 'tasks' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-600">✓</span>
                      <span>Finalize appointment for {contact.fullName}'s check-up</span>
                      <span className="text-gray-500 ml-auto">Due: June 27, 2025</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">☐</span>
                      <span>{contact.fullName}'s Annual Check-up</span>
                      <span className="text-gray-500 ml-auto">Date: July 15, 2025</span>
                    </div>
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="text-sm text-gray-500">
                    No upcoming events
                  </div>
                )}

                {activeTab === 'finance' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-red-600">▼</span>
                      <span>-$2,500.00 Payment for Consultation</span>
                      <span className="text-gray-500 ml-auto">Date: May 20, 2025</span>
                    </div>
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="text-sm text-gray-500">
                    No notes or documents
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}