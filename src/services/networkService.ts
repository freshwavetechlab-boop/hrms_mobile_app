import NetInfo from '@react-native-community/netinfo';

export const networkService = {
  subscribe(listener: Parameters<typeof NetInfo.addEventListener>[0]) {
    return NetInfo.addEventListener(listener);
  },
  fetch() {
    return NetInfo.fetch();
  },
};
