import { Linking, ScrollView, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatarDistancia } from "../api";
import { Botao } from "../componentes";
import type { Rotas } from "../navegacao";
import { cor } from "../tema";

export default function Ponto({ route }: NativeStackScreenProps<Rotas, "Ponto">) {
  const { ponto: p } = route.params;
  const rota = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

  return (
    <ScrollView contentContainerStyle={e.tela}>
      <Text style={e.titulo} accessibilityRole="header">{p.nome}</Text>
      <Text style={e.texto}>{p.endereco}</Text>
      <Text style={e.suave}>A {formatarDistancia(p.distanciaMetros)} do local de busca</Text>
      <Text style={e.subtitulo} accessibilityRole="header">Materiais aceitos</Text>
      {p.materiais.length
        ? p.materiais.map((m) => <Text key={m} style={e.texto}>• {m}</Text>)
        : <Text style={e.suave}>Não informado.</Text>}
      <Botao titulo="Como chegar" aoTocar={() => Linking.openURL(rota)} />
    </ScrollView>
  );
}

const e = StyleSheet.create({
  tela: { padding: 16, gap: 10, backgroundColor: cor.fundo, flexGrow: 1 },
  titulo: { fontSize: 22, fontWeight: "700", color: cor.cabecalho },
  subtitulo: { fontSize: 18, fontWeight: "700", color: cor.cabecalho, marginTop: 8 },
  texto: { fontSize: 16, color: cor.texto },
  suave: { fontSize: 15, color: cor.textoSuave },
});
