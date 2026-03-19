"""
Seed Default Product Data

Creates default UOMs and tax rates for new companies.
Safe to run multiple times - checks for existing data before inserting.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from config.database import get_db_session
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DEFAULT_UOMS = [
    {'uom_code': 'NOS', 'uom_name': 'Numbers'},
    {'uom_code': 'PCS', 'uom_name': 'Pieces'},
    {'uom_code': 'KG', 'uom_name': 'Kilograms'},
    {'uom_code': 'GM', 'uom_name': 'Grams'},
    {'uom_code': 'LTR', 'uom_name': 'Liters'},
    {'uom_code': 'ML', 'uom_name': 'Milliliters'},
    {'uom_code': 'MTR', 'uom_name': 'Meters'},
    {'uom_code': 'CM', 'uom_name': 'Centimeters'},
    {'uom_code': 'BOX', 'uom_name': 'Boxes'},
    {'uom_code': 'PACK', 'uom_name': 'Packs'},
    {'uom_code': 'SET', 'uom_name': 'Sets'},
    {'uom_code': 'PAIR', 'uom_name': 'Pairs'},
    {'uom_code': 'DOZEN', 'uom_name': 'Dozens'},
]


DEFAULT_TAX_RATES = [
    {
        'tax_name': 'GST 0%',
        'tax_type': 'gst',
        'cgst_rate': 0,
        'sgst_rate': 0,
        'igst_rate': 0,
        'cess_rate': 0
    },
    {
        'tax_name': 'GST 5%',
        'tax_type': 'gst',
        'cgst_rate': 2.5,
        'sgst_rate': 2.5,
        'igst_rate': 5,
        'cess_rate': 0
    },
    {
        'tax_name': 'GST 12%',
        'tax_type': 'gst',
        'cgst_rate': 6,
        'sgst_rate': 6,
        'igst_rate': 12,
        'cess_rate': 0
    },
    {
        'tax_name': 'GST 18%',
        'tax_type': 'gst',
        'cgst_rate': 9,
        'sgst_rate': 9,
        'igst_rate': 18,
        'cess_rate': 0
    },
    {
        'tax_name': 'GST 28%',
        'tax_type': 'gst',
        'cgst_rate': 14,
        'sgst_rate': 14,
        'igst_rate': 28,
        'cess_rate': 0
    },
    {
        'tax_name': 'Exempt',
        'tax_type': 'exempt',
        'cgst_rate': 0,
        'sgst_rate': 0,
        'igst_rate': 0,
        'cess_rate': 0
    },
    {
        'tax_name': 'Nil Rated',
        'tax_type': 'nil',
        'cgst_rate': 0,
        'sgst_rate': 0,
        'igst_rate': 0,
        'cess_rate': 0
    },
]


def seed_uoms_for_company(db, company_id: str):
    """Seed default UOMs for a company if they don't exist"""
    try:
        # Check if company already has UOMs
        check_query = text("""
            SELECT COUNT(*) FROM units_of_measure 
            WHERE company_id = :company_id
        """)
        
        result = db.execute(check_query, {'company_id': company_id}).fetchone()
        existing_count = result[0] if result else 0
        
        if existing_count > 0:
            logger.info(f"Company {company_id} already has {existing_count} UOMs, skipping seed")
            return existing_count
        
        # Insert default UOMs
        insert_query = text("""
            INSERT INTO units_of_measure (company_id, uom_code, uom_name, is_active, created_at)
            VALUES (:company_id, :uom_code, :uom_name, true, NOW())
        """)
        
        inserted = 0
        for uom in DEFAULT_UOMS:
            db.execute(insert_query, {
                'company_id': company_id,
                'uom_code': uom['uom_code'],
                'uom_name': uom['uom_name']
            })
            inserted += 1
        
        db.commit()
        logger.info(f"Seeded {inserted} default UOMs for company {company_id}")
        return inserted
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding UOMs for company {company_id}: {e}")
        raise


def seed_tax_rates_for_company(db, company_id: str):
    """Seed default tax rates for a company if they don't exist"""
    try:
        # Check if company already has tax rates
        check_query = text("""
            SELECT COUNT(*) FROM tax_rates 
            WHERE company_id = :company_id
        """)
        
        result = db.execute(check_query, {'company_id': company_id}).fetchone()
        existing_count = result[0] if result else 0
        
        if existing_count > 0:
            logger.info(f"Company {company_id} already has {existing_count} tax rates, skipping seed")
            return existing_count
        
        # Insert default tax rates
        insert_query = text("""
            INSERT INTO tax_rates (
                company_id, tax_name, tax_type, cgst_rate, sgst_rate, 
                igst_rate, cess_rate, is_active, created_at, updated_at
            )
            VALUES (
                :company_id, :tax_name, :tax_type, :cgst_rate, :sgst_rate,
                :igst_rate, :cess_rate, true, NOW(), NOW()
            )
        """)
        
        inserted = 0
        for tax_rate in DEFAULT_TAX_RATES:
            db.execute(insert_query, {
                'company_id': company_id,
                **tax_rate
            })
            inserted += 1
        
        db.commit()
        logger.info(f"Seeded {inserted} default tax rates for company {company_id}")
        return inserted
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding tax rates for company {company_id}: {e}")
        raise


def seed_all_companies():
    """Seed default data for all companies that don't have it"""
    db = get_db_session()
    
    try:
        # Get all active companies
        companies_query = text("""
            SELECT id, company_code, legal_name 
            FROM companies 
            WHERE deleted_at IS NULL
            ORDER BY created_at
        """)
        
        companies = db.execute(companies_query).fetchall()
        
        logger.info(f"Found {len(companies)} companies to check")
        
        for company in companies:
            company_id = str(company.id)
            logger.info(f"\nProcessing company: {company.legal_name} ({company.company_code})")
            
            # Seed UOMs
            uom_count = seed_uoms_for_company(db, company_id)
            
            # Seed tax rates
            tax_count = seed_tax_rates_for_company(db, company_id)
            
            logger.info(f"Completed seeding for {company.legal_name}: {uom_count} UOMs, {tax_count} tax rates")
        
        logger.info("\n✅ Seeding completed successfully for all companies")
        
    except Exception as e:
        logger.error(f"Error in seed_all_companies: {e}")
        raise
    finally:
        db.close()


def seed_specific_company(company_id: str):
    """Seed default data for a specific company"""
    db = get_db_session()
    
    try:
        logger.info(f"Seeding data for company {company_id}")
        
        uom_count = seed_uoms_for_company(db, company_id)
        tax_count = seed_tax_rates_for_company(db, company_id)
        
        logger.info(f"✅ Seeded {uom_count} UOMs and {tax_count} tax rates for company {company_id}")
        
    except Exception as e:
        logger.error(f"Error seeding company {company_id}: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Seed default product data')
    parser.add_argument('--company-id', help='Seed specific company by ID')
    parser.add_argument('--all', action='store_true', help='Seed all companies')
    
    args = parser.parse_args()
    
    if args.company_id:
        seed_specific_company(args.company_id)
    elif args.all:
        seed_all_companies()
    else:
        print("Usage:")
        print("  python seed_product_defaults.py --all")
        print("  python seed_product_defaults.py --company-id <uuid>")
