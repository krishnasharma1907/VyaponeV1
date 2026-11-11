import React, { forwardRef } from "react";

export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  "aria-label"?: string;
}

/**
 * Accessible Responsive Table Container
 *
 * Wraps table in a scrollable container with tabIndex={0} and role="region"
 * so keyboard users can scroll wide data tables horizontally on mobile viewports.
 */
export const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(
  ({ children, className = "", "aria-label": ariaLabel = "Data table", ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`ui-table-container ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TableContainer.displayName = "TableContainer";

export type TableProps = React.TableHTMLAttributes<HTMLTableElement>;

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <table ref={ref} className={`ui-table ${className}`.trim()} {...props}>
        {children}
      </table>
    );
  },
);
Table.displayName = "Table";

export type TableCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>;

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <caption ref={ref} className={`ui-table-caption ${className}`.trim()} {...props}>
        {children}
      </caption>
    );
  },
);
TableCaption.displayName = "TableCaption";

export type TableHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>;

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <thead ref={ref} className={`ui-table-header ${className}`.trim()} {...props}>
        {children}
      </thead>
    );
  },
);
TableHeader.displayName = "TableHeader";

export type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <tbody ref={ref} className={`ui-table-body ${className}`.trim()} {...props}>
        {children}
      </tbody>
    );
  },
);
TableBody.displayName = "TableBody";

export type TableFooterProps = React.HTMLAttributes<HTMLTableSectionElement>;

export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <tfoot ref={ref} className={`ui-table-footer ${className}`.trim()} {...props}>
        {children}
      </tfoot>
    );
  },
);
TableFooter.displayName = "TableFooter";

export type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>;

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <tr ref={ref} className={`ui-table-row ${className}`.trim()} {...props}>
        {children}
      </tr>
    );
  },
);
TableRow.displayName = "TableRow";

export type TableHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ children, scope = "col", className = "", ...props }, ref) => {
    return (
      <th ref={ref} scope={scope} className={`ui-table-head ${className}`.trim()} {...props}>
        {children}
      </th>
    );
  },
);
TableHead.displayName = "TableHead";

export type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <td ref={ref} className={`ui-table-cell ${className}`.trim()} {...props}>
        {children}
      </td>
    );
  },
);
TableCell.displayName = "TableCell";
