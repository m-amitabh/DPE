import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Project } from "@/lib/types";

interface DeleteConfirmationDialogProps {
  open: boolean;
  project: Project | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  project,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmationDialogProps) {
  if (!project) return null;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Delete Project?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Are you sure you want to delete <strong>{project.name}</strong>?
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">
              ⚠️ This action is irreversible and cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
