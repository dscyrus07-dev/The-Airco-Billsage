import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ZoomIn, 
  Download,
  Loader2,
  Eye,
  Edit,
  Save,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { purchaseService } from "@/services/purchaseService";
import NewVendorModal from "@/components/purchases/NewVendorModal";

// Types
interface ExtractionData {
  vendor?: {
    name?: string;
    gstin?: string;
    address?: string;
  };
  invoice?: {
    invoice_number?: string;
    invoice_date?: string;
    due_date?: string;
    place_of_supply?: string;
  };
  amounts?: {
    subtotal?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    grand_total?: number;
  };
  line_items?: Array<{
    description: string;
    hsn_sac: string;
    quantity: number;
    unit: string;
    rate: number;
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    total_amount: number;
  }>;
}

interface PrefillPartyData {
  party_type?: string;
  party_name?: string;
  display_name?: string;
  party_category?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
  address?: string;
  state?: string;
  pin_code?: string;
  notes?: string;
}

interface ReviewData {
  review_id: string;
  extraction_confidence?: number;
  extracted_data?: ExtractionData;
  status?: string;
  error?: string;
  message?: string;
  error_stage?: string;
  error_details?: string;
  file_name?: string;
  file_size?: number;
  prefill_party?: PrefillPartyData;
  supplier_match?: {
    matched: boolean;
    party_id?: string;
    requires_creation?: boolean;
    candidate_name?: string;
  };
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

// API Service - using purchaseService
const purchaseApi = {
  uploadAndExtract: purchaseService.uploadAndExtract.bind(purchaseService),
  confirmReview: purchaseService.confirmReview.bind(purchaseService),
  getExtractionReview: purchaseService.getExtractionReview.bind(purchaseService),
  getVendors: purchaseService.getVendors.bind(purchaseService),
};

export default function UploadBill() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [extractionResult, setExtractionResult] = useState<ReviewData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ExtractionData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [newVendorPrefillData, setNewVendorPrefillData] = useState<PrefillPartyData | undefined>(undefined);
  const [createdSupplierId, setCreatedSupplierId] = useState<string | null>(null);
  
