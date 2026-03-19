"""
LLM Extraction Service for BillSage Purchase Upload Pipeline

Uses Arcee AI Trinity Mini via OpenRouter API to extract structured purchase data
from OCR text. Converts unstructured invoice text into normalized JSON.
"""

import logging
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from openai import OpenAI
    from openai import APIError, APIConnectionError, RateLimitError, APIStatusError
except ImportError:
    raise ImportError("OpenAI library not installed. Run: pip install openai")

from config.settings import settings

logger = logging.getLogger(__name__)


class LLMExtractionError(Exception):
    """Base exception for LLM extraction errors"""
    pass


class LLMConfigurationError(LLMExtractionError):
    """Raised when LLM configuration is invalid"""
    pass


class LLMProviderError(LLMExtractionError):
    """Raised when LLM provider returns an error"""
    def __init__(self, message: str, status_code: Optional[int] = None, provider_message: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.provider_message = provider_message


class LLMResponseError(LLMExtractionError):
    """Raised when LLM response is invalid or unparseable"""
    pass


class LLMExtractionService:
    """Service for extracting structured purchase data using LLM"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize LLM extraction service
        
        Args:
            api_key: OpenRouter API key (reads from settings if not provided)
            
        Raises:
            LLMConfigurationError: If configuration is invalid
        """
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        
        if not self.api_key:
            raise LLMConfigurationError(
                "OPENROUTER_API_KEY is not configured. "
                "Please set it in your .env file to use LLM extraction. "
                "Get your API key from: https://openrouter.ai/"
            )
        
        # Get model configuration from settings
        self.model = settings.OPENROUTER_MODEL
        self.fallback_models = settings.OPENROUTER_FALLBACK_MODELS
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.temperature = settings.LLM_TEMPERATURE
        self.max_input_chars = settings.LLM_MAX_INPUT_CHARS
        self.max_retries = settings.LLM_MAX_RETRIES
        self.retry_delay_seconds = settings.LLM_RETRY_DELAY_SECONDS
        
        # Validate model configuration
        if self.model in settings.INVALID_MODEL_SLUGS:
            raise LLMConfigurationError(
                f"Invalid model slug configured: '{self.model}'. "
                f"This model ID is not valid on OpenRouter. "
                f"Please use 'arcee-ai/trinity-mini:free' for the free tier or "
                f"'arcee-ai/trinity-mini' for the paid tier."
            )
        
        # Initialize OpenAI client with OpenRouter base URL
        try:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=settings.OPENROUTER_BASE_URL
            )
        except Exception as e:
            raise LLMConfigurationError(f"Failed to initialize OpenRouter client: {str(e)}")
        
        logger.info(f"LLM Extraction Service initialized with model: {self.model}")
    
    def _extract_content_from_response(self, response) -> str:
        """
        Safely extract text content from OpenRouter/OpenAI response object.
        
        Handles various response shapes:
        - Standard string content
        - Structured content parts (list)
        - Missing or None content
        - Empty choices array
        
        Args:
            response: OpenAI/OpenRouter API response object
            
        Returns:
            Extracted text content as string
            
        Raises:
            LLMResponseError: If content cannot be extracted
        """
        try:
            # Check if choices exist
            if not hasattr(response, 'choices') or not response.choices:
                logger.error("LLM response missing 'choices' field or choices is empty")
                raise LLMResponseError("LLM returned empty or invalid response structure: no choices")
            
            # Get first choice
            first_choice = response.choices[0]
            
            # Check if message exists
            if not hasattr(first_choice, 'message'):
                logger.error("LLM response choice missing 'message' field")
                raise LLMResponseError("LLM returned invalid response structure: no message in choice")
            
            message = first_choice.message
            
            # Check if content exists
            if not hasattr(message, 'content'):
                logger.error("LLM response message missing 'content' field")
                raise LLMResponseError("LLM returned invalid response structure: no content in message")
            
            content = message.content
            
            # Handle None content
            if content is None:
                logger.error("LLM response content is None")
                logger.debug(f"Response shape - choices: {len(response.choices)}, finish_reason: {getattr(first_choice, 'finish_reason', 'unknown')}")
                raise LLMResponseError("LLM returned empty response content (None)")
            
            # Handle string content (most common case)
            if isinstance(content, str):
                content_stripped = content.strip()
                if not content_stripped:
                    logger.error("LLM response content is empty string after stripping")
                    raise LLMResponseError("LLM returned empty response content (empty string)")
                logger.debug(f"Extracted string content: {len(content_stripped)} chars")
                return content_stripped
            
            # Handle structured content (list of parts)
            if isinstance(content, list):
                logger.debug(f"LLM response content is structured list with {len(content)} parts")
                text_parts = []
                for part in content:
                    if isinstance(part, dict) and 'text' in part:
                        text_parts.append(part['text'])
                    elif isinstance(part, str):
                        text_parts.append(part)
                
                combined_text = ''.join(text_parts).strip()
                if not combined_text:
                    logger.error("LLM response structured content produced empty text")
                    raise LLMResponseError("LLM returned structured content but no extractable text")
                
                logger.debug(f"Extracted structured content: {len(combined_text)} chars from {len(text_parts)} parts")
                return combined_text
            
            # Unknown content type
            content_type = type(content).__name__
            logger.error(f"LLM response content has unexpected type: {content_type}")
            raise LLMResponseError(f"LLM returned unexpected content type: {content_type}")
            
        except LLMResponseError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error extracting content from LLM response: {e}", exc_info=True)
            raise LLMResponseError(f"Failed to extract content from LLM response: {str(e)}")
    
    def _prepare_ocr_text(self, ocr_text: str) -> str:
        if not isinstance(ocr_text, str):
            raise ValueError(f"OCR text must be a string, got {type(ocr_text).__name__}")

        cleaned_text = ocr_text.strip()
        if not cleaned_text:
            raise ValueError("OCR text is empty after preprocessing")

        if len(cleaned_text) <= self.max_input_chars:
            return cleaned_text

        logger.warning(
            f"OCR text too large for LLM prompt ({len(cleaned_text)} chars). "
            f"Truncating to {self.max_input_chars} chars."
        )
        return cleaned_text[:self.max_input_chars]
    
    def _build_model_sequence(self) -> list[str]:
        models = [self.model, *self.fallback_models]
        ordered_models = []
        for model in models:
            if model and model not in ordered_models:
                ordered_models.append(model)
        return ordered_models
    
    def _call_llm_with_resilience(self, prompt: str, timeout: int):
        models_to_try = self._build_model_sequence()
        last_error: Optional[LLMProviderError] = None

        for model_index, model_name in enumerate(models_to_try):
            for attempt in range(1, self.max_retries + 2):
                try:
                    logger.info(
                        f"Calling OpenRouter model '{model_name}' "
                        f"(attempt {attempt}/{self.max_retries + 1})"
                    )
                    response = self.client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a specialized invoice data extraction AI. Extract structured data from invoice text and return only valid JSON."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        max_tokens=self.max_tokens,
                        temperature=self.temperature,
                        timeout=timeout,
                        extra_headers={
                            "HTTP-Referer": "http://localhost:3000",
                            "X-Title": "BillSage"
                        }
                    )
                    return response, model_name
                except APIStatusError as e:
                    error_msg = str(e)
                    status_code = e.status_code if hasattr(e, 'status_code') else None
                    logger.error(
                        f"OpenRouter API error for model '{model_name}' "
                        f"(attempt {attempt}/{self.max_retries + 1}, status {status_code}): {error_msg}"
                    )

                    if status_code == 400 and ('model' in error_msg.lower() or 'invalid' in error_msg.lower()):
                        last_error = LLMProviderError(
                            f"Invalid model configuration: {model_name}. "
                            f"The model ID is not recognized by OpenRouter. "
                            f"Please check your OPENROUTER_MODEL setting.",
                            status_code=400,
                            provider_message=error_msg
                        )
                        break

                    if status_code in {401, 403}:
                        last_error = LLMProviderError(
                            "OpenRouter API key is invalid or unauthorized. "
                            "Please verify OPENROUTER_API_KEY in the backend environment.",
                            status_code=status_code,
                            provider_message=error_msg
                        )
                        raise last_error

                    if status_code in {502, 503, 504} and attempt <= self.max_retries:
                        time.sleep(self.retry_delay_seconds * attempt)
                        continue

                    last_error = LLMProviderError(
                        f"OpenRouter API error on model '{model_name}': {error_msg}",
                        status_code=status_code,
                        provider_message=error_msg
                    )
                    if status_code in {502, 503, 504} and model_index < len(models_to_try) - 1:
                        break
                    raise last_error
                except (APIConnectionError, RateLimitError) as e:
                    logger.error(
                        f"OpenRouter connection/rate limit error for model '{model_name}' "
                        f"(attempt {attempt}/{self.max_retries + 1}): {e}"
                    )
                    if attempt <= self.max_retries:
                        time.sleep(self.retry_delay_seconds * attempt)
                        continue

                    last_error = LLMProviderError(
                        f"OpenRouter connection/rate limit error on model '{model_name}': {str(e)}",
                        status_code=502,
                        provider_message=str(e)
                    )
                    raise last_error

        if last_error:
            raise last_error
        raise LLMProviderError("LLM request failed before a provider response was received", status_code=502)
    
    def build_extraction_prompt(self, ocr_text: str) -> str:
        """
        Build prompt for LLM to extract purchase invoice data
        
        Args:
            ocr_text: Raw text extracted from OCR
            
        Returns:
            Formatted prompt string
        """
        prompt = f"""You are a specialized invoice data extraction AI. Extract structured purchase invoice information from the following OCR text.

OCR TEXT:
{ocr_text}

INSTRUCTIONS:
1. Extract ALL relevant invoice fields from the text above
2. Return ONLY valid JSON, no other text
3. Use null for missing fields
4. Normalize dates to YYYY-MM-DD format
5. Extract numeric values without currency symbols
6. For GST fields, extract GSTIN in standard 15-character format
7. For line items, extract all products/services listed
8. Infer missing totals if possible from line items

REQUIRED JSON STRUCTURE:
{{
  "supplier": {{
    "name": "string or null",
    "gstin": "string (15 chars) or null",
    "pan": "string (10 chars) or null",
    "address": "string or null",
    "phone": "string or null",
    "email": "string or null"
  }},
  "invoice": {{
    "invoice_number": "string or null",
    "invoice_date": "YYYY-MM-DD or null",
    "due_date": "YYYY-MM-DD or null",
    "place_of_supply": "string (state name) or null",
    "reverse_charge": false
  }},
  "amounts": {{
    "subtotal": 0.0,
    "discount_amount": 0.0,
    "taxable_amount": 0.0,
    "cgst_amount": 0.0,
    "sgst_amount": 0.0,
    "igst_amount": 0.0,
    "cess_amount": 0.0,
    "tds_amount": 0.0,
    "round_off": 0.0,
    "grand_total": 0.0
  }},
  "line_items": [
    {{
      "line_number": 1,
      "description": "string",
      "hsn_sac_code": "string or null",
      "quantity": 0.0,
      "unit": "string (e.g., PCS, KG, etc.)",
      "rate": 0.0,
      "discount_pct": 0.0,
      "discount_amount": 0.0,
      "taxable_amount": 0.0,
      "cgst_rate": 0.0,
      "cgst_amount": 0.0,
      "sgst_rate": 0.0,
      "sgst_amount": 0.0,
      "igst_rate": 0.0,
      "igst_amount": 0.0,
      "cess_rate": 0.0,
      "cess_amount": 0.0,
      "line_total": 0.0
    }}
  ],
  "extra_charges": [
    {{
      "description": "string (e.g., Freight, Packaging)",
      "amount": 0.0
    }}
  ],
  "notes": "string or null",
  "payment_terms": "string or null"
}}

Extract the data now. Return ONLY the JSON object, nothing else."""

        return prompt
    
    def parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse LLM response and extract JSON
        
        Args:
            response_text: Raw response from LLM (must be non-empty string)
            
        Returns:
            Parsed JSON dictionary
            
        Raises:
            LLMResponseError: If response is not valid JSON or input is invalid
        """
        # Validate input
        if response_text is None:
            logger.error("parse_llm_response called with None")
            raise LLMResponseError("Cannot parse LLM response: input is None")
        
        if not isinstance(response_text, str):
            logger.error(f"parse_llm_response called with non-string type: {type(response_text).__name__}")
            raise LLMResponseError(f"Cannot parse LLM response: input must be string, got {type(response_text).__name__}")
        
        # Trim whitespace
        response_text = response_text.strip()
        
        if not response_text:
            logger.error("parse_llm_response called with empty string")
            raise LLMResponseError("Cannot parse LLM response: input is empty")
        
        # Log preview of content being parsed
        preview_length = 300
        preview = response_text[:preview_length]
        if len(response_text) > preview_length:
            preview += "..."
        logger.debug(f"Parsing LLM response ({len(response_text)} chars): {preview}")
        
        try:
            # Try to parse as-is
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.debug(f"Direct JSON parse failed: {e}")
            
            # Try to extract JSON from markdown code blocks
            if '```json' in response_text:
                logger.debug("Attempting to extract JSON from ```json code fence")
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end > start:
                    json_str = response_text[start:end].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e2:
                        logger.error(f"Failed to parse JSON from ```json fence: {e2}")
                        raise LLMResponseError(f"LLM response contains invalid JSON in code fence: {str(e2)}")
            
            elif '```' in response_text:
                logger.debug("Attempting to extract JSON from ``` code fence")
                start = response_text.find('```') + 3
                end = response_text.find('```', start)
                if end > start:
                    json_str = response_text[start:end].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e2:
                        logger.error(f"Failed to parse JSON from ``` fence: {e2}")
                        raise LLMResponseError(f"LLM response contains invalid JSON in code fence: {str(e2)}")
            
            # Try to find JSON object in text
            logger.debug("Attempting to extract JSON object from text")
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start >= 0 and end > start:
                json_str = response_text[start:end]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError as e2:
                    logger.error(f"Failed to parse extracted JSON object: {e2}")
                    preview = json_str[:200] + "..." if len(json_str) > 200 else json_str
                    raise LLMResponseError(f"LLM response contains invalid JSON: {str(e2)}. Preview: {preview}")
            else:
                logger.error("No JSON structure found in LLM response")
                raise LLMResponseError(f"No valid JSON found in LLM response. Preview: {preview}")
    
    def extract_purchase_data(
        self, 
        ocr_text: str,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Extract structured purchase data from OCR text using LLM
        
        Args:
            ocr_text: Raw text from OCR
            timeout: Request timeout in seconds (uses settings default if not provided)
            
        Returns:
            Dictionary containing:
                - extracted_data: Structured purchase data
                - raw_response: Raw LLM response
                - confidence: Estimated confidence score
                - extraction_metadata: Additional metadata
                
        Raises:
            LLMProviderError: If LLM provider returns an error
            ValueError: If response cannot be parsed
        """
        if timeout is None:
            timeout = settings.LLM_TIMEOUT
            
        try:
            logger.info(f"Starting LLM extraction with model: {self.model}")
            
            # Build prompt
            prepared_ocr_text = self._prepare_ocr_text(ocr_text)
            prompt = self.build_extraction_prompt(prepared_ocr_text)
            
            # Call LLM
            start_time = datetime.now()
            
            response, used_model = self._call_llm_with_resilience(prompt, timeout)
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds()
            
            logger.info(f"LLM API call completed in {processing_time:.2f}s")
            
            # Log response shape for debugging
            logger.debug(f"Response shape - choices: {len(response.choices) if hasattr(response, 'choices') else 'N/A'}")
            
            # Safely extract response text using helper
            response_text = self._extract_content_from_response(response)
            
            logger.info(f"LLM response content extracted: {len(response_text)} chars")
            
            # Parse JSON from response
            extracted_data = self.parse_llm_response(response_text)
            
            # Calculate confidence based on completeness
            confidence = self._calculate_confidence(extracted_data)
            
            result = {
                'extracted_data': extracted_data,
                'raw_response': response_text,
                'confidence': confidence,
                'extraction_metadata': {
                    'model': used_model,
                    'processing_time_seconds': processing_time,
                    'tokens_used': response.usage.total_tokens if hasattr(response, 'usage') else None,
                    'finish_reason': response.choices[0].finish_reason,
                    'timestamp': datetime.now().isoformat()
                }
            }
            
            logger.info(f"Extraction completed with {confidence:.2%} confidence")
            
            return result
            
        except APIStatusError as e:
            # Handle OpenRouter API errors (400, 401, 403, 404, etc.)
            error_msg = str(e)
            status_code = e.status_code if hasattr(e, 'status_code') else None
            
            logger.error(f"OpenRouter API error (status {status_code}): {error_msg}")
            
            # Check for invalid model error
            if status_code == 400 and ('model' in error_msg.lower() or 'invalid' in error_msg.lower()):
                raise LLMProviderError(
                    f"Invalid model configuration: {self.model}. "
                    f"The model ID is not recognized by OpenRouter. "
                    f"Please check your OPENROUTER_MODEL setting.",
                    status_code=400,
                    provider_message=error_msg
                )
            
            raise LLMProviderError(
                f"OpenRouter API error: {error_msg}",
                status_code=status_code,
                provider_message=error_msg
            )
            
        except (APIConnectionError, RateLimitError) as e:
            # Handle connection and rate limit errors
            logger.error(f"OpenRouter connection/rate limit error: {e}")
            raise LLMProviderError(
                f"Failed to connect to OpenRouter: {str(e)}",
                status_code=502,
                provider_message=str(e)
            )
        
        except LLMResponseError as e:
            # Handle response extraction and parsing errors
            logger.error(f"LLM response error: {e}")
            raise
            
        except LLMProviderError:
            # Re-raise provider errors as-is
            raise
            
        except Exception as e:
            logger.error(f"Unexpected LLM extraction error: {e}", exc_info=True)
            raise LLMProviderError(f"Unexpected error during LLM extraction: {str(e)}")
    
    def _calculate_confidence(self, data: Dict[str, Any]) -> float:
        """
        Calculate confidence score based on data completeness
        
        Args:
            data: Extracted data dictionary
            
        Returns:
            Confidence score between 0.0 and 1.0
        """
        score = 0.0
        total_checks = 0
        
        # Check supplier fields (20% weight)
        supplier = data.get('supplier', {})
        if supplier:
            total_checks += 3
            if supplier.get('name'):
                score += 0.10
            if supplier.get('gstin'):
                score += 0.05
            if supplier.get('address'):
                score += 0.05
        
        # Check invoice fields (30% weight)
        invoice = data.get('invoice', {})
        if invoice:
            total_checks += 3
            if invoice.get('invoice_number'):
                score += 0.15
            if invoice.get('invoice_date'):
                score += 0.10
            if invoice.get('place_of_supply'):
                score += 0.05
        
        # Check amounts (30% weight)
        amounts = data.get('amounts', {})
        if amounts:
            total_checks += 2
            if amounts.get('grand_total', 0) > 0:
                score += 0.20
            if amounts.get('taxable_amount', 0) > 0:
                score += 0.10
        
        # Check line items (20% weight)
        line_items = data.get('line_items', [])
        if line_items:
            total_checks += 1
            if len(line_items) > 0:
                score += 0.20
        
        # Normalize to 0-1 range
        return min(1.0, max(0.0, score))


# Singleton instance
_llm_service_instance = None


def get_llm_extraction_service(api_key: Optional[str] = None) -> LLMExtractionService:
    """
    Get singleton LLM extraction service instance
    
    Args:
        api_key: OpenRouter API key (only used on first call)
        
    Returns:
        LLMExtractionService instance
    """
    global _llm_service_instance
    
    if _llm_service_instance is None:
        _llm_service_instance = LLMExtractionService(api_key)
    
    return _llm_service_instance
