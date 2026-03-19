import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle, XCircle, AlertCircle, Clock, User, Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalStatus {
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  correctionRequest?: string;
}

interface ApprovalPanelProps {
  status: "pending_approval" | "approved" | "rejected" | "correction_required";
  approvalStatus?: ApprovalStatus;
  onApprove?: (notes?: string) => void;
  onReject?: (reason: string) => void;
  onRequestCorrection?: (comment: string) => void;
  currentUser?: string;
  canApprove?: boolean;
}

export default function ApprovalPanel({
  status,
  approvalStatus,
  onApprove,
  onReject,
  onRequestCorrection,
  currentUser = "Current User",
  canApprove = true,
}: ApprovalPanelProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [correctionComment, setCorrectionComment] = useState("");

  const statusConfig = {
    pending_approval: {
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: Clock,
      label: "Pending Approval",
      description: "Waiting for approval from authorized personnel",
    },
    approved: {
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: CheckCircle,
      label: "Approved",
      description: "Invoice approved and ready for payment processing",
    },
    rejected: {
      color: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
      label: "Rejected",
      description: "Invoice rejected and requires correction",
    },
    correction_required: {
      color: "bg-blue-100 text-blue-700 border-blue-200",
      icon: AlertCircle,
      label: "Correction Required",
      description: "Invoice needs to be corrected and resubmitted",
    },
  };

  const config = statusConfig[status] || {
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Clock,
    label: "Unknown Status",
    description: "Status information not available",
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove();
      toast.success("Invoice approved successfully");
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    if (onReject) {
      onReject(rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason("");
      toast.success("Invoice rejected with reason");
    }
  };

  const handleRequestCorrection = () => {
    if (!correctionComment.trim()) {
      toast.error("Please provide correction instructions");
      return;
    }
    if (onRequestCorrection) {
      onRequestCorrection(correctionComment);
      setCorrectionDialogOpen(false);
      setCorrectionComment("");
      toast.success("Correction request sent");
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Approval Status</h3>
          <Badge className={`text-xs ${config.color}`}>
            <config.icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Status Description */}
          <p className="text-sm text-muted-foreground">
            {config.description}
          </p>

          {/* Approval Details */}
          {approvalStatus && (approvalStatus.approvedBy || approvalStatus.approvedAt) && (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-2">
                {approvalStatus.approvedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Approved by:</span>
                    <span className="font-medium">{approvalStatus.approvedBy}</span>
                  </div>
                )}
                {approvalStatus.approvedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Approved at:</span>
                    <span className="font-medium">
                      {new Date(approvalStatus.approvedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {status === "rejected" && approvalStatus?.rejectionReason && (
            <div className="space-y-2">
              <Separator />
              <div>
                <Label className="text-sm font-medium text-red-700">Rejection Reason</Label>
                <p className="text-sm text-red-600 mt-1 p-2 bg-red-50 rounded">
                  {approvalStatus.rejectionReason}
                </p>
              </div>
            </div>
          )}

          {/* Correction Request */}
          {status === "correction_required" && approvalStatus?.correctionRequest && (
            <div className="space-y-2">
              <Separator />
              <div>
                <Label className="text-sm font-medium text-blue-700">Correction Required</Label>
                <p className="text-sm text-blue-600 mt-1 p-2 bg-blue-50 rounded">
                  {approvalStatus.correctionRequest}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {canApprove && status === "pending_approval" && (
            <div className="space-y-3">
              <Separator />
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve Invoice
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCorrectionDialogOpen(true)}
                  className="gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  Request Correction
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Please explain why this invoice is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Request Dialog */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Request Correction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="correctionComment">Correction Instructions *</Label>
              <Textarea
                id="correctionComment"
                placeholder="Please specify what corrections are needed..."
                value={correctionComment}
                onChange={(e) => setCorrectionComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestCorrection}>
              Request Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
