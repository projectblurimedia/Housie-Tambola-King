import React from 'react';
import { StyleSheet, View } from 'react-native';
import i18n from '@/localization/i18n';
import { reportCrash } from '@/services/crashReporter';
import { Button, T } from './ui';

/**
 * Catches a crash inside a screen so the player sees a "something went wrong — try again" card
 * instead of an empty screen. Retry re-mounts the screen (data comes back from the server).
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onBack?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Shown to the player as a retry card; sent to admin web → Crashes.
    reportCrash(error, { source: 'boundary' });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <T style={{ fontSize: 46, lineHeight: 56 }}>😵</T>
        <T variant="h2" center>
          {i18n.t('errors.screenCrashed')}
        </T>
        <T muted center>
          {i18n.t('errors.screenCrashedHint')}
        </T>
        <Button title={i18n.t('common.retry')} icon="refresh" variant="gold" onPress={() => this.setState({ error: null })} />
        {this.props.onBack ? <Button title={i18n.t('common.back')} variant="ghost" onPress={this.props.onBack} /> : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
});
