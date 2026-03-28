import React from 'react';
import { theme as C } from '@/styles/theme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  isLoading,
  ...props
}: ButtonProps) {
  type VariantStyle = { bg: string; hover: string; text: string; border?: string };
  
  const variants: Record<string, VariantStyle> = {
    primary: {
      bg: C.blue,
      hover: '#5C9FFF',
      text: '#000',
    },
    secondary: {
      bg: C.surface,
      hover: C.card,
      text: C.text,
      border: C.border,
    },
    danger: {
      bg: C.red,
      hover: '#FF6680',
      text: '#000',
    },
    ghost: {
      bg: 'transparent',
      hover: C.surface,
      text: C.muted,
    },
  };

  const sizes = {
    sm: { px: '12px', py: '6px', fontSize: '12px' },
    md: { px: '16px', py: '8px', fontSize: '14px' },
    lg: { px: '24px', py: '12px', fontSize: '16px' },
  };

  const style = variants[variant];
  const sizeStyle = sizes[size];

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-lg ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: style.border ? `1px solid ${style.border}` : 'none',
        padding: `${sizeStyle.py} ${sizeStyle.px}`,
        fontSize: sizeStyle.fontSize,
        opacity: disabled || isLoading ? 0.5 : 1,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      }}
      disabled={disabled || isLoading}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = style.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = style.bg;
      }}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}
