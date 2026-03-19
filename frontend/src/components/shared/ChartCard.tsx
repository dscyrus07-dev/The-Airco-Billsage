import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function ChartCard({ title, description, children, isLoading, className }: ChartCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            {description && <Skeleton className="h-4 w-48" />}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="space-y-2 mb-6">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
    </Card>
  );
}
