import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardContainer, GradientButton } from '@/components/UI';

const ITEMS = ["FTC Tee (Cycling)", "FTC Tee (Running)"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function MerchandiseScreen() {
  const { session } = useAuth();
  const user = session?.user;
  
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price increases by 500 based on size index
  const currentPrice = selectedSize ? 1000 + (500 * SIZES.indexOf(selectedSize)) : 0;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      quality: 0.8 
    });
    if (!result.canceled && result.assets[0].uri) {
      setPaymentScreenshot(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!selectedItem || !selectedSize || !paymentScreenshot) {
      return Alert.alert("Missing Info", "Please select item, size and attach screenshot.");
    }

    if (!user) return Alert.alert("Error", "Not logged in");

    setIsSubmitting(true);
    try {
      // 1. Upload to 'payment_proofs' bucket
      const fileExt = paymentScreenshot.split('.').pop() ?? 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const response = await fetch(paymentScreenshot);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Insert into 'merchandise_orders' table
      const { error: dbError } = await supabase.from('merchandise_orders').insert({
        auth_uid: user.id,
        full_name: user.user_metadata?.name || 'Athlete',
        item_name: selectedItem,
        size: selectedSize,
        price: currentPrice,
        payment_screenshot: fileName,
        status: false, // Pending
      });

      if (dbError) throw dbError;

      Alert.alert("Success", "Merchandise order submitted!");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <LinearGradient 
      colors={['#ffffff', '#0d9488']} 
      start={{ x: 0.2, y: 0.2 }} 
      end={{ x: 0.8, y: 0.8 }} 
      style={styles.container}
    >
      {/* REMOVED THE MANUAL HEADER VIEW HERE */}
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Item Selection */}
        <CardContainer>
          <Text style={styles.label}>Select Item:</Text>
          <View style={styles.toggleRow}>
            {ITEMS.map((item) => (
              <TouchableOpacity 
                key={item} 
                onPress={() => setSelectedItem(item)}
                style={[styles.toggleChip, selectedItem === item && styles.toggleChipActive]}
              >
                <Text style={[styles.toggleText, selectedItem === item && styles.toggleTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardContainer>

        {/* Size Selection */}
        <CardContainer>
          <Text style={styles.label}>Select Size:</Text>
          <View style={styles.toggleRow}>
            {SIZES.map((size) => (
              <TouchableOpacity 
                key={size} 
                onPress={() => setSelectedSize(size)}
                style={[styles.toggleChipSmall, selectedSize === size && styles.toggleChipActive]}
              >
                <Text style={[styles.toggleText, selectedSize === size && styles.toggleTextActive]}>
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.priceText}>Price: {currentPrice > 0 ? `Rs. ${currentPrice}` : '-'}</Text>
        </CardContainer>

        {/* Payment Proof Upload */}
        <CardContainer>
          <Text style={styles.label}>Payment Screenshot:</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
            <Text style={paymentScreenshot ? styles.uploadTextSelected : styles.uploadText}>
              {paymentScreenshot ? "Image Selected ✓" : "Tap to Upload"}
            </Text>
          </TouchableOpacity>
        </CardContainer>

        <GradientButton 
          label={isSubmitting ? "Submitting..." : "Submit Order"} 
          onPress={handleSubmit} 
        />
        {isSubmitting && <ActivityIndicator color="#0d9488" style={{marginTop: 10}} />}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 20 }, 
  label: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toggleChip: { 
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, 
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' 
  },
  toggleChipSmall: { 
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, 
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' 
  },
  toggleChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  toggleText: { color: '#64748b', fontWeight: '600' },
  toggleTextActive: { color: '#ffffff' },
  priceText: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  uploadBox: { 
    borderWidth: 2, borderColor: '#ccfbf1', borderStyle: 'dashed', 
    borderRadius: 12, padding: 20, alignItems: 'center' 
  },
  uploadText: { color: '#94a3b8', fontWeight: '600' },
  uploadTextSelected: { color: '#0d9488', fontWeight: '700' },
});