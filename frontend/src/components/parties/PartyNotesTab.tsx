import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  MessageSquare, Plus, Clock, User, AlertTriangle, Edit,
  FileText, CheckCircle, Paperclip,
} from 'lucide-react';

interface PartyNotesTabProps {
  partyId: string;
}

export default function PartyNotesTab({ partyId }: PartyNotesTabProps) {
  const [newNoteDialogOpen, setNewNoteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Notes Section - Empty State */}
      <Card className="p-12 text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Notes Available Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Party notes and activity tracking will be available once the notes module is implemented.
          This will include team notes, communication logs, and activity timeline.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="text-center p-4 border rounded-lg">
            <MessageSquare className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Team Notes</h4>
            <p className="text-sm text-muted-foreground">Internal communication</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Activity Timeline</h4>
            <p className="text-sm text-muted-foreground">Track all party activities</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <FileText className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Document Attachments</h4>
            <p className="text-sm text-muted-foreground">Store related files</p>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={() => setNewNoteDialogOpen(true)} size="sm" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Note (Coming Soon)
          </Button>
        </div>
      </Card>

      {/* Activity Timeline - Empty State */}
      <Card className="p-12 text-center">
        <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Activity Recorded Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Activity timeline will show all important events, changes, and interactions with this party.
          This includes invoice creation, payment updates, compliance checks, and team activities.
        </p>
        
        <div className="space-y-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <Edit className="h-5 w-5 text-blue-500" />
            <div className="text-left">
              <p className="font-medium">Party Updates</p>
              <p className="text-sm text-muted-foreground">Profile changes and status updates</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <FileText className="h-5 w-5 text-green-500" />
            <div className="text-left">
              <p className="font-medium">Invoice Activity</p>
              <p className="text-sm text-muted-foreground">New invoices and payment events</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div className="text-left">
              <p className="font-medium">Compliance Events</p>
              <p className="text-sm text-muted-foreground">GST checks and regulatory updates</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Attachments Section - Empty State */}
      <Card className="p-12 text-center">
        <Paperclip className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Attachments Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Document storage will be available once the file management module is implemented.
          This will support contracts, compliance documents, invoices, and other important files.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
          <div className="text-center p-4 border rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Contracts</h4>
            <p className="text-sm text-muted-foreground">Service agreements</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <User className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-medium mb-1">KYC Documents</h4>
            <p className="text-sm text-muted-foreground">Identity verification</p>
          </div>
        </div>
      </Card>

      {/* Coming Soon Dialog */}
      <Dialog open={newNoteDialogOpen} onOpenChange={setNewNoteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Feature Coming Soon</DialogTitle>
            <DialogDescription>
              The notes and activity tracking module is currently under development.
            </DialogDescription>
          </DialogHeader>
          
          <div className="text-center py-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h4 className="font-semibold mb-2">Notes & Activity Tracking</h4>
            <p className="text-muted-foreground">
              This feature will allow you to add notes, track party activities, and manage attachments 
              once the backend APIs are implemented.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setNewNoteDialogOpen(false)}>
              Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
