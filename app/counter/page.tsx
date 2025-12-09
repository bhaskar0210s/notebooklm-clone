'use client'; // Required because we're using hooks

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast'; // This is the custom hook

export default function ToastExample() {
  const toast = useToast(); // Get the toast object with success, error, and info methods

  const showSuccessToast = () => {
    toast.success("Your action was completed successfully.");
  };

  const showErrorToast = () => {
    toast.error("Something went wrong. Please try again.");
  };

  const showInfoToast = () => {
    toast.info("This is a custom toast message.");
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Toast Notifications Demo</h1>
      
      <Button onClick={showSuccessToast}>
        Show Success Toast
      </Button>
      
      <Button onClick={showErrorToast} variant="destructive">
        Show Error Toast
      </Button>
      
      <Button onClick={showInfoToast} variant="outline">
        Show Info Toast
      </Button>
    </div>
  );
}

