import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    logger.warn("404 — rota inexistente", {
      path: location.pathname,
      module: "router",
    });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">{t('notFoundPage.title')}</h1>
        <p className="text-xl text-muted-foreground">{t('notFoundPage.subtitle')}</p>
        <Button asChild>
          <Link to="/">{t('notFoundPage.returnHome')}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
