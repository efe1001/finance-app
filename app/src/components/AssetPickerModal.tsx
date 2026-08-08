import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, FlatList, Image, ActivityIndicator } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api, CoinPickerAsset } from '../api/client';

export type PickedAsset = { id: string; symbol: string; name?: string; thumb?: string };

// Shared by Trade and Swap so users aren't limited to the original 8-asset
// starter list - backed by CoinGecko's full catalog search, with coins that
// have a configured platform deposit address (depositSymbols) surfaced first,
// then ranked by market-cap popularity.
export default function AssetPickerModal({
  visible,
  onClose,
  onSelect,
  colors,
  depositSymbols,
  excludeSymbol,
  title = 'Select Asset',
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: PickedAsset) => void;
  colors: ThemeColors;
  depositSymbols?: Set<string>;
  excludeSymbol?: string;
  title?: string;
}) {
  const styles = getStyles(colors);
  const [query, setQuery] = useState('');
  const [top, setTop] = useState<CoinPickerAsset[]>([]);
  const [results, setResults] = useState<CoinPickerAsset[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadTop = useCallback(() => {
    setLoadingTop(true);
    api.crypto
      .top(60)
      .then(r => setTop(r.coins))
      .catch(() => {})
      .finally(() => setLoadingTop(false));
  }, []);

  useEffect(() => {
    if (visible) {
      loadTop();
      setQuery('');
      setResults([]);
    }
  }, [visible, loadTop]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api.crypto
        .search(query.trim())
        .then(r => setResults(r.coins))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const source = query.trim() ? results : top;
  const list = source
    .filter(c => c.symbol !== excludeSymbol)
    .slice()
    .sort((a, b) => {
      const aDep = depositSymbols?.has(a.symbol) ? 0 : 1;
      const bDep = depositSymbols?.has(b.symbol) ? 0 : 1;
      if (aDep !== bDep) return aDep - bDep;
      return (a.marketCapRank ?? 999999) - (b.marketCapRank ?? 999999);
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search any coin (e.g. Shiba Inu, PEPE)"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          {(loadingTop && !query.trim()) || searching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.signal} />
            </View>
          ) : null}
          <FlatList
            data={list}
            keyExtractor={c => c.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loadingTop && !searching ? (
                <Text style={styles.empty}>{query.trim() ? 'No coins found.' : 'Nothing to show.'}</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onSelect({ id: item.id, symbol: item.symbol, name: item.name, thumb: item.thumb });
                  onClose();
                }}>
                {item.thumb ? (
                  <Image source={{ uri: item.thumb }} style={styles.coinImg} />
                ) : (
                  <View style={styles.coinImgFallback}>
                    <Text style={styles.coinImgFallbackText}>{item.symbol.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowSymbol}>{item.symbol}</Text>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                </View>
                {depositSymbols?.has(item.symbol) && (
                  <View style={styles.depositBadge}>
                    <Text style={styles.depositBadgeText}>Deposit ready</Text>
                  </View>
                )}
                {item.priceUsd != null && (
                  <Text style={styles.rowPrice}>
                    ${item.priceUsd < 1 ? item.priceUsd.toPrecision(3) : item.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    card: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, height: '80%' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    close: { color: colors.muted, fontSize: 18 },
    search: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.ink, fontSize: 14, marginBottom: spacing.sm },
    loadingRow: { paddingVertical: spacing.lg, alignItems: 'center' },
    list: { flex: 1 },
    empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
    coinImg: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2 },
    coinImgFallback: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    coinImgFallbackText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
    rowText: { flex: 1 },
    rowSymbol: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    rowName: { color: colors.muted, fontSize: 11.5, marginTop: 1 },
    depositBadge: { backgroundColor: 'rgba(52,199,89,0.14)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, marginRight: spacing.xs },
    depositBadgeText: { color: colors.jade, fontSize: 9.5, fontWeight: '700' },
    rowPrice: { color: colors.muted, fontSize: 11.5 },
  });
}
