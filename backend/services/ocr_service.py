"""
OCR Service for BillSage Purchase Upload Pipeline

Uses EasyOCR to extract text from PDF and image files.
Handles multi-page PDFs and provides structured text output.
"""

import logging
import tempfile
import os
import hashlib
import threading
import time
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import io

# Try to import OCR dependencies, but don't fail if they're not available
try:
    import easyocr
    from pdf2image import convert_from_bytes
    from PIL import Image
    import cv2
    import numpy as np
    try:
        from pypdf import PdfReader
        PYPDF_AVAILABLE = True
    except ImportError:
        PdfReader = None
        PYPDF_AVAILABLE = False
    try:
        import torch
        TORCH_AVAILABLE = True
    except ImportError:
        torch = None
        TORCH_AVAILABLE = False
    OCR_AVAILABLE = True
except ImportError as e:
    logging.warning(f"OCR dependencies not available: {e}. OCR functionality will be disabled.")
    OCR_AVAILABLE = False
    # Define stubs for missing modules
    class Image:
        @staticmethod
        def open(data):
            raise NotImplementedError("OCR dependencies not installed")

    np = None
    cv2 = None
    easyocr = None
    convert_from_bytes = None
    PdfReader = None
    PYPDF_AVAILABLE = False
    torch = None
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)


def _raise_ocr_unavailable_error() -> None:
    raise RuntimeError(
        "OCR dependencies are not installed. Install easyocr, pdf2image, pillow, opencv-python-headless, numpy, and system package poppler-utils."
    )


