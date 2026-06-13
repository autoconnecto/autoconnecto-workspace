import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../config/theme";

type Props = {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function JobCounter({ count, onIncrement, onDecrement, disabled, busy }: Props) {
  const canDecrement = count > 0 && !disabled && !busy;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Jobs this session</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.stepBtn, styles.stepBtnMinus, !canDecrement && styles.stepBtnDisabled]}
          onPress={onDecrement}
          disabled={!canDecrement}
          accessibilityLabel="Remove one job"
        >
          <Text style={[styles.stepGlyph, styles.stepGlyphMinus]}>−</Text>
        </Pressable>

        <View style={styles.countBox}>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.count}>{count}</Text>
          )}
        </View>

        <Pressable
          style={[styles.stepBtn, styles.stepBtnPlus, disabled && styles.stepBtnDisabled]}
          onPress={onIncrement}
          disabled={disabled || busy}
          accessibilityLabel="Add one job"
        >
          <Text style={[styles.stepGlyph, styles.stepGlyphPlus]}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Tap + after each completed job. Tap − to undo the last one.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  stepBtn: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stepBtnMinus: {
    backgroundColor: colors.bgMuted,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepBtnPlus: {
    backgroundColor: colors.primary,
  },
  stepBtnDisabled: { opacity: 0.45 },
  stepGlyph: { fontWeight: "300", lineHeight: 52 },
  stepGlyphMinus: { fontSize: 44, color: colors.text },
  stepGlyphPlus: { fontSize: 48, color: "#fff" },
  countBox: {
    minWidth: 88,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  count: { fontSize: 36, fontWeight: "800", color: colors.text },
  hint: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
});
