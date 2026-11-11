"use client";

import React, { forwardRef, useId } from "react";

export interface FieldContextValue {
  id: string;
  helperId: string;
  errorId: string;
  hasHelperText?: boolean;
  hasErrorMessage?: boolean;
  required?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}

export interface FieldProps {
  id?: string;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible Form Field Container
 *
 * Encapsulates accessible labeling, helper text, and validation error messages
 * using explicit htmlFor and aria-describedby associations.
 */
export function Field({
  id: customId,
  label,
  helperText,
  errorMessage,
  required,
  disabled,
  isInvalid: customIsInvalid,
  className = "",
  children,
}: FieldProps) {
  const autoId = useId();
  const id = customId || `field-${autoId}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const isInvalid = customIsInvalid || Boolean(errorMessage);

  const contextValue: FieldContextValue = {
    id,
    helperId,
    errorId,
    hasHelperText: Boolean(helperText),
    hasErrorMessage: Boolean(errorMessage),
    required,
    disabled,
    isInvalid,
  };

  return (
    <FieldContext.Provider value={contextValue}>
      <div className={`ui-field ${isInvalid ? "ui-field-invalid" : ""} ${className}`.trim()}>
        {label && (
          <label htmlFor={id} className="ui-field-label">
            {label}
            {required && (
              <span className="ui-field-required" aria-hidden="true">
                {" "}
                *
              </span>
            )}
          </label>
        )}
        <div className="ui-field-control">{children}</div>
        {helperText && !isInvalid && (
          <p id={helperId} className="ui-field-helper">
            {helperText}
          </p>
        )}
        {errorMessage && isInvalid && (
          <p id={errorId} className="ui-field-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id: explicitId,
      isInvalid: explicitInvalid,
      disabled: explicitDisabled,
      required: explicitRequired,
      className = "",
      ...props
    },
    ref,
  ) => {
    const context = useFieldContext();
    const id = explicitId || context?.id;
    const isInvalid = explicitInvalid ?? context?.isInvalid;
    const disabled = explicitDisabled ?? context?.disabled;
    const required = explicitRequired ?? context?.required;

    const describedBy =
      [
        context?.hasHelperText && !isInvalid ? context.helperId : null,
        context?.hasErrorMessage || isInvalid ? context?.errorId : null,
        props["aria-describedby"],
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        required={required}
        aria-required={required ? "true" : undefined}
        aria-invalid={isInvalid ? "true" : undefined}
        aria-describedby={describedBy}
        className={`ui-input ${isInvalid ? "ui-input-invalid" : ""} ${className}`.trim()}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  isInvalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      id: explicitId,
      isInvalid: explicitInvalid,
      disabled: explicitDisabled,
      required: explicitRequired,
      className = "",
      ...props
    },
    ref,
  ) => {
    const context = useFieldContext();
    const id = explicitId || context?.id;
    const isInvalid = explicitInvalid ?? context?.isInvalid;
    const disabled = explicitDisabled ?? context?.disabled;
    const required = explicitRequired ?? context?.required;

    const describedBy =
      [
        context?.hasHelperText && !isInvalid ? context.helperId : null,
        context?.hasErrorMessage || isInvalid ? context?.errorId : null,
        props["aria-describedby"],
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <textarea
        ref={ref}
        id={id}
        disabled={disabled}
        required={required}
        aria-required={required ? "true" : undefined}
        aria-invalid={isInvalid ? "true" : undefined}
        aria-describedby={describedBy}
        className={`ui-textarea ${isInvalid ? "ui-textarea-invalid" : ""} ${className}`.trim()}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  isInvalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id: explicitId,
      isInvalid: explicitInvalid,
      disabled: explicitDisabled,
      required: explicitRequired,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const context = useFieldContext();
    const id = explicitId || context?.id;
    const isInvalid = explicitInvalid ?? context?.isInvalid;
    const disabled = explicitDisabled ?? context?.disabled;
    const required = explicitRequired ?? context?.required;

    const describedBy =
      [
        context?.hasHelperText && !isInvalid ? context.helperId : null,
        context?.hasErrorMessage || isInvalid ? context?.errorId : null,
        props["aria-describedby"],
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <select
        ref={ref}
        id={id}
        disabled={disabled}
        required={required}
        aria-required={required ? "true" : undefined}
        aria-invalid={isInvalid ? "true" : undefined}
        aria-describedby={describedBy}
        className={`ui-select ${isInvalid ? "ui-select-invalid" : ""} ${className}`.trim()}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id: explicitId,
      label,
      disabled: explicitDisabled,
      required: explicitRequired,
      className = "",
      ...props
    },
    ref,
  ) => {
    const context = useFieldContext();
    const autoId = useId();
    const id = explicitId || context?.id || `checkbox-${autoId}`;
    const disabled = explicitDisabled ?? context?.disabled;
    const required = explicitRequired ?? context?.required;

    return (
      <label htmlFor={id} className={`ui-checkbox-label ${disabled ? "ui-checkbox-disabled" : ""}`}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          disabled={disabled}
          required={required}
          aria-required={required ? "true" : undefined}
          className={`ui-checkbox ${className}`.trim()}
          {...props}
        />
        {label && <span className="ui-checkbox-text">{label}</span>}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
