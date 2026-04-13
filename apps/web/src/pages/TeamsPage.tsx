import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';

export function TeamsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('pages.teams.title')} subtitle={t('pages.teams.subtitle')} />
      <ListPageFrame
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Button variant="ghost" disabled>
              {t('app.actions.export')}
            </Button>
          </>
        }
      >
        <EmptyState />
      </ListPageFrame>
    </div>
  );
}
