import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

type Props = {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onDone: (croppedUri: string) => void;
};

/**
 * In-app square cropper so we control header contrast and the confirm label
 * ("Done"), instead of the system editor's hard-to-see black "Crop" chrome.
 */
export default function AvatarCropModal({ visible, imageUri, onCancel, onDone }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const cropSize = Math.min(screenW - 48, Math.min(screenH * 0.55, 360));

  const display = useMemo(() => {
    if (!natural) return { width: cropSize, height: cropSize };
    const aspect = natural.w / natural.h;
    if (aspect >= 1) {
      return { width: cropSize, height: cropSize / aspect };
    }
    return { width: cropSize * aspect, height: cropSize };
  }, [natural, cropSize]);

  async function handleDone() {
    if (!imageUri || !natural) return;
    setBusy(true);
    try {
      // Center-square crop in source pixels, then resize for upload.
      const side = Math.min(natural.w, natural.h);
      const originX = Math.max(0, Math.floor((natural.w - side) / 2));
      const originY = Math.max(0, Math.floor((natural.h - side) / 2));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: side,
              height: side,
            },
          },
          { resize: { width: 512 } },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      onDone(result.uri);
    } catch {
      // If crop fails, fall back to the original pick so the user isn't blocked.
      onDone(imageUri);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
              <Text style={styles.headerBtnText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Profile photo</Text>

            <TouchableOpacity
              onPress={handleDone}
              style={[styles.headerBtn, styles.doneBtn]}
              accessibilityRole="button"
              accessibilityLabel="Done"
              disabled={busy || !imageUri}
            >
              {busy ? (
                <ActivityIndicator color="#0f766e" size="small" />
              ) : (
                <Text style={styles.doneText}>Done</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.stage}>
            {imageUri ? (
              <View style={[styles.frame, { width: cropSize, height: cropSize }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: display.width, height: display.height }}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width && height) setNatural({ w: width, h: height });
                  }}
                />
                <View pointerEvents="none" style={styles.grid}>
                  <View style={[styles.gridLine, styles.v1]} />
                  <View style={[styles.gridLine, styles.v2]} />
                  <View style={[styles.gridLine, styles.h1]} />
                  <View style={[styles.gridLine, styles.h2]} />
                </View>
              </View>
            ) : null}
            <Text style={styles.hint}>Centered square crop — tap Done to use this photo.</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f766e',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerBtn: {
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  headerBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  doneBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  doneText: { color: '#0f766e', fontWeight: '800', fontSize: 15 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#14b8a6',
  },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  v1: { top: 0, bottom: 0, left: '33.33%', width: 1 },
  v2: { top: 0, bottom: 0, left: '66.66%', width: 1 },
  h1: { left: 0, right: 0, top: '33.33%', height: 1 },
  h2: { left: 0, right: 0, top: '66.66%', height: 1 },
  hint: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 12,
  },
});
