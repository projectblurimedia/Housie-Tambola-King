import React, { useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { Button, Card, Header, Row, Screen, Spacer, Stepper, T } from '@/components/ui';
import { generateTicket, COLS } from '@/game/engine/ticket';
import { errorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { APP_NAME } from '@/constants/config';
import { spacing } from '@/theme';

function ticketHtml(cells: number[], serial: number): string {
  const rows = [0, 1, 2]
    .map(
      (r) =>
        `<tr>${cells
          .slice(r * COLS, r * COLS + COLS)
          .map((n) => (n ? `<td>${n}</td>` : '<td class="b"></td>'))
          .join('')}</tr>`,
    )
    .join('');
  return `<div class="t"><div class="h"><span>${APP_NAME}</span><span>#${serial}</span></div><table>${rows}</table></div>`;
}

function documentHtml(count: number): string {
  const tickets = Array.from({ length: count }, (_, i) => ticketHtml(generateTicket(), i + 1)).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { margin: 12mm; }
  body { font-family: -apple-system, Roboto, Arial, sans-serif; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .t { border: 2px solid #B45309; border-radius: 6px; padding: 4px; page-break-inside: avoid; }
  .h { display: flex; justify-content: space-between; font-size: 10px; color: #7C3AED; font-weight: 700; padding: 0 2px 3px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: 1px solid #D6C9A8; height: 26px; text-align: center; font-size: 16px; font-weight: 700; }
  td.b { background: #EFE6CF; }
</style></head><body><div class="grid">${tickets}</div></body></html>`;
}

export function PrintTicketsScreen() {
  const { t } = useTranslation();
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: documentHtml(count) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (err) {
      showToast({ variant: 'error', title: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t('caller.printTitle')} />
      <T muted>{t('caller.printSubtitle')}</T>
      <Spacer h={spacing.xl} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{t('caller.howMany')}</T>
          <Stepper value={count} min={1} max={60} onChange={setCount} />
        </Row>
      </Card>
      <Spacer h={spacing.xl} />
      <Button title={t('caller.generate')} variant="gold" icon="document-text" loading={busy} onPress={generate} />
    </Screen>
  );
}
