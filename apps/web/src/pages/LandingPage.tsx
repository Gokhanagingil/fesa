import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-amateur-canvas to-amateur-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl font-semibold text-amateur-accent">{t('app.name')}</p>
            <p className="text-sm text-amateur-muted">{t('app.tagline')}</p>
          </div>
          <LanguageSwitch />
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-amateur-border bg-amateur-surface px-3 py-1 text-xs font-medium text-amateur-muted">
              {t('landing.badge')}
            </p>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-amateur-ink sm:text-5xl">
              {t('landing.headline')}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-amateur-muted">{t('landing.sub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl bg-amateur-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amateur-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amateur-accent"
              >
                {t('landing.ctaPrimary')}
              </Link>
              <Link
                to="/portal/login"
                className="inline-flex items-center justify-center rounded-xl border border-amateur-border bg-amateur-surface px-4 py-2 text-sm font-semibold text-amateur-ink transition-colors hover:bg-amateur-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amateur-accent"
              >
                {t('landing.ctaPortal')}
              </Link>
              <a
                href="#about"
                className="inline-flex items-center justify-center rounded-xl border border-amateur-border bg-amateur-surface px-4 py-2 text-sm font-semibold text-amateur-ink transition-colors hover:bg-amateur-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amateur-accent"
              >
                {t('landing.ctaSecondary')}
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {[t('landing.pill1'), t('landing.pill2'), t('landing.pill3')].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-amateur-border bg-amateur-canvas px-3 py-1 text-xs font-medium text-amateur-muted"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
          <div
            id="about"
            className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm sm:p-8"
          >
            <p className="text-sm font-semibold text-amateur-accent">{t('app.name')}</p>
            <p className="mt-2 text-sm leading-relaxed text-amateur-muted">
              {t('pages.dashboard.subtitle')} {t('pages.groups.subtitle')}
            </p>
            <div className="mt-6 grid gap-3 text-sm text-amateur-muted">
              <div className="rounded-2xl bg-amateur-canvas px-4 py-3">
                <p className="font-medium text-amateur-ink">{t('pages.groups.title')}</p>
                <p className="mt-1">{t('pages.groups.subtitle')}</p>
              </div>
              <div className="rounded-2xl bg-amateur-canvas px-4 py-3">
                <p className="font-medium text-amateur-ink">{t('pages.teams.title')}</p>
                <p className="mt-1">{t('pages.teams.subtitle')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
