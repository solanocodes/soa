import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { ChannelListScreen } from '../screens/community/ChannelListScreen';
import { ChannelScreen } from '../screens/community/ChannelScreen';

export type CommunityStackParamList = {
  ChannelList: undefined;
  Channel: {
    channelId: string;
    channelName: string;
  };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="ChannelList"
        component={ChannelListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Channel"
        component={ChannelScreen}
        options={({ route }) => ({
          headerTitle: route.params.channelName,
          headerBackTitle: 'Back',
        })}
      />
    </Stack.Navigator>
  );
}
