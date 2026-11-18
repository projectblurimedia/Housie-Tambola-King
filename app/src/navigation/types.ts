import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LanguageSelect: undefined;
  Welcome: undefined;
  Home: undefined;
  CreateRoom: undefined;
  JoinRoom: { code?: string } | undefined;
  Room: { roomId: string };
  Caller: undefined;
  Profile: undefined;
  EditProfile: undefined;
  HowToPlay: undefined;
};

export type ScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
