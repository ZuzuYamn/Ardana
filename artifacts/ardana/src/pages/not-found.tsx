import { Leaf } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Leaf className="w-10 h-10 text-muted-foreground opacity-50" />
        </div>
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">
            {t("not_found.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {t("not_found.desc")}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2"
        >
          {t("not_found.return")}
        </Link>
      </div>
    </div>
  );
}
