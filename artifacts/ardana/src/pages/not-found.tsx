import { Leaf } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Leaf className="w-10 h-10 text-muted-foreground opacity-50" />
        </div>
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            The field you're looking for seems to be empty. Let's get you back to the main farm.
          </p>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
