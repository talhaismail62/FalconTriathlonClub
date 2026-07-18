import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Gemini API config
// ---------------------------------------------------------------------------
const GROK_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROK_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GROK_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are Sporty AI, a friendly assistant inside a fitness app.
Only answer questions about fitness, sport, training, exercise, nutrition for
athletic performance, recovery, and related wellness topics. If the user asks
about anything outside that scope, politely say you can only help with
fitness and sport topics, and steer the conversation back. Keep answers
concise and practical, suitable for a mobile chat bubble (a few short
sentences, not long essays).`;

type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string };

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey! I'm Sporty AI 🏃 Ask me anything about training, workouts, recovery, or nutrition for sport.",
};

export default function ChatbotTab() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0); // Tracks exact keyboard height
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  
  // Space needed to clear the floating tab bar when keyboard is closed
  const tabBarClearance = Math.max(insets.bottom, 12) + 8 + 72;

  // Manually listen to keyboard events to get exact pixel height
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function scrollToEnd() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', content: text };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput(''); // Clears the text input immediately
    setLoading(true);
    scrollToEnd();

    try {
      const reply = await callAI(nextMessages);
      setMessages((prev) => [...prev, { id: `${Date.now()}-bot`, role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: "Sorry, I couldn't reach the server just now. Try again in a bit.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  }

  async function callAI(history: Message[]): Promise<string> {
    const res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.6,
      }),
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    return content.trim();
  }

  return (
    <LinearGradient
      colors={['#ffffff', '#0d9488']}
      start={{ x: 0.2, y: 0.2 }}
      end={{ x: 0.8, y: 0.8 }}
      style={styles.container}
    >
      {/* We use edges={['top']} so the bottom padding doesn't conflict with our manual keyboardHeight */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.flex}>
          <Text style={styles.heading}>Sporty AI</Text>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && <TypingBubble />}
          </ScrollView>
        </View>

        {/* 
          If keyboard is open, push the bar up by the exact keyboard height.
          If closed, push it up by the tab bar clearance.
        */}
        <View style={[styles.inputBar, { marginBottom: keyboardHeight > 0 ? keyboardHeight + 20: tabBarClearance }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about training, nutrition, recovery..."
            placeholderTextColor="#94a3b8"
            returnKeyType="send"
            blurOnSubmit={false} // Prevents keyboard from closing on Enter
            onSubmitEditing={handleSend} // Makes Enter key send & clear text
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d9488',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },

  messagesContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#0d9488',
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#0f172a' },
  bubbleTextUser: { color: '#ffffff' },

  typingBubble: { flexDirection: 'row', gap: 4, paddingVertical: 14 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#99c9c4' },
});