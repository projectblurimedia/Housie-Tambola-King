import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LanguageSelect: undefined;
  Welcome: undefined;
  Home: undefined;
  CreateRoom: undefined;
  /** auto: opened from a shared room link — send the join request straight away. */
  JoinRoom: { code?: string; auto?: boolean } | undefined;
  Room: { roomId: string };
  /** A room this player left: standings + game-by-game, read only. */
  RoomHistory: { roomId: string; title: string };
  Caller: undefined;
  Profile: undefined;
  EditProfile: undefined;
  HowToPlay: undefined;
  /** A party game's details: create (rounds) or join with a code. */
  PartyIntro: { kind: 'seeta' | 'show' };
  Party: { partyId: string };
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
