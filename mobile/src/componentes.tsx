import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { cor, raio, toqueMinimo } from "./tema";

export function Botao({ titulo, aoTocar, secundario }: { titulo: string; aoTocar: () => void; secundario?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoTocar}
      style={({ pressed }) => [e.botao, secundario && e.botaoSec, pressed && { opacity: 0.8 }]}
    >
      <Text style={[e.botaoTexto, secundario && { color: cor.primaria }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Carregando() {
  return (
    <View style={e.centro} accessibilityLabel="Carregando">
      <ActivityIndicator size="large" color={cor.primaria} />
    </View>
  );
}

export function Erro({ mensagem, tentar }: { mensagem: string; tentar: () => void }) {
  return (
    <View style={e.centro} accessibilityRole="alert">
      <Text style={e.texto}>{mensagem}</Text>
      <Botao titulo="Tentar de novo" aoTocar={tentar} />
    </View>
  );
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return <View style={e.centro}><Text style={e.texto}>{mensagem}</Text></View>;
}

const e = StyleSheet.create({
  botao: {
    minHeight: toqueMinimo, paddingHorizontal: 16, justifyContent: "center", alignItems: "center",
    backgroundColor: cor.primaria, borderRadius: raio, borderWidth: 2, borderColor: cor.primaria,
  },
  botaoSec: { backgroundColor: cor.fundo },
  botaoTexto: { color: "#fff", fontWeight: "600", fontSize: 16 },
  centro: { flex: 1, padding: 24, gap: 16, alignItems: "center", justifyContent: "center" },
  texto: { color: cor.texto, fontSize: 16, textAlign: "center" },
});
