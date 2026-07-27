"use client";

import { type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

/**
 * Backwards-compatible modal API. New confirmation flows should use ConfirmDialog;
 * editor-style overlays can continue using Modal and receive the same focus trap,
 * Escape handling, scroll lock, and focus restoration as Dialog.
 */
export function Modal({
  open,
  title,
  description,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      {children}
    </Dialog>
  );
}
