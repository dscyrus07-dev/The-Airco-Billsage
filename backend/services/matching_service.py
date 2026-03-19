"""
Supplier and Product Matching Service for BillSage

Matches extracted supplier and product data against existing database records.
Uses exact matching, fuzzy matching, and GSTIN/HSN matching strategies.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from rapidfuzz import fuzz, process
except ImportError:
    raise ImportError("rapidfuzz not installed. Run: pip install rapidfuzz")

logger = logging.getLogger(__name__)


class MatchingService:
    """Service for matching suppliers and products"""
    
    def __init__(self, db: Session, company_id: str):
        """
        Initialize matching service
        
        Args:
            db: Database session
            company_id: Company ID for multi-tenant filtering
        """
        self.db = db
        self.company_id = company_id
        self.min_fuzzy_score = 80  # Minimum score for fuzzy match (0-100)
    
    @staticmethod
    def _clean_text(value: Any) -> Optional[str]:
        """
        Safely normalize text value, handling None and non-string types
        
        Args:
            value: Value to normalize (can be None, str, or other type)
            
        Returns:
            Cleaned string or None if value is empty/None
        """
        if value is None:
            return None
        
        if not isinstance(value, str):
            value = str(value)
        
        value = value.strip()
        return value if value else None
    
    def match_supplier(
        self, 
        supplier_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Match supplier against existing parties database
        
        Args:
            supplier_data: Normalized supplier data
            
        Returns:
            Dictionary containing:
                - matched: Boolean indicating if match found
                - party_id: Matched party ID (if found)
                - confidence: Match confidence (0.0-1.0)
                - match_method: Method used for matching
                - candidate: Matched party details
                - alternatives: List of alternative matches
        """
        try:
            name = supplier_data.get('name')
            gstin = supplier_data.get('gstin')
            pan = supplier_data.get('pan')
            
            # Strategy 1: Exact GSTIN match (highest priority)
            if gstin:
                match = self._match_by_gstin(gstin)
                if match:
                    logger.info(f"Supplier matched by GSTIN: {gstin}")
                    return {
                        'matched': True,
                        'party_id': match['id'],
                        'confidence': 1.0,
                        'match_method': 'gstin_exact',
                        'candidate': match,
                        'alternatives': []
                    }
            
            # Strategy 2: Exact PAN match
            if pan:
                match = self._match_by_pan(pan)
                if match:
                    logger.info(f"Supplier matched by PAN: {pan}")
                    return {
                        'matched': True,
                        'party_id': match['id'],
                        'confidence': 0.95,
                        'match_method': 'pan_exact',
                        'candidate': match,
                        'alternatives': []
                    }
            
            # Strategy 3: Exact name match
            if name:
                match = self._match_by_exact_name(name)
                if match:
                    logger.info(f"Supplier matched by exact name: {name}")
                    return {
                        'matched': True,
                        'party_id': match['id'],
                        'confidence': 0.90,
                        'match_method': 'name_exact',
                        'candidate': match,
                        'alternatives': []
                    }
            
            # Strategy 4: Fuzzy name match
            if name:
                matches = self._match_by_fuzzy_name(name)
                if matches:
                    best_match = matches[0]
                    alternatives = matches[1:3] if len(matches) > 1 else []
                    
                    logger.info(
                        f"Supplier matched by fuzzy name: {name} -> "
                        f"{best_match['party_name']} (score: {best_match['score']})"
                    )
                    
                    return {
                        'matched': True,
                        'party_id': best_match['id'],
                        'confidence': best_match['score'] / 100.0,
                        'match_method': 'name_fuzzy',
                        'candidate': best_match,
                        'alternatives': alternatives
                    }
            
            # No match found - prepare prefill data for new vendor creation
            logger.info(f"No supplier match found for: {name or 'Unknown'} - preparing new vendor prefill data")
            
            try:
                # Build prefill party data from extracted supplier information
                prefill_party = self._build_party_prefill_from_supplier(supplier_data)
                logger.info(f"Successfully built prefill data for new vendor: {name or 'Unknown'}")
                
                return {
                    'matched': False,
                    'party_id': None,
                    'confidence': 0.0,
                    'match_method': None,
                    'candidate': None,
                    'alternatives': [],
                    'requires_creation': True,
                    'candidate_name': name,
                    'prefill_party': prefill_party
                }
            except Exception as prefill_error:
                logger.error(f"Failed to build prefill data for supplier '{name or 'Unknown'}': {prefill_error}", exc_info=True)
                # Return error state that frontend can handle
                return {
                    'matched': False,
                    'party_id': None,
                    'confidence': 0.0,
                    'match_method': None,
                    'candidate': None,
                    'alternatives': [],
                    'requires_creation': False,
                    'error': f"Failed to prepare vendor data: {str(prefill_error)}"
                }
            
        except Exception as e:
            logger.error(f"Error during supplier matching: {e}", exc_info=True)
            return {
                'matched': False,
                'party_id': None,
                'confidence': 0.0,
                'match_method': None,
                'candidate': None,
                'alternatives': [],
                'requires_creation': False,
                'error': str(e)
            }
    
    def _match_by_gstin(self, gstin: str) -> Optional[Dict[str, Any]]:
        """Match supplier by GSTIN"""
        query = text("""
            SELECT id, party_name, display_name, gstin, pan, 
                   party_code, email, phone
            FROM parties
            WHERE company_id = :company_id
            AND is_supplier = true
            AND gstin = :gstin
            AND deleted_at IS NULL
            LIMIT 1
        """)
        
        result = self.db.execute(query, {
            'company_id': self.company_id,
            'gstin': gstin
        }).fetchone()
        
        if result:
            return {
                'id': str(result.id),
                'party_name': result.party_name,
                'display_name': result.display_name,
                'gstin': result.gstin,
                'pan': result.pan,
                'party_code': result.party_code,
                'email': result.email,
                'phone': result.phone
            }
        return None
    
    def _match_by_pan(self, pan: str) -> Optional[Dict[str, Any]]:
        """Match supplier by PAN"""
        query = text("""
            SELECT id, party_name, display_name, gstin, pan,
                   party_code, email, phone
            FROM parties
            WHERE company_id = :company_id
            AND is_supplier = true
            AND pan = :pan
            AND deleted_at IS NULL
            LIMIT 1
        """)
        
        result = self.db.execute(query, {
            'company_id': self.company_id,
            'pan': pan
        }).fetchone()
        
        if result:
            return {
                'id': str(result.id),
                'party_name': result.party_name,
                'display_name': result.display_name,
                'gstin': result.gstin,
                'pan': result.pan,
                'party_code': result.party_code,
                'email': result.email,
                'phone': result.phone
            }
        return None
    
    def _match_by_exact_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Match supplier by exact name (case-insensitive)"""
        query = text("""
            SELECT id, party_name, display_name, gstin, pan,
                   party_code, email, phone
            FROM parties
            WHERE company_id = :company_id
            AND is_supplier = true
            AND (LOWER(party_name) = LOWER(:name) OR LOWER(display_name) = LOWER(:name))
            AND deleted_at IS NULL
            LIMIT 1
        """)
        
        result = self.db.execute(query, {
            'company_id': self.company_id,
            'name': name
        }).fetchone()
        
        if result:
            return {
                'id': str(result.id),
                'party_name': result.party_name,
                'display_name': result.display_name,
                'gstin': result.gstin,
                'pan': result.pan,
                'party_code': result.party_code,
                'email': result.email,
                'phone': result.phone
            }
        return None
    
    def _match_by_fuzzy_name(self, name: str) -> List[Dict[str, Any]]:
        """Match supplier by fuzzy name matching"""
        # Get all suppliers for this company
        query = text("""
            SELECT id, party_name, display_name, gstin, pan,
                   party_code, email, phone
            FROM parties
            WHERE company_id = :company_id
            AND is_supplier = true
            AND deleted_at IS NULL
        """)
        
        results = self.db.execute(query, {
            'company_id': self.company_id
        }).fetchall()
        
        if not results:
            return []
        
        # Build list of candidates with names
        candidates = []
        for row in results:
            candidates.append({
                'id': str(row.id),
                'party_name': row.party_name,
                'display_name': row.display_name,
                'gstin': row.gstin,
                'pan': row.pan,
                'party_code': row.party_code,
                'email': row.email,
                'phone': row.phone,
                'search_name': row.display_name or row.party_name
            })
        
        # Perform fuzzy matching
        matches = []
        for candidate in candidates:
            score = fuzz.ratio(name.lower(), candidate['search_name'].lower())
            if score >= self.min_fuzzy_score:
                candidate['score'] = score
                matches.append(candidate)
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        
        return matches
    
    def match_product(
        self, 
        item_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Match product against existing products database
        
        Args:
            item_data: Normalized line item data
            
        Returns:
            Dictionary containing:
                - matched: Boolean indicating if match found
                - product_id: Matched product ID (if found)
                - confidence: Match confidence (0.0-1.0)
                - match_method: Method used for matching
                - candidate: Matched product details
        """
        try:
            description = item_data.get('description')
            hsn_sac = item_data.get('hsn_sac_code')
            
            # Strategy 1: Exact description match
            if description:
                match = self._match_product_by_exact_name(description)
                if match:
                    logger.info(f"Product matched by exact name: {description}")
                    return {
                        'matched': True,
                        'product_id': match['id'],
                        'confidence': 0.95,
                        'match_method': 'name_exact',
                        'candidate': match
                    }
            
            # Strategy 2: HSN/SAC code match
            if hsn_sac:
                match = self._match_product_by_hsn(hsn_sac)
                if match:
                    logger.info(f"Product matched by HSN/SAC: {hsn_sac}")
                    return {
                        'matched': True,
                        'product_id': match['id'],
                        'confidence': 0.85,
                        'match_method': 'hsn_exact',
                        'candidate': match
                    }
            
            # Strategy 3: Fuzzy description match
            if description:
                matches = self._match_product_by_fuzzy_name(description)
                if matches:
                    best_match = matches[0]
                    logger.info(
                        f"Product matched by fuzzy name: {description} -> "
                        f"{best_match['product_name']} (score: {best_match['score']})"
                    )
                    return {
                        'matched': True,
                        'product_id': best_match['id'],
                        'confidence': best_match['score'] / 100.0,
                        'match_method': 'name_fuzzy',
                        'candidate': best_match
                    }
            
            # No match found
            return {
                'matched': False,
                'product_id': None,
                'confidence': 0.0,
                'match_method': None,
                'candidate': None,
                'unresolved_data': item_data
            }
            
        except Exception as e:
            logger.error(f"Error matching product: {e}")
            return {
                'matched': False,
                'product_id': None,
                'confidence': 0.0,
                'match_method': None,
                'candidate': None,
                'error': str(e)
            }
    
    def _match_product_by_exact_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Match product by exact name"""
        query = text("""
            SELECT p.id, p.product_name, p.product_code, p.hsn_sac_code,
                   p.uom_id, u.uom_code, u.uom_name,
                   p.selling_price, p.purchase_price
            FROM products p
            LEFT JOIN units_of_measure u ON u.id = p.uom_id
            WHERE p.company_id = :company_id
            AND LOWER(p.product_name) = LOWER(:name)
            AND p.deleted_at IS NULL
            LIMIT 1
        """)
        
        result = self.db.execute(query, {
            'company_id': self.company_id,
            'name': name
        }).fetchone()
        
        if result:
            return {
                'id': str(result.id),
                'product_name': result.product_name,
                'product_code': result.product_code,
                'hsn_sac_code': result.hsn_sac_code,
                'uom_id': str(result.uom_id) if result.uom_id else None,
                'uom_code': result.uom_code,
                'uom_name': result.uom_name,
                'selling_price': float(result.selling_price) if result.selling_price else None,
                'purchase_price': float(result.purchase_price) if result.purchase_price else None
            }
        return None
    
    def _match_product_by_hsn(self, hsn_sac: str) -> Optional[Dict[str, Any]]:
        """Match product by HSN/SAC code"""
        query = text("""
            SELECT p.id, p.product_name, p.product_code, p.hsn_sac_code,
                   p.uom_id, u.uom_code, u.uom_name,
                   p.selling_price, p.purchase_price
            FROM products p
            LEFT JOIN units_of_measure u ON u.id = p.uom_id
            WHERE p.company_id = :company_id
            AND p.hsn_sac_code = :hsn_sac
            AND p.deleted_at IS NULL
            LIMIT 1
        """)
        
        result = self.db.execute(query, {
            'company_id': self.company_id,
            'hsn_sac': hsn_sac
        }).fetchone()
        
        if result:
            return {
                'id': str(result.id),
                'product_name': result.product_name,
                'product_code': result.product_code,
                'hsn_sac_code': result.hsn_sac_code,
                'uom_id': str(result.uom_id) if result.uom_id else None,
                'uom_code': result.uom_code,
                'uom_name': result.uom_name,
                'selling_price': float(result.selling_price) if result.selling_price else None,
                'purchase_price': float(result.purchase_price) if result.purchase_price else None
            }
        return None
    
    def _match_product_by_fuzzy_name(self, name: str) -> List[Dict[str, Any]]:
        """Match product by fuzzy name matching"""
        query = text("""
            SELECT p.id, p.product_name, p.product_code, p.hsn_sac_code,
                   p.uom_id, u.uom_code, u.uom_name,
                   p.selling_price, p.purchase_price
            FROM products p
            LEFT JOIN units_of_measure u ON u.id = p.uom_id
            WHERE p.company_id = :company_id
            AND p.deleted_at IS NULL
        """)
        
        results = self.db.execute(query, {
            'company_id': self.company_id
        }).fetchall()
        
        if not results:
            return []
        
        # Build list of candidates
        candidates = []
        for row in results:
            candidates.append({
                'id': str(row.id),
                'product_name': row.product_name,
                'product_code': row.product_code,
                'hsn_sac_code': row.hsn_sac_code,
                'uom_id': str(row.uom_id) if row.uom_id else None,
                'uom_code': row.uom_code,
                'uom_name': row.uom_name,
                'selling_price': float(row.selling_price) if row.selling_price else None,
                'purchase_price': float(row.purchase_price) if row.purchase_price else None
            })
        
        # Perform fuzzy matching
        matches = []
        for candidate in candidates:
            score = fuzz.ratio(name.lower(), candidate['product_name'].lower())
            if score >= self.min_fuzzy_score:
                candidate['score'] = score
                matches.append(candidate)
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        
        return matches


    def _build_party_prefill_from_supplier(self, supplier_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build party prefill data from extracted supplier information
        
        Args:
            supplier_data: Normalized supplier data from extraction
            
        Returns:
            Dictionary with party creation prefill data
        """
        # Safely extract available supplier fields using _clean_text helper
        # This prevents 'NoneType' object has no attribute 'strip' errors
        name = self._clean_text(supplier_data.get('name'))
        display_name = self._clean_text(supplier_data.get('display_name'))
        gstin = self._clean_text(supplier_data.get('gstin'))
        pan = self._clean_text(supplier_data.get('pan'))
        email = self._clean_text(supplier_data.get('email'))
        phone = self._clean_text(supplier_data.get('phone'))
        alternate_phone = self._clean_text(supplier_data.get('alternate_phone'))
        address = self._clean_text(supplier_data.get('address'))
        state = self._clean_text(supplier_data.get('state'))
        pin_code = self._clean_text(supplier_data.get('pin_code'))
        website = self._clean_text(supplier_data.get('website'))
        
        # Build prefill data matching PartyCreate schema
        prefill = {
            'party_type': 'supplier',
            'party_category': 'business'
        }
        
        # Add fields only if they have values (not None and not empty)
        if name:
            prefill['party_name'] = name
            # Use display_name if available, otherwise use name
            prefill['display_name'] = display_name if display_name else name
        
        if gstin:
            prefill['gstin'] = gstin
        
        if pan:
            prefill['pan'] = pan
        
        if email:
            prefill['email'] = email
        
        if phone:
            prefill['phone'] = phone
        
        if alternate_phone:
            prefill['alternate_phone'] = alternate_phone
        
        if address:
            prefill['address'] = address
        
        if state:
            prefill['state'] = state
        
        if pin_code:
            prefill['pin_code'] = pin_code
        
        if website:
            prefill['website'] = website
        
        # Add helpful note about source
        prefill['notes'] = "Auto-extracted from purchase upload. Please verify all details."
        
        # Log with safe name display
        supplier_name = name if name else "Unknown"
        logger.info(f"Built party prefill data with {len(prefill)} fields from supplier: {supplier_name}")
        
        return prefill


def get_matching_service(db: Session, company_id: str) -> MatchingService:
    """
    Get matching service instance
    
    Args:
        db: Database session
        company_id: Company ID for multi-tenant filtering
        
    Returns:
        MatchingService instance
    """
    return MatchingService(db, company_id)
