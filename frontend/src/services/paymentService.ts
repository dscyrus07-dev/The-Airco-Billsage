import { apiClient } from '@/api/client';

export interface PaymentCreateData {
  payment_date: string;
  payment_mode: 'bank' | 'cash' | 'upi' | 'cheque';
  amount: number;
  reference_number?: string;
  notes?: string;
  sales_invoice_id: string;
  proof_file?: File;
}

export interface Payment {
  id: string;
  payment_date: string;
  payment_mode: string;
  amount: number;
  currency: string;
  reference_number?: string;
  status: string;
  recon: string;
  notes?: string;
  recorded_by?: string;
  recorded_at?: string;
  created_at: string;
  updated_at: string;
  allocations: PaymentAllocation[];
  proof_files: PaymentProofFile[];
}

export interface PaymentAllocation {
  id: string;
  sales_invoice_id?: string;
  purchase_invoice_id?: string;
  amount_allocated: number;
  created_at: string;
}

export interface PaymentProofFile {
  id: string;
  file_id: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  created_at: string;
}

export interface PaymentHistory {
  payments: Payment[];
  total_paid: number;
  outstanding_amount: number;
}

export class PaymentService {
  private baseUrl = '/api/v1/payments';

  /**
   * Record a payment against a sales invoice with optional proof file
   */
  async recordPayment(data: PaymentCreateData): Promise<Payment> {
    const formData = new FormData();
    
    // Add form fields
    formData.append('payment_date', data.payment_date);
    formData.append('payment_mode', data.payment_mode);
    formData.append('amount', data.amount.toString());
    
    // Only append non-empty optional fields
    if (data.reference_number && data.reference_number.trim() !== '') {
      formData.append('reference_number', data.reference_number);
    }
    
    if (data.notes && data.notes.trim() !== '') {
      formData.append('notes', data.notes);
    }
    
    // Add file if provided
    if (data.proof_file) {
      formData.append('proof_file', data.proof_file);
    }

    try {
      const response = await apiClient.postFormData<Payment>(
        `${this.baseUrl}/sales/${data.sales_invoice_id}/record`,
        formData
      );

      return response;
    } catch (error: any) {
      console.error('Payment recording error:', error);
      
      // Extract detailed validation errors if available
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const validationErrors = error.response.data.detail;
          const errorMessages = validationErrors.map((err: any) => 
            `${err.loc?.join('.')} - ${err.msg}`
          ).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        } else {
          throw new Error(error.response.data.detail);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get payment history for a sales invoice
   */
  async getInvoicePaymentHistory(invoiceId: string): Promise<PaymentHistory> {
    const response = await apiClient.get<PaymentHistory>(
      `${this.baseUrl}/sales/${invoiceId}/history`
    );

    return response;
  }

  /**
   * Get payment details by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment> {
    const response = await apiClient.get<Payment>(
      `${this.baseUrl}/${paymentId}`
    );

    return response;
  }
}

export const paymentService = new PaymentService();
