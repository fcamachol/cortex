import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, Mail, MapPin, Building2, Users, Calendar, Tag, ChevronDown, ChevronUp, Edit } from "lucide-react";
import type { CrmContact } from "@shared/schema";

interface ContactModalProps {
  contact: CrmContact | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (contact: CrmContact) => void;
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
          {/* Contact Info Section */}
          <Collapsible open={contactInfoOpen} onOpenChange={setContactInfoOpen}>
            <CollapsibleTrigger asChild>
              <div className="bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">CONTACT INFO</h3>
                  </div>
                  {contactInfoOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-4">
                <div className="space-y-4">
                  {contact.notes && (
                    <div className="text-sm text-gray-600">
                      {contact.notes}
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    Detailed contact information will be displayed here once the full contact schema is integrated.
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Relationships & Groups Section */}
          <Collapsible open={relationshipsOpen} onOpenChange={setRelationshipsOpen}>
            <CollapsibleTrigger asChild>
              <div className="bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">RELATIONSHIPS & GROUPS</h3>
                  </div>
                  {relationshipsOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-4">
                <div className="space-y-4">
                  {contact.relationship && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Relationship</span>
                      </div>
                      <div className="ml-6">
                        <Badge variant="outline">{contact.relationship}</Badge>
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    Company affiliations and group memberships will be displayed here.
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Personal Details Section */}
          <Collapsible open={personalDetailsOpen} onOpenChange={setPersonalDetailsOpen}>
            <CollapsibleTrigger asChild>
              <div className="bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">PERSONAL DETAILS</h3>
                  </div>
                  {personalDetailsOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Created</span>
                    </div>
                    <div className="ml-6 text-sm text-gray-600">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Special dates, interests, and other personal details will be displayed here.
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">ACTIVITY</h3>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              {[
                { id: 'tasks', label: 'Tasks', icon: Tag },
                { id: 'events', label: 'Events', icon: Calendar },
                { id: 'finance', label: 'Finance', icon: Building2 },
                { id: 'notes', label: 'Notes & Docs', icon: Mail }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 bg-white rounded-b-lg">
              {activeTab === 'tasks' && (
                <div className="text-center py-8">
                  <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No tasks found for this contact</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add Task
                  </Button>
                </div>
              )}
              
              {activeTab === 'events' && (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No events found for this contact</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add Event
                  </Button>
                </div>
              )}
              
              {activeTab === 'finance' && (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No financial records found for this contact</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add Transaction
                  </Button>
                </div>
              )}
              
              {activeTab === 'notes' && (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No notes or documents found for this contact</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add Note
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}