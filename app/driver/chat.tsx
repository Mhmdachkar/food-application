import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../../src/screens/Shared/ChatScreen';

export default function DriverChatPage() {
  const { orderId, otherName } = useLocalSearchParams<{ orderId: string; otherName: string }>();
  return (
    <ChatScreen
      orderId={orderId ?? ''}
      otherPartyName={otherName ?? 'Customer'}
      otherPartyRole="customer"
    />
  );
}
