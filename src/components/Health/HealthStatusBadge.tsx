import React from 'react';
import { HealthStatus } from '../../lib/backend-health';

interface HealthStatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthStatusBadge({
  status,
  size = 'md',
  showLabel = true,
}: HealthStatusBadgeProps) {
  const getStatusColor = (s: HealthStatus) => {
    switch (s) {
      case 'healthy':
        return '#10b981';
      case 'degraded':
        return '#f59e0b';
      case 'unhealthy':
        return '#ef4444';
      default:
        return 'var(--text2)';
    }
  };

  const getStatusLabel = (s: HealthStatus) => {
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-full`}
        style={{ backgroundColor: color }}
      />
      {showLabel && (
        <span
          className={`${textSizeClasses[size]} font-medium`}
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
