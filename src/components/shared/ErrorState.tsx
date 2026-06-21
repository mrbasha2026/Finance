import { WifiOff, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "تعذّر تحميل البيانات", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-destructive/10">
        <WifiOff size={22} className="text-destructive" />
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground mt-0.5">تحقق من الاتصال بالإنترنت وحاول مرة أخرى</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <RefreshCw size={13} />
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
