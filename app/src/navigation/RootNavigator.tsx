import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useThemeColors } from '@/theme';
import type { RootStackParamList } from './types';

import { LanguageSelectScreen } from '@/screens/auth/LanguageSelectScreen';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { CreateRoomScreen } from '@/screens/room/CreateRoomScreen';
import { JoinRoomScreen } from '@/screens/room/JoinRoomScreen';
import { RoomScreen } from '@/screens/room/RoomScreen';
import { SoloSetupScreen } from '@/screens/solo/SoloSetupScreen';
import { SoloGameScreen } from '@/screens/solo/SoloGameScreen';
import { CallerScreen } from '@/screens/caller/CallerScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { HowToPlayScreen } from '@/screens/profile/HowToPlayScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const session = useSessionStore((s) => s.session);
  const hasSelectedLanguage = useSettingsStore((s) => s.hasSelectedLanguage);
  const { colors } = useThemeColors();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}
    >
      {!hasSelectedLanguage ? (
        <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      ) : !session ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CreateRoom" component={CreateRoomScreen} />
          <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
          <Stack.Screen name="Room" component={RoomScreen} />
          <Stack.Screen name="SoloSetup" component={SoloSetupScreen} />
          <Stack.Screen name="SoloGame" component={SoloGameScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Caller" component={CallerScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
