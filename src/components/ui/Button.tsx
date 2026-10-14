import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}) => {
  let sizeClasses = 'px-4 py-2 text-sm';
  if (size === 'sm') sizeClasses = 'px-3 py-1.5 text-xs';
  if (size === 'lg') sizeClasses = 'px-6 py-3 text-base';
  if (size === 'icon') sizeClasses = 'p-2 w-9 h-9 flex items-center justify-center';

  let variantClass = 'btn-primary';
  if (variant === 'secondary') {
    variantClass = 'btn-secondary';
  } else if (variant === 'ghost') {
    variantClass =
      'bg-transparent hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)]';
  } else if (variant === 'danger') {
    variantClass =
      'bg-red-950/40 text-red-400 border border-red-800/50 hover:bg-red-900/50 hover:border-red-600';
  }

  return (
    <button
      className={`relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded-[var(--radius)] disabled:opacity-40 disabled:cursor-not-allowed select-none ${variantClass} ${sizeClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
