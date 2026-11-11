"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DeleteConfirmDialog({
  open, onClose, onConfirm, title, description, cancelLabel, deleteLabel, pending, error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string | null;
  cancelLabel: string;
  deleteLabel: string;
  pending?: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent overlayClassName="bg-black/30 supports-backdrop-filter:backdrop-blur-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="flex-row justify-end">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>{cancelLabel}</Button>
          <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onConfirm}>{deleteLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
