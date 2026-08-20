import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '@/components/UI';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ['AM', 'PM'] as const;

type Period = (typeof PERIODS)[number];

type TimeParts = { hour: number; minute: number; period: Period };

function dateToParts(date: Date): TimeParts {
  let hour = date.getHours();
  const period: Period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return { hour, minute: date.getMinutes(), period };
}

function partsToDate({ hour, minute, period }: TimeParts): Date {
  let h = hour;
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  const next = new Date();
  next.setHours(h, minute, 0, 0);
  return next;
}

export function formatTime12h(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

type Props = {
  visible: boolean;
  value: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

function PickerColumn<T extends string | number>({
  label,
  items,
  selected,
  onSelect,
  formatItem,
}: {
  label: string;
  items: readonly T[];
  selected: T;
  onSelect: (item: T) => void;
  formatItem?: (item: T) => string;
}) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <TouchableOpacity
              key={String(item)}
              style={[styles.columnItem, isSelected && styles.columnItemSelected]}
              onPress={() => onSelect(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.columnItemText, isSelected && styles.columnItemTextSelected]}>
                {formatItem ? formatItem(item) : String(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AppTimePickerModal({ visible, value, onConfirm, onClose }: Props) {
  const [parts, setParts] = useState<TimeParts>(() => dateToParts(value));

  useEffect(() => {
    if (visible) {
      setParts(dateToParts(value));
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Time</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <View style={styles.previewBox}>
            <Ionicons name="time-outline" size={22} color="#0d9488" />
            <Text style={styles.previewText}>
              {formatTime12h(partsToDate(parts))}
            </Text>
          </View>

          <View style={styles.columnsRow}>
            <PickerColumn
              label="Hour"
              items={HOURS}
              selected={parts.hour}
              onSelect={(hour) => setParts((prev) => ({ ...prev, hour }))}
            />
            <PickerColumn
              label="Min"
              items={MINUTES}
              selected={parts.minute}
              onSelect={(minute) => setParts((prev) => ({ ...prev, minute }))}
              formatItem={(m) => String(m).padStart(2, '0')}
            />
            <PickerColumn
              label=""
              items={PERIODS}
              selected={parts.period}
              onSelect={(period) => setParts((prev) => ({ ...prev, period }))}
            />
          </View>

          <View style={styles.footer}>
            <GradientButton label="Confirm Time" onPress={() => onConfirm(partsToDate(parts))} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#ccfbf1',
  },
  previewText: { fontSize: 22, fontWeight: '800', color: '#0d9488' },
  columnsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    height: 220,
  },
  column: { flex: 1 },
  columnLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  columnItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  columnItemSelected: {
    backgroundColor: '#0d9488',
  },
  columnItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  columnItemTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
