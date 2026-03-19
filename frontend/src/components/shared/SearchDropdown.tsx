import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Users, ShoppingCart, ArrowRight } from 'lucide-react';
import { globalSearch } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SearchResult {
  purchases: any[];
  sales: any[];
  vendors: any[];
  customers: any[];
}

export function SearchDropdown() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ purchases: [], sales: [], vendors: [], customers: [] });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const search = async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          const searchResults = await globalSearch(query);
          setResults(searchResults);
        } catch (error) {
          console.error('Search failed:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults({ purchases: [], sales: [], vendors: [], customers: [] });
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (type: string, item: any) => {
    const routes = {
      purchases: `/app/purchases/register`,
      sales: `/app/sales/register`,
      vendors: `/app/purchases/vendors`,
      customers: `/app/sales/customers`,
    };
    
    navigate(routes[type as keyof typeof routes]);
    setOpen(false);
    setQuery('');
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'purchases': return <ShoppingCart className="h-4 w-4" />;
      case 'sales': return <FileText className="h-4 w-4" />;
      case 'vendors':
      case 'customers': return <Users className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getResultLabel = (type: string, item: any) => {
    switch (type) {
      case 'purchases':
      case 'sales':
        return `${item.invoiceNo} - ${type === 'purchases' ? item.vendor : item.customer}`;
      case 'vendors':
      case 'customers':
        return `${item.name} (${item.gstin})`;
      default:
        return '';
    }
  };

  const hasResults = Object.values(results).some(arr => arr.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative h-8 w-64 justify-start text-sm text-muted-foreground"
          onClick={() => inputRef.current?.focus()}
        >
          <Search className="h-4 w-4 mr-2" />
          Search invoices, parties...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              ref={inputRef}
              placeholder="Type to search..."
              value={query}
              onValueChange={setQuery}
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            {isLoading && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            
            {!isLoading && !hasResults && query.trim() && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}

            {!isLoading && hasResults && (
              <>
                {results.purchases.length > 0 && (
                  <CommandGroup heading="Purchases">
                    {results.purchases.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect('purchases', item)}
                        className="flex items-center gap-2"
                      >
                        {getResultIcon('purchases')}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{getResultLabel('purchases', item)}</div>
                          <div className="text-xs text-muted-foreground">
                            ₹{item.totalAmount.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {results.sales.length > 0 && (
                  <CommandGroup heading="Sales">
                    {results.sales.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect('sales', item)}
                        className="flex items-center gap-2"
                      >
                        {getResultIcon('sales')}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{getResultLabel('sales', item)}</div>
                          <div className="text-xs text-muted-foreground">
                            ₹{item.totalAmount.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {results.vendors.length > 0 && (
                  <CommandGroup heading="Vendors">
                    {results.vendors.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect('vendors', item)}
                        className="flex items-center gap-2"
                      >
                        {getResultIcon('vendors')}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{getResultLabel('vendors', item)}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.category}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {results.customers.length > 0 && (
                  <CommandGroup heading="Customers">
                    {results.customers.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => handleSelect('customers', item)}
                        className="flex items-center gap-2"
                      >
                        {getResultIcon('customers')}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{getResultLabel('customers', item)}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.segment}
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