  // Ref for scrolling to review section
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to review section when extraction is ready
  useEffect(() => {
    if (uploadState === 'ready' && extractionResult && reviewSectionRef.current) {
      console.log('📍 Auto-scrolling to review section');
      setTimeout(() => {
        reviewSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 300);
    }
  }, [uploadState, extractionResult]);

  const handleReviewResponse = useCallback((data: ReviewData | null | undefined, options?: { fromPolling?: boolean }) => {
    const fromPolling = options?.fromPolling ?? false;

    console.log('� Review response:', data);

    if (!data) {
      setUploadState('error');
      setUploadError('No response from server');
      toast.error('No response from server');
      return;
    }

    if (data.status === 'processing' || data.status === 'pending') {
      console.log('⏳ Extraction is processing in the background...');
      setExtractionResult((prev) => ({
        ...(prev || {}),
        ...data,
        review_id: data.review_id || prev?.review_id || ''
      }));
      setUploadState('processing');
      setUploadError(null);

      if (!fromPolling) {
        toast.info(data.message || 'Upload received. Extraction is running in the background.');
      }
      return;
    }

    if (data.status === 'failed') {
      const errorMessage = data.error || data.message || 'Failed to extract data from file';
      const errorDetails = data.error_details || '';

      setUploadState('error');
      setExtractionResult(data);
      setUploadError(errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage);

      toast.error(errorMessage, {
        description: errorDetails || 'Please try again or enter the purchase bill manually.',
        duration: 6000
      });
      return;
    }

    if (data.status === 'needs_vendor_review') {
      console.log('🆕 New vendor found - opening vendor creation modal');

      if (!data.prefill_party) {
        console.warn('⚠️ needs_vendor_review status but no prefill_party data');
        setUploadState('error');
        setUploadError('New vendor detected but no vendor details were extracted.');
        toast.error('Unable to extract vendor details');
        return;
      }

      setExtractionResult(data);
      setEditedData(JSON.parse(JSON.stringify(data.extracted_data || {})));
      setNewVendorPrefillData(data.prefill_party);
      setUploadState('ready');
      setUploadError(null);
      setShowNewVendorModal(true);
      setIsEditing(true);

      const vendorName = data.supplier_match?.candidate_name || data.prefill_party?.party_name || 'Unknown';
      toast.info(`New vendor found: ${vendorName}`, {
        description: 'Please review and create the supplier to continue',
        duration: 5000
      });
      return;
    }

    if (data.status !== 'completed') {
      console.warn('⚠️ Unexpected status:', data.status);
      setUploadState('error');
      setUploadError(`Unexpected response status: ${data.status}`);
      toast.error('Unexpected response from server');
      return;
    }

    if (!data.extracted_data || Object.keys(data.extracted_data).length === 0) {
      console.warn('⚠️ Status is completed but no extracted data present');
      setUploadState('error');
      setUploadError('Extraction completed but no data was extracted. The file may be unreadable or in an unsupported format.');
      toast.error('No data could be extracted from the file. Please try again or enter manually.');
      return;
    }

    console.log('✅ Extraction successful, setting up review UI');
    console.log('📦 Extracted data keys:', Object.keys(data.extracted_data));
    console.log('🔍 Review ID:', data.review_id);
    console.log('📊 Extraction confidence:', data.extraction_confidence);
    console.log('🎯 Workflow status:', data.status);

    setExtractionResult(data);
    setEditedData(JSON.parse(JSON.stringify(data.extracted_data)));
    setUploadState('ready');
    setUploadError(null);
    setIsEditing(true);

    const confidence = data.extraction_confidence || 0;
    toast.success('Extraction complete - Review and save the purchase invoice', {
      description: `Extracted with ${(confidence * 100).toFixed(1)}% confidence. Please review the details below.`,
      duration: 6000
    });
  }, []);

  useEffect(() => {
    if (uploadState !== 'processing' || !extractionResult?.review_id) {
      return;
    }

    let isCancelled = false;

    const pollExtractionReview = async () => {
      try {
        const review = await purchaseApi.getExtractionReview(extractionResult.review_id);

        if (isCancelled) {
          return;
        }

        if (review?.status === 'pending' || review?.status === 'processing') {
          setExtractionResult((prev) => ({
            ...(prev || {}),
            ...review,
            review_id: review.review_id || prev?.review_id || ''
          }));
          return;
        }

        handleReviewResponse(review, { fromPolling: true });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error('❌ Failed to poll extraction review:', error);
        setUploadState('error');
        setUploadError('Upload was received, but Billsage could not fetch the background extraction status. Please try again or enter the bill manually.');
        toast.error('Could not fetch extraction status', {
          description: 'The upload was accepted, but the review status could not be loaded.',
          duration: 5000
        });
      }
    };

    pollExtractionReview();
    const intervalId = window.setInterval(pollExtractionReview, 3000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [uploadState, extractionResult?.review_id, handleReviewResponse]);
  
  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: purchaseApi.getVendors,
  });
  
  // File upload and extraction
  const uploadMutation = useMutation({
    mutationFn: purchaseApi.uploadAndExtract,
    onSuccess: (data: any) => {
      handleReviewResponse(data);
    },
    onError: (error: any) => {
      console.error('❌ Upload error:', error);
      
      // Extract structured error information from API response
      let errorMessage = 'Failed to upload or extract data from file';
      let errorDetails = '';
      let errorStage = 'unknown';
      const structuredDetail = error?.details?.detail;
      
      // Check if error has response data (from API)
      if (structuredDetail && typeof structuredDetail === 'object') {
        const errorData = structuredDetail;
        errorStage = errorData.stage || 'unknown';
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData.details || '';

        console.error(`❌ Error at stage '${errorStage}':`, errorMessage);
        if (errorDetails) {
          console.error('   Details:', errorDetails);
        }
      } else if (error.response?.data) {
        const errorData = error.response.data;
        errorStage = errorData.stage || 'unknown';
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData.details || '';
        
        console.error(`❌ Error at stage '${errorStage}':`, errorMessage);
        if (errorDetails) {
          console.error('   Details:', errorDetails);
        }
      } else if (error.message) {
        errorMessage = error.message;
        if (error.status === 524) {
          errorMessage = 'Upload timed out before the server responded';
          errorDetails = 'Billsage will now process uploads in the background after redeploy. Please retry once the latest fix is live.';
        }
      }
      
      // Set error state
      setUploadState('error');
      const fullErrorMessage = errorDetails 
        ? `${errorMessage}\n${errorDetails}` 
        : errorMessage;
      setUploadError(fullErrorMessage);
      
      // Show appropriate toast based on error stage
      if (errorStage === 'llm_extraction') {
        toast.error(errorMessage, {
          description: errorDetails || 'Please check your LLM configuration or try again later.',
          duration: 6000
        });
      } else if (errorStage === 'validation') {
        toast.error(errorMessage, {
          description: errorDetails,
          duration: 5000
        });
      } else {
        toast.error(errorMessage, {
          description: errorDetails || 'Please try again or contact support if the issue persists.',
          duration: 5000
        });
      }
    }
  });
  
  // Confirm and save invoice
  const saveMutation = useMutation({
    mutationFn: ({ reviewId, data }: { reviewId: string; data: any }) => 
      purchaseApi.confirmReview(reviewId, data),
    onSuccess: (data) => {
      setCreatedInvoiceId(data.invoice_id);
      setShowSuccessDialog(true);
      toast.success('Purchase invoice created successfully!');
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-kpis'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save purchase invoice');
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setCreatedSupplierId(null);
    setShowNewVendorModal(false);
    setIsEditing(false);
    setUploadError(null);
    setExtractionResult(null);
    setEditedData(null);
  };
  
  const handleUpload = () => {
    if (!selectedFile) return;
    
    setUploadState('uploading');
    setUploadError(null);
    uploadMutation.mutate(selectedFile);
  };
  
  const handleRetry = () => {
    setUploadState('idle');
    setUploadError(null);
    setExtractionResult(null);
    setEditedData(null);
    setCreatedSupplierId(null);
    setShowNewVendorModal(false);
    setIsEditing(false);
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    if (!extractionResult || !editedData) return;
    
    // Validate vendor is matched or created
    const vendorId = extractionResult.supplier_match?.party_id || createdSupplierId;
    
    if (!vendorId) {
      console.error('❌ No vendor ID available - supplier not matched or created');
      toast.error('Supplier not identified', {
        description: 'Please create the supplier first before saving the invoice.',
        duration: 5000
      });
      return;
    }
    
    console.log('💾 Saving invoice with vendor ID:', vendorId);
    console.log('📋 Review ID:', extractionResult.review_id);
    
    setIsSaving(true);
    
    // Convert edited data to invoice format with safe access
    const invoiceData = {
      vendor_id: vendorId,
      invoice_number: editedData.invoice?.invoice_number || '',
      invoice_date: editedData.invoice?.invoice_date || new Date().toISOString().split('T')[0],
      due_date: editedData.invoice?.due_date,
      place_of_supply: editedData.invoice?.place_of_supply || 'Maharashtra',
      category: 'Uncategorized',
      taxable_amount: editedData.amounts?.subtotal || 0,
      cgst: editedData.amounts?.cgst || 0,
      sgst: editedData.amounts?.sgst || 0,
      igst: editedData.amounts?.igst || 0,
      total_tax: (editedData.amounts?.cgst || 0) + (editedData.amounts?.sgst || 0) + (editedData.amounts?.igst || 0),
      total_amount: editedData.amounts?.grand_total || 0,
      paid_amount: 0,
      status: 'draft',
      gst_status: 'pending',
      items: (editedData.line_items || []).map((item, index) => ({
        line_no: index + 1,
        description: item.description,
        hsn_sac: item.hsn_sac,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discount_percent: 0,
        gst_percent: ((item.cgst + item.sgst) / item.taxable_value) * 100,
        taxable_value: item.taxable_value,
        cgst_amount: item.cgst,
        sgst_amount: item.sgst,
        igst_amount: item.igst,
        total_amount: item.total_amount,
      }))
    };
    
    console.log('📤 Submitting invoice data:', invoiceData);
    
    saveMutation.mutate({
      reviewId: extractionResult.review_id,
      data: invoiceData
    });
  };
  
  const handleVendorCreated = (partyId: string, partyData: any) => {
    console.log('✅ Vendor created successfully:', partyId, partyData);
    
    // Store the created supplier ID
    setCreatedSupplierId(partyId);
    
    // Update extraction result with supplier match
    if (extractionResult) {
      setExtractionResult({
        ...extractionResult,
        supplier_match: {
          matched: true,
          party_id: partyId,
          requires_creation: false,
          candidate_name: partyData.partyName || partyData.party_name
        }
      });
    }
    
    // Close vendor modal
    setShowNewVendorModal(false);
    
    // Enable editing mode for review
    setIsEditing(true);
    console.log('✏️ Auto-enabled editing mode after vendor creation');
    
    // Invalidate vendors query to refresh the list
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
    
    toast.success(`Supplier created - Review and save the purchase invoice`, {
      description: `Supplier "${partyData.partyName || partyData.party_name}" has been created. Please review the invoice details below.`,
      duration: 6000
    });
    
    // Scroll to review section
    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 300);
  };
  
  const handleVendorModalClose = () => {
    setShowNewVendorModal(false);
    // Keep the extraction result so user can still review/edit
  };
  
  const handleViewInvoice = () => {
    if (createdInvoiceId) {
      navigate(`/app/purchases/${createdInvoiceId}`);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Upload Purchase Bill</h1>
          <p className="text-muted-foreground">
            Upload a PDF purchase bill to extract data using OCR
          </p>
        </div>
      </div>
      
      {/* File Upload Section */}
      {uploadState === 'idle' && (
        <Card>
          <div className="p-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-primary font-medium">Click to upload</span> or drag and drop
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                
                <p className="text-sm text-muted-foreground">
                  PDF files up to 10MB
                </p>
                
                {selectedFile && (
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {selectedFile && (
                  <Button 
                    onClick={handleUpload}
                    disabled={uploadState === 'uploading'}
                    className="mt-4"
                  >
                    {uploadState === 'uploading' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Extract Data
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Upload Progress */}
      {(uploadState === 'uploading' || uploadState === 'processing') && (
        <Card>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">
                  {uploadState === 'uploading' ? 'Uploading PDF...' : 'Extraction running in background...'}
                </span>
              </div>
              <Progress value={uploadState === 'uploading' ? 35 : 80} className="w-full" />
              <p className="text-sm text-muted-foreground">
                {uploadState === 'uploading'
                  ? 'Sending the purchase bill to Billsage...'
                  : (extractionResult?.message || 'We received your file. OCR and invoice extraction are running in the background.')}
              </p>
              {uploadState === 'processing' && extractionResult?.review_id && (
                <p className="text-xs text-muted-foreground">
                  Review ID: {extractionResult.review_id}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
      
      {/* Error State */}
      {uploadState === 'error' && (
        <Card>
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {uploadError || 'An error occurred during extraction'}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex space-x-2">
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => navigate('/app/purchases/manual')} variant="outline">
                Enter Manually
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Extraction Results */}
      {uploadState === 'ready' && extractionResult && extractionResult.extracted_data && (
        <div ref={reviewSectionRef} className="space-y-6">
          {/* Extraction Summary */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Review Extracted Purchase Invoice</h2>
                  <p className="text-sm text-muted-foreground">
                    Review the extracted data below and click "Save Invoice" to create the purchase record
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getConfidenceColor(extractionResult.extraction_confidence)}>
                    {(extractionResult.extraction_confidence * 100).toFixed(1)}% Confidence
                  </Badge>
                  {!isEditing ? (
                    <Button variant="outline" onClick={handleEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  ) : (
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Invoice
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {extractionResult && extractionResult.extraction_confidence < 0.6 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Low extraction confidence detected. Please carefully review and edit the extracted data.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
          
          {/* Vendor Information */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Vendor Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vendor Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData?.vendor?.name || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        vendor: { ...(prev.vendor || {}), name: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p className="font-medium">{extractionResult.extracted_data?.vendor?.name || 'Not found'}</p>
                  )}
                </div>
                <div>
                  <Label>GSTIN</Label>
                  {isEditing ? (
                    <Input
                      value={editedData?.vendor?.gstin || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        vendor: { ...(prev.vendor || {}), gstin: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p>{extractionResult.extracted_data?.vendor?.gstin || 'Not found'}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedData?.vendor?.address || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        vendor: { ...(prev.vendor || {}), address: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p>{extractionResult.extracted_data?.vendor?.address || 'Not found'}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
          
          {/* Invoice Details */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  {isEditing ? (
                    <Input
                      value={editedData?.invoice?.invoice_number || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        invoice: { ...(prev.invoice || {}), invoice_number: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p className="font-medium">{extractionResult.extracted_data?.invoice?.invoice_number || 'Not found'}</p>
                  )}
                </div>
                <div>
                  <Label>Invoice Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editedData?.invoice?.invoice_date || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        invoice: { ...(prev.invoice || {}), invoice_date: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p>{extractionResult.extracted_data?.invoice?.invoice_date || 'Not found'}</p>
                  )}
                </div>
                <div>
                  <Label>Due Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editedData?.invoice?.due_date || ''}
                      onChange={(e) => setEditedData(prev => prev ? {
                        ...prev,
                        invoice: { ...(prev.invoice || {}), due_date: e.target.value }
                      } : null)}
                    />
                  ) : (
                    <p>{extractionResult.extracted_data?.invoice?.due_date || 'Not found'}</p>
                  )}
                </div>
                <div className="col-span-3">
                  <Label>Place of Supply</Label>
                  {isEditing ? (
                    <Select
                      value={editedData?.invoice?.place_of_supply || 'Maharashtra'}
                      onValueChange={(value) => setEditedData(prev => prev ? {
                        ...prev,
                        invoice: { ...(prev.invoice || {}), place_of_supply: value }
                      } : null)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                        <SelectItem value="Gujarat">Gujarat</SelectItem>
                        <SelectItem value="Delhi">Delhi</SelectItem>
                        <SelectItem value="Karnataka">Karnataka</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p>{extractionResult.extracted_data?.invoice?.place_of_supply || 'Maharashtra'}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
          
          {/* Line Items */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Line Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Description</th>
                      <th className="text-left py-2">HSN/SAC</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-left py-2">Unit</th>
                      <th className="text-right py-2">Rate</th>
                      <th className="text-right py-2">Taxable</th>
                      <th className="text-right py-2">CGST</th>
                      <th className="text-right py-2">SGST</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? editedData : extractionResult.extracted_data)?.line_items?.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">
                          {isEditing ? (
                            <Input
                              value={item.description}
                              onChange={(e) => {
                                const updatedItems = [...(editedData?.line_items || [])];
                                updatedItems[index] = { ...updatedItems[index], description: e.target.value };
                                setEditedData(prev => prev ? { ...prev, line_items: updatedItems } : null);
                              }}
                              className="h-8"
                            />
                          ) : (
                            item.description
                          )}
                        </td>
                        <td className="py-2">{item.hsn_sac}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="py-2">{item.unit}</td>
                        <td className="text-right py-2">{formatCurrency(item.rate)}</td>
                        <td className="text-right py-2">{formatCurrency(item.taxable_value)}</td>
                        <td className="text-right py-2">{formatCurrency(item.cgst)}</td>
                        <td className="text-right py-2">{formatCurrency(item.sgst)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
          
          {/* Amount Summary */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Amount Summary</h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency((isEditing ? editedData : extractionResult.extracted_data)?.amounts?.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST:</span>
                    <span>{formatCurrency((isEditing ? editedData : extractionResult.extracted_data)?.amounts?.cgst || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST:</span>
                    <span>{formatCurrency((isEditing ? editedData : extractionResult.extracted_data)?.amounts?.sgst || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IGST:</span>
                    <span>{formatCurrency((isEditing ? editedData : extractionResult.extracted_data)?.amounts?.igst || 0)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Grand Total:</span>
                    <span>{formatCurrency((isEditing ? editedData : extractionResult.extracted_data)?.amounts?.grand_total || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* New Vendor Modal */}
      <NewVendorModal
        open={showNewVendorModal}
        onClose={handleVendorModalClose}
        onVendorCreated={handleVendorCreated}
        prefillData={newVendorPrefillData}
        vendorName={extractionResult?.supplier_match?.candidate_name || newVendorPrefillData?.party_name}
      />
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Purchase Invoice Created</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              The purchase invoice has been successfully created from the extracted data.
            </p>
            <div className="flex space-x-2">
              <Button onClick={handleViewInvoice}>
                <Eye className="mr-2 h-4 w-4" />
                View Invoice
              </Button>
              <Button variant="outline" onClick={() => navigate('/app/purchases/register')}>
                View Register
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
