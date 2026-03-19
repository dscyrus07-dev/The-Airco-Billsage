"""
OCR Service for BillSage Purchase Upload Pipeline

Uses EasyOCR to extract text from PDF and image files.
Handles multi-page PDFs and provides structured text output.
"""

import logging
import tempfile
import os
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

logger = logging.getLogger(__name__)


def _raise_ocr_unavailable_error() -> None:
    raise RuntimeError(
        "OCR dependencies are not installed. Install easyocr, pdf2image, pillow, opencv-python-headless, numpy, and system package poppler-utils."
    )


class OCRService:
    """Service for extracting text from documents using EasyOCR"""

    def __init__(self, languages: Optional[List[str]] = None):
        """
        Initialize OCR service

        Args:
            languages: List of language codes for OCR (default: ['en'])
        """
        self.languages = languages or ['en']
        self._reader = None
        if OCR_AVAILABLE:
            logger.info(f"OCR Service initialized with languages: {self.languages}")
        else:
            logger.warning("OCR Service initialized but OCR dependencies not available")

    @property
    def reader(self):
        """Lazy load EasyOCR reader"""
        if not OCR_AVAILABLE:
            _raise_ocr_unavailable_error()
        if self._reader is None:
            logger.info("Loading EasyOCR reader...")
            self._reader = easyocr.Reader(self.languages, gpu=False)
            logger.info("EasyOCR reader loaded successfully")
        return self._reader

    def preprocess_image(self, image: Any) -> Any:
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

        # Apply adaptive thresholding
        processed = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )

        # Denoise
        processed = cv2.fastNlMeansDenoising(processed, None, 10, 7, 21)

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
                img_array = self.preprocess_image(img_array)

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

    def pdf_to_images(self, pdf_bytes: bytes) -> List[Any]:
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
            images = convert_from_bytes(pdf_bytes, dpi=300)
            logger.info(f"Converted PDF to {len(images)} images")
            return images
        except Exception as e:
            logger.error(f"Error converting PDF to images: {e}")
            raise

    def extract_text_from_pdf(
        self,
        pdf_bytes: bytes,
        preprocess: bool = True
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

        try:
            # Convert PDF to images
            images = self.pdf_to_images(pdf_bytes)

            # Extract text from each page
            pages_data = []
            all_text = []
            all_confidences = []

            for page_num, image in enumerate(images, start=1):
                logger.info(f"Processing page {page_num}/{len(images)}")

                text, details = self.extract_text_from_image(image, preprocess)

                # Calculate page confidence
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

            # Calculate overall confidence
            avg_confidence = (
                sum(all_confidences) / len(all_confidences)
                if all_confidences else 0.0
            )

            # Combine all text
            full_text = '\n\n--- Page Break ---\n\n'.join(all_text)

            result = {
                'full_text': full_text,
                'pages': pages_data,
                'total_pages': len(images),
                'avg_confidence': avg_confidence
            }

            logger.info(
                f"OCR completed: {len(images)} pages, "
                f"avg confidence: {avg_confidence:.2%}"
            )

            return result

        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise

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
                return self.extract_text_from_pdf(file_bytes, preprocess)
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
