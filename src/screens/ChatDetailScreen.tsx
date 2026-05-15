import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import type { MessageRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

export default function ChatDetailScreen({ route }: Props) {
  const { conversationId, listingTitle } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const data = await apiGet<MessageRow[]>(`/api/conversations/${conversationId}/messages`);
    setMessages(data);
  }, [conversationId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const tmr = setInterval(() => void load(), 8000);
    return () => {
      alive = false;
      clearInterval(tmr);
    };
  }, [load]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await apiPost<MessageRow>(`/api/conversations/${conversationId}/messages`, {
        body,
      });
      setText("");
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {listingTitle ? (
        <Text style={styles.listingHint} numberOfLines={1}>
          {listingTitle}
        </Text>
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Сообщение…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={4000}
        />
        <Pressable
          onPress={() => void send()}
          disabled={sending || !text.trim()}
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.9 }]}
        >
          {sending ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Text style={styles.sendTxt}>→</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listingHint: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  messages: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleTextMine: { color: colors.bg },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendTxt: { fontFamily: fonts.bold, fontSize: 20, color: colors.bg },
});
