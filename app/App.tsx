import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { CurrencyProvider } from './src/currency/CurrencyContext';
import { BalanceVisibilityProvider } from './src/wallet/BalanceVisibilityContext';
import { AppLockProvider, useAppLock } from './src/security/AppLockContext';
import { RefreshProvider } from './src/data/RefreshContext';
import { requestPushPermissionAndToken, hasShownPushPrompt, markPushPromptShown } from './src/notifications';
import { initCrashReporting, identifyCrashUser } from './src/crashReporting';
import { checkForUpdate, UpdateInfo } from './src/updateCheck';
import { api } from './src/api/client';
import LockScreen from './src/screens/LockScreen';
import UpdateModal from './src/components/UpdateModal';
import NotificationPromptModal from './src/components/NotificationPromptModal';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import WalletScreen from './src/screens/WalletScreen';
import TradeScreen from './src/screens/TradeScreen';
import P2PScreen from './src/screens/P2PScreen';
import GiftCardsScreen from './src/screens/GiftCardsScreen';
import BillsScreen from './src/screens/BillsScreen';
import DepositScreen from './src/screens/DepositScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaymentDetailsScreen from './src/screens/PaymentDetailsScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import Drawer, { ScreenKey } from './src/components/Drawer';
import BottomTabs from './src/components/BottomTabs';

function AuthGate() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  return mode === 'login' ? (
    <LoginScreen onGoToRegister={() => setMode('register')} />
  ) : (
    <RegisterScreen onGoToLogin={() => setMode('login')} />
  );
}

const TAB_SCREENS: ScreenKey[] = ['home', 'wallet', 'p2p', 'settings'];

function MainShell() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [screen, setScreen] = useState<ScreenKey>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const styles = getStyles();

  function navigate(key: ScreenKey) {
    setScreen(key);
    setDrawerOpen(false);
  }
  const goHome = () => navigate('home');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        {screen === 'home' && <HomeScreen onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate} />}
        {screen === 'wallet' && <WalletScreen onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate} colors={colors} />}
        {screen === 'trade' && <TradeScreen onBack={goHome} onNavigate={navigate} colors={colors} />}
        {screen === 'p2p' && <P2PScreen onBack={goHome} colors={colors} />}
        {screen === 'giftcards' && <GiftCardsScreen onBack={goHome} onNavigate={navigate} colors={colors} />}
        {screen === 'bills' && <BillsScreen onBack={goHome} colors={colors} />}
        {screen === 'deposit' && <DepositScreen onBack={goHome} colors={colors} />}
        {screen === 'withdraw' && <WithdrawScreen onBack={goHome} onNavigate={navigate} colors={colors} />}
        {screen === 'settings' && <SettingsScreen onBack={goHome} onNavigate={navigate} colors={colors} />}
        {screen === 'payment' && <PaymentDetailsScreen onBack={goHome} colors={colors} />}
      </View>

      {TAB_SCREENS.includes(screen) && <BottomTabs current={screen} onNavigate={navigate} colors={colors} />}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        current={screen}
        onNavigate={navigate}
        userName={user?.name ?? ''}
        userEmail={user?.email ?? ''}
        onLogout={() => {
          setDrawerOpen(false);
          logout();
        }}
        colors={colors}
      />
    </View>
  );
}

function requestPush() {
  return requestPushPermissionAndToken(token => {
    api.saveFcmToken(token).catch(() => {});
  });
}

function Root() {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const { enabled, locked } = useAppLock();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    initCrashReporting();
  }, []);

  useEffect(() => {
    if (!user) return;
    identifyCrashUser(user.id);
    checkForUpdate().then(setUpdate);
    // Show the branded ask exactly once per device, ever - tracked locally
    // rather than via the OS permission status, since Android's notification
    // permission is binary (granted/denied) with no "never asked" state to
    // read back, so there's no reliable way to infer "first time" from it.
    hasShownPushPrompt()
      .then(shown => {
        if (!shown) setShowNotifPrompt(true);
        else requestPush();
      })
      .catch(() => setShowNotifPrompt(true));
  }, [user]);

  function enableNotifications() {
    requestPush();
    markPushPromptShown();
    setShowNotifPrompt(false);
  }

  function dismissNotificationPrompt() {
    markPushPromptShown();
    setShowNotifPrompt(false);
  }

  return (
    <>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      {!user ? (
        <AuthGate />
      ) : enabled && locked ? (
        <LockScreen colors={colors} />
      ) : user.isAdmin ? (
        <AdminDashboardScreen />
      ) : (
        <MainShell />
      )}
      <UpdateModal update={update} onDismiss={() => setUpdate(null)} colors={colors} />
      {user && (
        <NotificationPromptModal
          visible={showNotifPrompt}
          onEnable={enableNotifications}
          onDismiss={dismissNotificationPrompt}
          colors={colors}
        />
      )}
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <BalanceVisibilityProvider>
            <AppLockProvider>
              <AuthProvider>
                <RefreshProvider>
                  <Root />
                </RefreshProvider>
              </AuthProvider>
            </AppLockProvider>
          </BalanceVisibilityProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function getStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    body: { flex: 1 },
  });
}

export default App;
