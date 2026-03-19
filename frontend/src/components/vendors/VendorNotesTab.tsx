import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  MessageSquare, Plus, Clock, User, FileText, AlertTriangle, CheckCircle,
  Edit, Trash2, Paperclip,
} from 'lucide-react';

interface VendorNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  type: 'general' | 'compliance' | 'payment' | 'contact';
  attachments?: string[];
}

interface VendorActivity {
  id: string;
  type: 'created' | 'updated' | 'payment' | 'compliance' | 'invoice' | 'status';
  title: string;
  description: string;
  timestamp: string;
  user: string;
  severity?: 'low' | 'medium' | 'high';
}

interface VendorNotesTabProps {
  vendorId: string;
}

export default function VendorNotesTab({ vendorId }: VendorNotesTabProps) {
  const [notes, setNotes] = useState<VendorNote[]>([
    {
      id: '1',
      content: 'Vendor requested extension on payment terms from NET 30 to NET 45 due to cash flow issues. Approved by finance team.',
      createdAt: '2024-02-15T10:30:00Z',
      createdBy: 'John Doe',
      type: 'payment',
    },
    {
      id: '2',
      content: 'GST verification completed. GSTIN is valid and active. All documents uploaded.',
      createdAt: '2024-02-10T14:20:00Z',
      createdBy: 'Jane Smith',
      type: 'compliance',
    },
    {
      id: '3',
      content: 'Initial vendor onboarding meeting conducted. Discussed service level agreements and pricing.',
      createdAt: '2024-01-20T09:15:00Z',
      createdBy: 'Mike Johnson',
      type: 'general',
    },
  ]);

  const [activities] = useState<VendorActivity[]>([
    {
      id: '1',
      type: 'created',
      title: 'Vendor Created',
      description: 'Vendor profile created in system',
      timestamp: '2024-01-15T11:00:00Z',
      user: 'System',
    },
    {
      id: '2',
      type: 'updated',
      title: 'Payment Terms Changed',
      description: 'Payment terms updated from NET 30 to NET 45',
      timestamp: '2024-02-15T10:30:00Z',
      user: 'John Doe',
    },
    {
      id: '3',
      type: 'invoice',
      title: 'Invoice Added',
      description: '3 new invoices added this month',
      timestamp: '2024-02-28T16:45:00Z',
      user: 'System',
    },
    {
      id: '4',
      type: 'compliance',
      title: 'Compliance Flag Triggered',
      description: 'GST verification completed successfully',
      timestamp: '2024-02-10T14:20:00Z',
      user: 'Jane Smith',
      severity: 'low',
    },
    {
      id: '5',
      type: 'status',
      title: 'Status Changed',
      description: 'Vendor status changed from Inactive to Active',
      timestamp: '2024-01-20T09:15:00Z',
      user: 'Mike Johnson',
    },
  ]);

  const [newNoteDialogOpen, setNewNoteDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedNoteType, setSelectedNoteType] = useState<VendorNote['type']>('general');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNoteTypeIcon = (type: VendorNote['type']) => {
    switch (type) {
      case 'compliance':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'payment':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'contact':
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNoteTypeBadge = (type: VendorNote['type']) => {
    const variants = {
      general: 'secondary',
      compliance: 'destructive',
      payment: 'default',
      contact: 'outline',
    } as const;
    
    return (
      <Badge variant={variants[type]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const getActivityIcon = (type: VendorActivity['type']) => {
    switch (type) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-blue-500" />;
      case 'payment':
        return <Clock className="h-4 w-4 text-purple-500" />;
      case 'compliance':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'invoice':
        return <FileText className="h-4 w-4 text-gray-500" />;
      case 'status':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim()) {
      toast.error('Please enter a note');
      return;
    }

    const newNote: VendorNote = {
      id: Date.now().toString(),
      content: newNoteContent,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
      type: selectedNoteType,
    };

    setNotes([newNote, ...notes]);
    setNewNoteContent('');
    setNewNoteDialogOpen(false);
    toast.success('Note added successfully');
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter(note => note.id !== noteId));
    toast.success('Note deleted successfully');
  };

  return (
    <div className="space-y-6">
      {/* Notes Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Notes</h3>
            <Badge variant="secondary">{notes.length} notes</Badge>
          </div>
          <Button onClick={() => setNewNoteDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">No notes yet</h4>
              <p className="text-muted-foreground mb-4">
                Add your first note to track important information about this vendor.
              </p>
              <Button onClick={() => setNewNoteDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add First Note
              </Button>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getNoteTypeIcon(note.type)}
                    {getNoteTypeBadge(note.type)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <p className="text-sm mb-3">{note.content}</p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span>{note.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(note.createdAt)}</span>
                  </div>
                </div>

                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {note.attachments.length} attachment(s)
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Activity Timeline</h3>
          <Badge variant="secondary">{activities.length} activities</Badge>
        </div>

        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="p-2 rounded-full bg-muted">
                  {getActivityIcon(activity.type)}
                </div>
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-8 bg-muted mt-2" />
                )}
              </div>
              
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{activity.title}</h4>
                  {activity.severity && (
                    <Badge variant={
                      activity.severity === 'high' ? 'destructive' :
                      activity.severity === 'medium' ? 'secondary' : 'outline'
                    }>
                      {activity.severity}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {activity.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{activity.user}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(activity.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Attachments Section (Placeholder) */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Attachments</h3>
        </div>
        
        <div className="text-center py-8">
          <Paperclip className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2">No attachments yet</h4>
          <p className="text-muted-foreground">
            Upload contracts, vendor onboarding documents, and other important files.
          </p>
        </div>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={newNoteDialogOpen} onOpenChange={setNewNoteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a new note for this vendor. Notes are visible to all team members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Note Type</label>
              <div className="flex gap-2">
                {(['general', 'compliance', 'payment', 'contact'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={selectedNoteType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedNoteType(type)}
                  >
                    {getNoteTypeIcon(type)}
                    <span className="ml-1">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Note Content</label>
              <Textarea
                placeholder="Enter your note here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
