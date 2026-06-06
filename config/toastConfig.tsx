import React from 'react';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#51CF66',
        borderLeftWidth: 5,
        backgroundColor: '#fff',
        height: 70,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
      }}
      text2Style={{
        fontSize: 14,
        color: '#666',
      }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#FF6B6B',
        borderLeftWidth: 5,
        backgroundColor: '#fff',
        height: 70,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
      }}
      text2Style={{
        fontSize: 14,
        color: '#666',
      }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#1B316C',
        borderLeftWidth: 5,
        backgroundColor: '#fff',
        height: 70,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
      }}
      text2Style={{
        fontSize: 14,
        color: '#666',
      }}
    />
  ),
};
