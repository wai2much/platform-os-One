import { cn } from '@/lib/cn';

export function Card({ className, ...props }) {
  return <div className={cn('rounded-lg border border-border bg-card shadow-card', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center justify-between px-5 pt-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold', className)} {...props} />;
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />;
}
