import React from 'react';
import { ExecutionStatus } from '../types';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ExecutionStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
  };

  if (status === 'done') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${sizeClasses[size]}`}
      >
        {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
        <span>انجام شده</span>
      </span>
    );
  }

  if (status === 'late') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-300 ${sizeClasses[size]}`}
      >
        {showIcon && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
        <span>دیر انجام شده</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-rose-100 text-rose-800 border border-rose-300 ${sizeClasses[size]}`}
    >
      {showIcon && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
      <span>انجام نشده</span>
    </span>
  );
};