class OCRService:
    """Service for extracting text from documents using EasyOCR"""

    def __init__(self, languages: Optional[List[str]] = None, use_gpu: Optional[bool] = None):
        """
        Initialize OCR service

        Args:
            languages: List of language codes for OCR (default: ['en'])
            use_gpu: Whether to use GPU for OCR (default: auto-detect)
        """
        self.languages = languages or ['en']
        self._reader = None
        self._reader_lock = threading.Lock()
        self._result_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_lock = threading.Lock()
        self._cache_ttl_seconds = int(os.getenv('OCR_CACHE_TTL_SECONDS', '3600'))
        self._cache_max_entries = int(os.getenv('OCR_CACHE_MAX_ENTRIES', '64'))
        self._max_pages = int(os.getenv('OCR_MAX_PAGES', '2'))
        self._preview_dpi = int(os.getenv('OCR_PREVIEW_DPI', '110'))
        self._digital_dpi = int(os.getenv('OCR_DIGITAL_DPI', '150'))
        self._standard_dpi = int(os.getenv('OCR_STANDARD_DPI', '200'))
        self._scanned_dpi = int(os.getenv('OCR_SCANNED_DPI', '250'))
        self._use_gpu = self._resolve_gpu_mode(use_gpu)
        if OCR_AVAILABLE:
            logger.info(f"OCR Service initialized with languages: {self.languages}")
        else:
            logger.warning("OCR Service initialized but OCR dependencies not available")

    def _resolve_gpu_mode(self, explicit: Optional[bool] = None) -> bool:
        if explicit is not None:
            return bool(explicit)

        force_cpu = os.getenv('OCR_FORCE_CPU', '').strip().lower() in {'1', 'true', 'yes', 'on'}
        if force_cpu:
            return False

        env_gpu = os.getenv('OCR_USE_GPU')
        if env_gpu is not None:
            return env_gpu.strip().lower() in {'1', 'true', 'yes', 'on'}

        if not TORCH_AVAILABLE or torch is None:
            return False

        try:
            return bool(torch.cuda.is_available())
        except Exception:
            return False

    def _cache_key(self, file_bytes: bytes, file_type: str, preprocess: bool, smart_ocr: bool, max_pages: int) -> str:
        digest = hashlib.md5(file_bytes).hexdigest()
        return f"{digest}:{file_type}:{int(preprocess)}:{int(smart_ocr)}:{max_pages}"

    def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self._cache_lock:
            cached = self._result_cache.get(cache_key)
            if not cached:
                return None
            if cached['expires_at'] <= now:
                self._result_cache.pop(cache_key, None)
                return None
            return cached['value']

    def _set_cached_result(self, cache_key: str, value: Dict[str, Any]) -> None:
        expires_at = time.time() + self._cache_ttl_seconds
        with self._cache_lock:
            if len(self._result_cache) >= self._cache_max_entries:
                oldest_key = min(self._result_cache.items(), key=lambda item: item[1]['expires_at'])[0]
                self._result_cache.pop(oldest_key, None)
            self._result_cache[cache_key] = {'value': value, 'expires_at': expires_at}

    def _clean_text(self, text: str) -> str:
        lines = []
        previous_line = None
        for raw_line in text.splitlines():
            line = ' '.join(raw_line.split()).strip()
            if not line:
                continue
            if line == previous_line:
                continue
            lines.append(line)
            previous_line = line
        return '\n'.join(lines).strip()

    def _extract_embedded_text_from_pdf(self, pdf_bytes: bytes, max_pages: int) -> Optional[Dict[str, Any]]:
        if not PYPDF_AVAILABLE or PdfReader is None:
            return None

        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            embedded_pages = []
            all_text = []
            all_confidences = []

            page_count = min(len(reader.pages), max_pages, self._max_pages)
            for page_number in range(page_count):
                page = reader.pages[page_number]
                text = page.extract_text() or ''
                cleaned_text = self._clean_text(text)
                if not cleaned_text:
                    continue

                embedded_pages.append({
                    'page_number': page_number + 1,
                    'text': cleaned_text,
                    'details': [],
                    'confidence': 1.0,
                    'source': 'embedded_text'
                })
                all_text.append(cleaned_text)
                all_confidences.append(1.0)

            combined_text = self._clean_text('\n\n--- Page Break ---\n\n'.join(all_text))
            if not combined_text or len(combined_text) < 50:
                return None

            return {
                'full_text': combined_text,
                'pages': embedded_pages,
                'total_pages': len(embedded_pages),
                'avg_confidence': sum(all_confidences) / len(all_confidences) if all_confidences else 0.0,
                'extraction_mode': 'embedded_text'
            }
        except Exception as e:
            logger.debug(f"Embedded PDF text extraction unavailable or failed: {e}")
            return None

    def _select_render_profile(self, pdf_bytes: bytes, preprocess: bool, max_pages: int) -> Tuple[int, bool, int]:
        preview_images = self.pdf_to_images(pdf_bytes, dpi=self._preview_dpi, max_pages=1)
        if not preview_images:
            return self._standard_dpi, preprocess, min(max_pages, self._max_pages)

        preview_text, preview_details = self.extract_text_from_image(preview_images[0], preprocess=False)
        preview_text = preview_text.strip()
        preview_confidence = (
            sum(detail['confidence'] for detail in preview_details) / len(preview_details)
            if preview_details else 0.0
        )

        preview_char_count = len(preview_text)
        if preview_char_count >= 120 and preview_confidence >= 0.72:
            return self._digital_dpi, False, min(max_pages, self._max_pages)
        if preview_char_count < 60 or preview_confidence < 0.45:
            return self._scanned_dpi, True, min(max_pages, self._max_pages)
        return self._standard_dpi, preprocess, min(max_pages, self._max_pages)

    @property
    def reader(self):
        """Lazy load EasyOCR reader"""
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()
        if self._reader is None:
            with self._reader_lock:
                if self._reader is None:
                    logger.info(f"Loading EasyOCR reader (gpu={self._use_gpu})...")
                    try:
                        self._reader = easyocr.Reader(self.languages, gpu=self._use_gpu)
                    except Exception:
                        if self._use_gpu:
                            logger.warning("GPU OCR initialization failed, falling back to CPU")
                            self._reader = easyocr.Reader(self.languages, gpu=False)
                            self._use_gpu = False
                        else:
                            raise
                    logger.info("EasyOCR reader loaded successfully")
        return self._reader

    def preprocess_image(self, image: Any, aggressive: bool = True) -> Any:
        """
        Preprocess image for better OCR results

        Args:
            image: Input image as numpy array

        Returns:
            Preprocessed image
        """
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        if aggressive:
            processed = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            processed = cv2.fastNlMeansDenoising(processed, None, 10, 7, 21)
        else:
            processed = cv2.equalizeHist(gray)
            processed = cv2.GaussianBlur(processed, (3, 3), 0)

        return processed

    def extract_text_from_image(
        self,
        image: Any,
        preprocess: bool = True
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract text from a single image

        Args:
            image: PIL Image object
            preprocess: Whether to preprocess the image

        Returns:
            Tuple of (combined_text, detailed_results)
        """
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()

        try:
            # Convert PIL Image to numpy array
            img_array = np.array(image)

            # Preprocess if requested
            if preprocess:
                img_array = self.preprocess_image(img_array, aggressive=True)

            # Perform OCR
            results = self.reader.readtext(img_array)

            # Extract text and details
            text_lines = []
            detailed_results = []

            for bbox, text, confidence in results:
                text_lines.append(text)
                detailed_results.append({
                    'text': text,
                    'confidence': float(confidence),
                    'bbox': bbox
                })

            # Combine text with newlines
            combined_text = '\n'.join(text_lines)

            return combined_text, detailed_results

        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            raise

    def pdf_to_images(self, pdf_bytes: bytes, dpi: int = 300, max_pages: Optional[int] = None) -> List[Any]:
        """
        Convert PDF bytes to list of PIL Images

        Args:
            pdf_bytes: PDF file content as bytes

        Returns:
            List of PIL Image objects (one per page)
        """
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()

        try:
            convert_kwargs = {'dpi': dpi}
            if max_pages is not None:
                convert_kwargs['first_page'] = 1
                convert_kwargs['last_page'] = max_pages
            images = convert_from_bytes(pdf_bytes, **convert_kwargs)
            logger.info(f"Converted PDF to {len(images)} images")
            return images
        except Exception as e:
            logger.error(f"Error converting PDF to images: {e}")
            raise

    def extract_text_from_pdf(
        self,
        pdf_bytes: bytes,
        preprocess: bool = True,
        max_pages: int = 2,
        smart_ocr: bool = True
    ) -> Dict[str, Any]:
        """
        Extract text from PDF file

        Args:
            pdf_bytes: PDF file content as bytes
            preprocess: Whether to preprocess images

        Returns:
            Dictionary containing:
                - full_text: Combined text from all pages
                - pages: List of per-page results
                - total_pages: Number of pages
                - avg_confidence: Average confidence score
        """
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()

        fallback_error: Optional[Exception] = None
        try:
            cache_key = self._cache_key(pdf_bytes, 'application/pdf', preprocess, smart_ocr, max_pages)
            cached_result = self._get_cached_result(cache_key)
            if cached_result is not None:
                logger.info(f"OCR cache hit for document {cache_key[:12]}")
                return cached_result

            embedded_text_result = self._extract_embedded_text_from_pdf(pdf_bytes, max_pages)
            if embedded_text_result is not None:
                self._set_cached_result(cache_key, embedded_text_result)
                logger.info(
                    f"Embedded text extraction completed: {embedded_text_result['total_pages']} pages, "
                    f"avg confidence: {embedded_text_result['avg_confidence']:.2%}"
                )
                return embedded_text_result

            if smart_ocr:
                render_dpi, render_preprocess, page_limit = self._select_render_profile(pdf_bytes, preprocess, max_pages)
            else:
                render_dpi, render_preprocess, page_limit = (self._standard_dpi, preprocess, min(max_pages, self._max_pages))

            # Convert PDF to images
            images = self.pdf_to_images(pdf_bytes, dpi=render_dpi, max_pages=page_limit)

            if not images:
                raise ValueError("No pages could be rendered from the PDF")

            images = images[:page_limit]

            # Extract text from each page
            pages_data = []
            all_text = []
            all_confidences = []

            for page_num, image in enumerate(images, start=1):
                logger.info(f"Processing page {page_num}/{len(images)}")

                text, details = self.extract_text_from_image(image, render_preprocess)

                # Calculate page confidence
                page_confidences = [d['confidence'] for d in details]
                avg_page_confidence = (
                    sum(page_confidences) / len(page_confidences)
                    if page_confidences else 0.0
                )

                if avg_page_confidence < 0.40 and render_dpi < self._scanned_dpi:
                    logger.info(f"Page {page_num} confidence low ({avg_page_confidence:.2%}); retrying at higher DPI")
                    retry_images = self.pdf_to_images(pdf_bytes, dpi=self._scanned_dpi, max_pages=page_num)
                    if retry_images:
                        retry_text, retry_details = self.extract_text_from_image(retry_images[-1], True)
                        retry_confidences = [d['confidence'] for d in retry_details]
                        retry_avg_confidence = (
                            sum(retry_confidences) / len(retry_confidences)
                            if retry_confidences else 0.0
                        )
                        if retry_avg_confidence >= avg_page_confidence:
                            text = retry_text
                            details = retry_details
                            avg_page_confidence = retry_avg_confidence

                pages_data.append({
                    'page_number': page_num,
                    'text': text,
                    'details': details,
                    'confidence': avg_page_confidence
                })

                all_text.append(text)
                all_confidences.extend(page_confidences)

            # Calculate overall confidence
            avg_confidence = (
                sum(all_confidences) / len(all_confidences)
                if all_confidences else 0.0
            )

            # Combine all text
            full_text = '\n\n--- Page Break ---\n\n'.join(all_text)
            full_text = self._clean_text(full_text)

            result = {
                'full_text': full_text,
                'pages': pages_data,
                'total_pages': len(images),
                'avg_confidence': avg_confidence,
                'extraction_mode': 'ocr'
            }

            self._set_cached_result(cache_key, result)

            logger.info(
                f"OCR completed: {len(images)} pages, "
                f"avg confidence: {avg_confidence:.2%}"
            )

            return result

        except Exception as e:
            fallback_error = e
            logger.warning(f"Smart OCR extraction failed, falling back to standard mode: {e}")

        try:
            fallback_cache_key = self._cache_key(pdf_bytes, 'application/pdf', preprocess, False, max_pages)
            cached_result = self._get_cached_result(fallback_cache_key)
            if cached_result is not None:
                logger.info(f"OCR fallback cache hit for document {fallback_cache_key[:12]}")
                return cached_result

            fallback_dpi = self._standard_dpi if self._standard_dpi else 200
            images = self.pdf_to_images(pdf_bytes, dpi=fallback_dpi, max_pages=min(max_pages, self._max_pages))
            if not images:
                raise ValueError("No pages could be rendered from the PDF")

            pages_data = []
            all_text = []
            all_confidences = []

            for page_num, image in enumerate(images, start=1):
                logger.info(f"Fallback OCR processing page {page_num}/{len(images)}")
                text, details = self.extract_text_from_image(image, preprocess)
                page_confidences = [d['confidence'] for d in details]
                avg_page_confidence = (
                    sum(page_confidences) / len(page_confidences)
                    if page_confidences else 0.0
                )
                pages_data.append({
                    'page_number': page_num,
                    'text': text,
                    'details': details,
                    'confidence': avg_page_confidence
                })
                all_text.append(text)
                all_confidences.extend(page_confidences)

            avg_confidence = (
                sum(all_confidences) / len(all_confidences)
                if all_confidences else 0.0
            )

            full_text = self._clean_text('\n\n--- Page Break ---\n\n'.join(all_text))
            result = {
                'full_text': full_text,
                'pages': pages_data,
                'total_pages': len(images),
                'avg_confidence': avg_confidence,
                'extraction_mode': 'smart_ocr',
                'fallback_used': True,
                'fallback_error': str(fallback_error) if fallback_error else None,
            }
            self._set_cached_result(fallback_cache_key, result)
            logger.info(
                f"Fallback OCR completed: {len(images)} pages, avg confidence: {avg_confidence:.2%}"
            )
            return result
        except Exception as fallback_exc:
            logger.error(f"Error extracting text from PDF after fallback: {fallback_exc}")
            raise fallback_exc from fallback_error

    def extract_text_from_file(
        self,
        file_bytes: bytes,
        file_type: str,
        preprocess: bool = True
    ) -> Dict[str, Any]:
        """
        Extract text from file (PDF or image)

        Args:
            file_bytes: File content as bytes
            file_type: MIME type or file extension
            preprocess: Whether to preprocess images

        Returns:
            Extraction result dictionary
        """
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()

        try:
            # Determine file type
            is_pdf = (
                file_type == 'application/pdf' or
                file_type.lower().endswith('.pdf')
            )

            if is_pdf:
                return self.extract_text_from_pdf(file_bytes, preprocess, max_pages=self._max_pages, smart_ocr=True)
            else:
                # Treat as image
                image = Image.open(io.BytesIO(file_bytes))
                text, details = self.extract_text_from_image(image, preprocess)

                confidences = [d['confidence'] for d in details]
                avg_confidence = (
                    sum(confidences) / len(confidences)
                    if confidences else 0.0
                )

                return {
                    'full_text': text,
                    'pages': [{
                        'page_number': 1,
                        'text': text,
                        'details': details,
                        'confidence': avg_confidence
                    }],
                    'total_pages': 1,
                    'avg_confidence': avg_confidence
                }

        except Exception as e:
            logger.error(f"Error extracting text from file: {e}")
            raise


# Singleton instance
_ocr_service_instance = None


def get_ocr_service(languages: Optional[List[str]] = None) -> OCRService:
    """
    Get singleton OCR service instance

    Args:
        languages: List of language codes (only used on first call)

    Returns:
        OCRService instance
    """
    global _ocr_service_instance

    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService(languages)

    return _ocr_service_instance
