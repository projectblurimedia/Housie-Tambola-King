import i18n from '@/localization/i18n';
import type { Room } from '@/types/api';

/** "Game 3 of 5" for a fixed series, otherwise "Game 3" (normal rooms and unlimited series). */
export function gameLabel(room: Pick<Room, 'kind' | 'seriesLength' | 'totalGames'>, gameNo: number): string {
  return room.kind === 'series' && room.seriesLength > 0
    ? i18n.t('room.gameOfSeries', { n: gameNo, total: room.totalGames })
    : i18n.t('room.game', { n: gameNo });
}
