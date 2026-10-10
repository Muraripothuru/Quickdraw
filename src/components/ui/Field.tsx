"use client";

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}

export function Field({ label, error, hint, children, htmlFor }: FieldProps) {
  return (
    <div>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-2 text-sm font-medium text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`field ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`field ${className}`} {...props} />;
}
